"use client";

/**
 * AddressBadge.tsx
 *
 * Provides three public exports:
 *
 *   1. `truncateAddress`    — pure helper that formats a Stellar public key as
 *                             GXXXX…YYYY with configurable head/tail length.
 *
 *   2. `JazziconAvatar`     — deterministic SVG avatar derived from the
 *                             public key's character codes. No external deps;
 *                             uses only a lightweight FNV-1a hash + HSL colour
 *                             arithmetic to guarantee identical output for the
 *                             same key across every render and every session.
 *
 *   3. `AddressBadge`       — composite UI component that renders the avatar
 *                             alongside the truncated address and a
 *                             click-to-copy button with a tooltip confirmation
 *                             tick that auto-dismisses after 2 s.
 *
 * Design principles
 * ─────────────────
 * • Zero external dependencies beyond React.
 * • No `any` — all types are explicit.
 * • All stateful logic lives inside `AddressBadge`; the helpers and the
 *   avatar are pure / stateless so consumers can use them independently.
 * • Clipboard access is guarded behind a `typeof navigator !== "undefined"`
 *   check so the module is safe to import in SSR/RSC contexts.
 * • The avatar and helpers are memoised via `React.memo` / `useMemo` to
 *   prevent redundant hash computations on parent re-renders.
 */

import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";

// ─────────────────────────────────────────────────────────────────────────────
// 1. truncateAddress
// ─────────────────────────────────────────────────────────────────────────────

export interface TruncateAddressOptions {
  /** Number of leading characters to keep. Default: 6 */
  head?: number;
  /** Number of trailing characters to keep. Default: 4 */
  tail?: number;
  /** Separator between the head and tail. Default: "…" */
  separator?: string;
}

/**
 * Formats a Stellar public key (or any long address string) into a compact
 * display form, e.g. `GABCD…X4A2`.
 *
 * Defaults:   head = 6, tail = 4, separator = "…"
 * Output fmt: `GXXXXX…YYYY`
 *
 * If the address is too short to truncate meaningfully (≤ head + tail) the
 * original string is returned unchanged.
 *
 * @example
 * truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ1234")
 * // → "GABCDE…1234"
 *
 * truncateAddress("GABCDE…1234", { head: 4, tail: 6 })
 * // → "GABC…E…1234"   (already-truncated strings are accepted as-is)
 */
export function truncateAddress(
  address: string,
  options: TruncateAddressOptions = {},
): string {
  const head = options.head ?? 6;
  const tail = options.tail ?? 4;
  const sep = options.separator ?? "\u2026"; // '…'

  if (!address || typeof address !== "string") return "";
  if (address.length <= head + tail) return address;

  return `${address.slice(0, head)}${sep}${address.slice(-tail)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. generateAvatarColors  (internal + exported for advanced usage)
// ─────────────────────────────────────────────────────────────────────────────

/** A fully-determined colour palette for one avatar. */
export interface AvatarPalette {
  /** Background HSL colour string */
  background: string;
  /** Array of HSL colour strings for the foreground shapes */
  shapes: readonly string[];
}

/**
 * FNV-1a 32-bit hash over a string's UTF-16 code units.
 *
 * Chosen for its extremely low code-size and good avalanche effect on the
 * short alphanumeric inputs typical of Stellar addresses.
 * Returns an unsigned 32-bit integer in [0, 2^32).
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (0x01000193), keeping result within 32 bits.
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit integer.
  return hash >>> 0;
}

/**
 * Derive a deterministic avatar colour palette from a public key string.
 *
 * Strategy
 * ─────────
 * • Hash the full key with FNV-1a to get a 32-bit seed.
 * • Spread the seed across the 360° hue wheel for the background colour.
 * • Rotate the hue by deterministic offsets for each shape colour so the
 *   palette is always harmonious (analogous / triadic spread).
 *
 * All colours use full saturation and carefully chosen lightness values so
 * they look vivid on both light and dark backgrounds without accessibility
 * concerns for decorative UI elements.
 *
 * @param publicKey - The Stellar G… public key (or any non-empty string).
 * @param shapeCount - Number of foreground shape colours to generate (1-8).
 */
export function generateAvatarColors(
  publicKey: string,
  shapeCount = 5,
): AvatarPalette {
  const seed = fnv1a32(publicKey || "anonymous");

  // Background: full-saturation, 25% lightness — dark jewel tone.
  const bgHue = seed % 360;
  const background = `hsl(${bgHue}, 70%, 22%)`;

  // Shape colours: evenly-spread hue offsets derived from further hash rounds.
  const clampedCount = Math.max(1, Math.min(shapeCount, 8));
  const shapes: string[] = [];

  for (let i = 0; i < clampedCount; i++) {
    // Re-hash with a round-specific salt so each colour is independent.
    const roundSeed = fnv1a32(`${publicKey}:${i}`);
    const hue = (bgHue + 30 + (roundSeed % 300)) % 360;
    const lightness = 55 + (roundSeed % 25); // 55–80 %
    shapes.push(`hsl(${hue}, 80%, ${lightness}%)`);
  }

  return { background, shapes: shapes as readonly string[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal geometry helper
// ─────────────────────────────────────────────────────────────────────────────

interface ShapeDescriptor {
  type: "circle" | "rect" | "polygon";
  color: string;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  points?: string;
}

/**
 * Build the deterministic list of SVG shape descriptors for the avatar grid.
 *
 * Uses the FNV-1a seed to place 5 overlapping translucent shapes inside a
 * 40 × 40 viewBox, producing a unique but visually balanced pattern.
 */
function buildShapeDescriptors(
  publicKey: string,
  palette: AvatarPalette,
): readonly ShapeDescriptor[] {
  const seed = fnv1a32(publicKey || "anonymous");
  const SIZE = 40;
  const descriptors: ShapeDescriptor[] = [];

  const shapeTypes: Array<"circle" | "rect" | "polygon"> = [
    "circle",
    "rect",
    "polygon",
    "circle",
    "rect",
  ];

  for (let i = 0; i < 5; i++) {
    const shapeSeed = fnv1a32(`${publicKey}:shape:${i}`) ^ (seed >> i);
    const color = palette.shapes[i % palette.shapes.length];

    const type = shapeTypes[i % shapeTypes.length];
    const cx = 4 + (shapeSeed % (SIZE - 8));
    const cy = 4 + ((shapeSeed >>> 8) % (SIZE - 8));
    const r = 6 + ((shapeSeed >>> 16) % 12); // 6–17

    if (type === "circle") {
      descriptors.push({ type: "circle", color, cx, cy, r });
    } else if (type === "rect") {
      const w = 8 + ((shapeSeed >>> 4) % 16);
      const h = 8 + ((shapeSeed >>> 12) % 14);
      descriptors.push({
        type: "rect",
        color,
        x: Math.max(0, cx - w / 2),
        y: Math.max(0, cy - h / 2),
        w,
        h,
      });
    } else {
      // Equilateral triangle centred on (cx, cy)
      const pr = 7 + ((shapeSeed >>> 20) % 10);
      const angle0 = ((shapeSeed >>> 24) % 360) * (Math.PI / 180);
      const pts = [0, 1, 2]
        .map((k) => {
          const a = angle0 + (k * 2 * Math.PI) / 3;
          return `${(cx + pr * Math.cos(a)).toFixed(2)},${(cy + pr * Math.sin(a)).toFixed(2)}`;
        })
        .join(" ");
      descriptors.push({ type: "polygon", color, points: pts });
    }
  }

  return descriptors;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. JazziconAvatar
// ─────────────────────────────────────────────────────────────────────────────

export interface JazziconAvatarProps {
  /** Stellar G… public key used as the hash seed */
  publicKey: string;
  /** Width and height in pixels. Default: 32 */
  size?: number;
  /** Additional CSS class names applied to the outer <svg> */
  className?: string;
  /** Accessible label. Defaults to "Wallet avatar" */
  "aria-label"?: string;
}

/**
 * JazziconAvatar
 *
 * Renders a 40 × 40 viewBox SVG avatar whose shapes and colours are
 * deterministically derived from the provided public key.  The same key
 * always produces an identical visual regardless of render order, session, or
 * platform.
 *
 * All shapes are rendered with 0.75 opacity so overlapping regions blend into
 * a rich, unique pattern.
 *
 * @example
 * <JazziconAvatar publicKey="GABCDEFG..." size={40} />
 */
export const JazziconAvatar = React.memo(function JazziconAvatar({
  publicKey,
  size = 32,
  className,
  "aria-label": ariaLabel = "Wallet avatar",
}: JazziconAvatarProps) {
  const palette = useMemo(
    () => generateAvatarColors(publicKey),
    [publicKey],
  );

  const shapes = useMemo(
    () => buildShapeDescriptors(publicKey, palette),
    [publicKey, palette],
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-label={ariaLabel}
      role="img"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, borderRadius: "50%", overflow: "hidden" }}
    >
      {/* Background */}
      <rect width="40" height="40" fill={palette.background} />

      {/* Deterministic foreground shapes */}
      {shapes.map((s, idx) => {
        if (s.type === "circle") {
          return (
            <circle
              key={idx}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill={s.color}
              opacity={0.75}
            />
          );
        }
        if (s.type === "rect") {
          return (
            <rect
              key={idx}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              fill={s.color}
              opacity={0.75}
            />
          );
        }
        // polygon
        return (
          <polygon
            key={idx}
            points={s.points}
            fill={s.color}
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
});

JazziconAvatar.displayName = "JazziconAvatar";

// ─────────────────────────────────────────────────────────────────────────────
// 4. AddressBadge
// ─────────────────────────────────────────────────────────────────────────────

/** How long (ms) the "Copied!" confirmation tooltip stays visible. */
const COPY_CONFIRMATION_DURATION_MS = 2000;

export type AddressBadgeSize = "sm" | "md" | "lg";

export interface AddressBadgeProps {
  /** Full Stellar G… public key to display and copy */
  publicKey: string;
  /**
   * Visual size preset.
   *   sm — 24 px avatar, xs text (suitable for table rows)
   *   md — 32 px avatar, sm text (default, suits cards and sidebars)
   *   lg — 40 px avatar, base text (suitable for profile headers)
   */
  size?: AddressBadgeSize;
  /** Override head chars for truncation. Inherits size-based default if omitted. */
  truncateHead?: number;
  /** Override tail chars for truncation. Default: 4 */
  truncateTail?: number;
  /** Hide the avatar and show only the truncated text + copy icon. Default: false */
  hideAvatar?: boolean;
  /** Additional CSS class names applied to the outermost wrapper */
  className?: string;
  /**
   * Callback fired after a successful clipboard write.
   * Receives the full public key that was copied.
   */
  onCopy?: (publicKey: string) => void;
}

interface SizeConfig {
  avatar: number;
  textClass: string;
  iconSize: number;
  defaultHead: number;
  gapClass: string;
  paddingClass: string;
}

const SIZE_CONFIG: Record<AddressBadgeSize, SizeConfig> = {
  sm: {
    avatar: 24,
    textClass: "text-xs",
    iconSize: 12,
    defaultHead: 5,
    gapClass: "gap-1.5",
    paddingClass: "px-2 py-1",
  },
  md: {
    avatar: 32,
    textClass: "text-sm",
    iconSize: 14,
    defaultHead: 6,
    gapClass: "gap-2",
    paddingClass: "px-2.5 py-1.5",
  },
  lg: {
    avatar: 40,
    textClass: "text-base",
    iconSize: 16,
    defaultHead: 8,
    gapClass: "gap-3",
    paddingClass: "px-3 py-2",
  },
};

/**
 * AddressBadge
 *
 * A self-contained UI chip that renders:
 *   • A deterministic Jazzicon avatar derived from the public key
 *   • The public key truncated to GXXXXX…YYYY form
 *   • A copy-to-clipboard icon button
 *   • A tooltip that transitions from "Copy address" to "Copied ✓" on click
 *     and resets automatically after 2 seconds
 *
 * @example
 * <AddressBadge publicKey="GABCDE...1234" size="md" />
 * <AddressBadge publicKey="GABCDE...1234" size="sm" hideAvatar onCopy={handleCopy} />
 */
export const AddressBadge = React.memo(function AddressBadge({
  publicKey,
  size = "md",
  truncateHead,
  truncateTail = 4,
  hideAvatar = false,
  className = "",
  onCopy,
}: AddressBadgeProps) {
  const cfg = SIZE_CONFIG[size];
  const head = truncateHead ?? cfg.defaultHead;

  const truncated = useMemo(
    () => truncateAddress(publicKey, { head, tail: truncateTail }),
    [publicKey, head, truncateTail],
  );

  // ── Copy-to-clipboard state ──────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    if (copied) return; // debounce double-clicks during confirmation window
    if (typeof navigator === "undefined" || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      onCopy?.(publicKey);

      // Auto-reset after confirmation duration
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, COPY_CONFIRMATION_DURATION_MS);
    } catch {
      // Clipboard access denied — silently ignore; the key is still visible.
    }
  }, [copied, publicKey, onCopy]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  // ── Tooltip id for aria-describedby ─────────────────────────────────────
  const tooltipId = useId();

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <span
      className={`inline-flex items-center ${cfg.gapClass} ${className}`}
      style={{ contain: "layout style" }}
    >
      {/* Avatar */}
      {!hideAvatar && (
        <JazziconAvatar
          publicKey={publicKey}
          size={cfg.avatar}
          aria-label={`Avatar for ${truncated}`}
        />
      )}

      {/* Truncated address text */}
      <span
        className={`font-mono ${cfg.textClass} text-gray-300 tabular-nums leading-none select-all`}
        title={publicKey}
      >
        {truncated}
      </span>

      {/* Copy button + tooltip wrapper */}
      <span className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Address copied" : "Copy address"}
          aria-describedby={tooltipId}
          className={`inline-flex items-center justify-center rounded transition-colors
            ${
              copied
                ? "text-emerald-400 hover:text-emerald-300"
                : "text-gray-500 hover:text-gray-200"
            }
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Icon
            id={copied ? ICON_IDS.check : ICON_IDS.copy}
            size={cfg.iconSize}
            aria-hidden
          />
        </button>

        {/* Tooltip */}
        <span
          id={tooltipId}
          role="tooltip"
          aria-live="polite"
          className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
            whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium leading-none
            shadow-lg transition-all duration-150
            ${
              copied
                ? "bg-emerald-800/90 text-emerald-200 opacity-100 translate-y-0"
                : "bg-gray-800/90 text-gray-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
            }`}
        >
          {copied ? "Copied!" : "Copy address"}
        </span>
      </span>
    </span>
  );
});

AddressBadge.displayName = "AddressBadge";
