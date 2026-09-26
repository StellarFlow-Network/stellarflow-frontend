"use client";

/**
 * IdenticonAvatar.tsx
 *
 * Deterministic SVG avatar generator for unverified assets that lack an
 * official image logo. The generated graphic is derived purely from the asset
 * contract address, so the same address always produces an identical avatar —
 * no network request, no external image, no layout shift.
 *
 * Design principles
 * ─────────────────
 * • Zero external dependencies (no Jdenticon / Blockies package needed) — the
 *   hashing and geometry are implemented inline with a lightweight FNV-1a
 *   hash, mirroring the approach used by `AddressBadge`'s `JazziconAvatar`.
 * • Fully deterministic: identical input ⇒ byte-identical SVG markup.
 * • Colour schemes are constrained to a lightness band that guarantees WCAG
 *   AA (≥ 4.5:1) contrast against the dark UI background (`#0f172a`).
 * • Renders instantly as inline SVG — no `<img>`, no network fetch.
 */

import React, { useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported avatar pixel dimensions. */
export type IdenticonAvatarSize = "sm" | "md" | "lg";

/** Pixel dimensions for each named size preset. */
export const IDENTICON_SIZE_PX: Readonly<Record<IdenticonAvatarSize, number>> = {
  sm: 16,
  md: 24,
  lg: 40,
};

export interface IdenticonAvatarProps {
  /** Asset contract address used as the deterministic hash seed. */
  address: string;
  /** Named size preset. Default: "md" (24px). */
  size?: IdenticonAvatarSize;
  /**
   * Optional asset initial(s) rendered as a centred text overlay.
   * When omitted, no text is drawn.
   */
  initial?: string;
  /** Additional CSS class names applied to the outer <svg>. */
  className?: string;
  /** Accessible label. Defaults to "Asset avatar". */
  "aria-label"?: string;
}

/** A fully-determined colour palette for one identicon. */
export interface IdenticonPalette {
  /** Background colour (dark, low-lightness HSL string). */
  background: string;
  /** Foreground cell colour (light, high-lightness HSL string). */
  foreground: string;
  /** Text overlay colour (near-white HSL string). */
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash over a string's UTF-16 code units.
 *
 * Chosen for its tiny footprint and good avalanche effect on the short
 * alphanumeric inputs typical of Stellar contract addresses. Returns an
 * unsigned 32-bit integer in [0, 2^32).
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (0x01000193), keeping the result within 32 bits.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour generation (WCAG-safe against dark backgrounds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Relative luminance of an sRGB channel triplet, per WCAG 2.1.
 * @param rgb - Channel values in [0, 255].
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Convert an HSL colour (h in [0,360), s and l in [0,1]) to sRGB channels.
 */
function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * WCAG 2.1 contrast ratio between two relative luminances.
 */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Dark UI background used as the contrast reference (`slate-900`). */
export const DARK_UI_BACKGROUND = "#0f172a";

const DARK_BG_LUMINANCE = relativeLuminance(0x0f, 0x17, 0x2a);

/**
 * Derive a deterministic, WCAG-AA-compliant palette from a contract address.
 *
 * Strategy
 * ─────────
 * • Hash the address with FNV-1a to obtain a 32-bit seed.
 * • Spread the seed across the 360° hue wheel for the foreground colour.
 * • Keep the foreground lightness high (72%) so it always clears a 4.5:1
 *   contrast ratio against the dark UI background.
 * • The background is a very dark, low-saturation tone of the same hue so the
 *   avatar reads as a cohesive tile on dark surfaces.
 *
 * @param address - The asset contract address (or any non-empty string).
 */
export function generateIdenticonPalette(address: string): IdenticonPalette {
  const seed = fnv1a32(address || "unknown-asset");
  const hue = seed % 360;

  // Foreground: high lightness guarantees AA contrast on dark backgrounds.
  // Lightness 72% is the minimum that keeps even the lowest-luminance hue
  // (blue, ~240°) above the 4.5:1 WCAG AA threshold against `#0f172a`.
  const foreground = `hsl(${hue}, 85%, 72%)`;
  // Background: dark, desaturated variant of the same hue.
  const background = `hsl(${hue}, 45%, 16%)`;
  // Text overlay: near-white for maximum legibility.
  const text = "hsl(0, 0%, 98%)";

  return { background, foreground, text };
}

/**
 * Verify that a palette's foreground clears the WCAG AA contrast threshold
 * (4.5:1) against the dark UI background. Exposed for testing / auditing.
 */
export function meetsWcagAaOnDark(palette: IdenticonPalette): boolean {
  const { r, g, b } = hslToRgbFromString(palette.foreground);
  const fgLuminance = relativeLuminance(r, g, b);
  return contrastRatio(fgLuminance, DARK_BG_LUMINANCE) >= 4.5;
}

/** Parse an `hsl(h, s%, l%)` string back into sRGB channels. */
function hslToRgbFromString(hsl: string): { r: number; g: number; b: number } {
  const match = /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(hsl);
  if (!match) return { r: 0, g: 0, b: 0 };
  return hslToRgb(
    Number(match[1]),
    Number(match[2]) / 100,
    Number(match[3]) / 100,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern generation
// ─────────────────────────────────────────────────────────────────────────────

/** Grid resolution of the identicon (GRID × GRID cells). */
export const IDENTICON_GRID = 5;

/**
 * Build the deterministic boolean cell matrix for the identicon.
 *
 * The pattern is horizontally mirrored (left half drives the right half) which
 * is the classic identicon look and keeps the output visually balanced.
 *
 * @returns A `GRID × GRID` matrix of booleans; `true` = filled cell.
 */
export function buildIdenticonMatrix(address: string): boolean[][] {
  const seed = fnv1a32(address || "unknown-asset");
  const half = Math.ceil(IDENTICON_GRID / 2);
  const matrix: boolean[][] = [];

  for (let row = 0; row < IDENTICON_GRID; row++) {
    const cells: boolean[] = new Array(IDENTICON_GRID).fill(false);
    for (let col = 0; col < half; col++) {
      // Mix row/column into the seed so each cell is independent yet stable.
      const bit = (seed >>> ((row * half + col) % 32)) & 1;
      const filled = bit === 1;
      cells[col] = filled;
      cells[IDENTICON_GRID - 1 - col] = filled;
    }
    matrix.push(cells);
  }

  return matrix;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IdenticonAvatar
 *
 * Renders an inline SVG identicon whose pattern and colours are deterministically
 * derived from the supplied asset contract address. The same address always
 * produces an identical avatar, and rendering requires no network request.
 *
 * @example
 * <IdenticonAvatar address="CABC…XYZ" size="lg" initial="USDC" />
 */
export const IdenticonAvatar = React.memo(function IdenticonAvatar({
  address,
  size = "md",
  initial,
  className,
  "aria-label": ariaLabel = "Asset avatar",
}: IdenticonAvatarProps) {
  const px = IDENTICON_SIZE_PX[size] ?? IDENTICON_SIZE_PX.md;

  const palette = useMemo(() => generateIdenticonPalette(address), [address]);
  const matrix = useMemo(() => buildIdenticonMatrix(address), [address]);

  const cell = 100 / IDENTICON_GRID;
  const overlay = initial ? initial.trim().charAt(0).toUpperCase() : "";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      className={className}
      style={{ flexShrink: 0, borderRadius: "50%", overflow: "hidden" }}
      data-testid="identicon-avatar"
      data-address={address}
    >
      {/* Background tile */}
      <rect width="100" height="100" fill={palette.background} />

      {/* Deterministic mirrored pattern */}
      {matrix.map((row, rowIndex) =>
        row.map((filled, colIndex) =>
          filled ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * cell}
              y={rowIndex * cell}
              width={cell}
              height={cell}
              fill={palette.foreground}
            />
          ) : null,
        ),
      )}

      {/* Optional asset initial overlay */}
      {overlay ? (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="52"
          fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={palette.text}
          data-testid="identicon-initial"
        >
          {overlay}
        </text>
      ) : null}
    </svg>
  );
});

IdenticonAvatar.displayName = "IdenticonAvatar";
