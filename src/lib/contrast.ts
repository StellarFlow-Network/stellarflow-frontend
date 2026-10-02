/**
 * contrast.ts
 *
 * Colour-contrast helpers and the high-contrast (WCAG AAA) palette used by the
 * accessibility option in the StellarFlow dashboard.
 *
 * The maths here follows the WCAG 2.2 relative-luminance and contrast-ratio
 * definitions so the palette can be validated without a browser:
 *
 *   L = 0.2126·R + 0.7152·G + 0.0722·B          (channels linearised below)
 *   ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 *
 * The palette values below are mirrored verbatim in `src/app/globals.css`
 * under the `[data-contrast="high"]` / `.high-contrast` selectors, and the
 * accompanying unit test asserts the two stay in sync.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Minimum contrast ratio for normal-sized text under WCAG 2.2 level AA. */
export const WCAG_AA_NORMAL_TEXT = 4.5;
/** Minimum contrast ratio for normal-sized text under WCAG 2.2 level AAA. */
export const WCAG_AAA_NORMAL_TEXT = 7;
/** Minimum contrast ratio for large text under WCAG 2.2 level AA. */
export const WCAG_AA_LARGE_TEXT = 3;
/** Minimum contrast ratio for user-interface components and graphics (1.4.11). */
export const WCAG_NON_TEXT_CONTRAST = 3;

/** Parses `#rgb` or `#rrggbb` (the leading `#` is optional). Throws on bad input. */
export function parseHexColor(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, "");

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex colour: "${hex}"`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

/** Converts an sRGB channel (0–255) to its linear-light value. */
function linearizeChannel(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance in the range [0, 1]. Accepts a hex string or `Rgb`. */
export function relativeLuminance(color: Rgb | string): number {
  const { r, g, b } = typeof color === "string" ? parseHexColor(color) : color;
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/** WCAG contrast ratio between two colours, in the range [1, 21]. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounds a ratio to two decimals for readable assertions/logging. */
export function roundContrastRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

export function meetsContrastRatio(
  foreground: Rgb | string,
  background: Rgb | string,
  minimum: number,
): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

export function meetsWcagAA(foreground: Rgb | string, background: Rgb | string): boolean {
  return meetsContrastRatio(foreground, background, WCAG_AA_NORMAL_TEXT);
}

export function meetsWcagAAA(foreground: Rgb | string, background: Rgb | string): boolean {
  return meetsContrastRatio(foreground, background, WCAG_AAA_NORMAL_TEXT);
}

export function meetsNonTextContrast(foreground: Rgb | string, background: Rgb | string): boolean {
  return meetsContrastRatio(foreground, background, WCAG_NON_TEXT_CONTRAST);
}

/* ─── High-contrast palette ──────────────────────────────────────────────── */

export const HIGH_CONTRAST_BACKGROUND = "#000000";
export const HIGH_CONTRAST_FOREGROUND = "#ffffff";
export const HIGH_CONTRAST_MUTED = "#e6e6e6";
export const HIGH_CONTRAST_SURFACE = "#000000";
export const HIGH_CONTRAST_SURFACE_RAISED = "#1a1a1a";
export const HIGH_CONTRAST_BORDER = "#ffffff";
export const HIGH_CONTRAST_ACCENT = "#ffff00";
export const HIGH_CONTRAST_FOCUS = "#ffff00";

/** Status hues, each tuned to clear 7:1 on the black high-contrast surface. */
export const HIGH_CONTRAST_STATUS = {
  success: "#00ff88",
  warning: "#ffcc00",
  danger: "#ff8080",
  info: "#66d9ff",
} as const;

export type StatusTone = keyof typeof HIGH_CONTRAST_STATUS;

/** Categorical chart series for the high-contrast surface (all >= 7:1). */
export const HIGH_CONTRAST_CHART_SERIES = [
  "#66d9ff",
  "#00ff88",
  "#ffff00",
  "#ff8080",
  "#c792ea",
  "#ffb366",
] as const;

/** The palette currently used by the charts in normal (non-boosted) mode. */
export const DEFAULT_CHART_SERIES = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#4ade80",
] as const;

export interface ContrastPair {
  /** Human-readable name used in test failure output. */
  label: string;
  foreground: string;
  background: string;
  /** Ratio this pair promises to meet. */
  minimum: number;
}

/**
 * Every text/background combination the high-contrast theme renders.
 * All pairs target WCAG AAA (>= 7:1).
 */
export const HIGH_CONTRAST_TEXT_PAIRS: readonly ContrastPair[] = [
  {
    label: "body text",
    foreground: HIGH_CONTRAST_FOREGROUND,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "muted text",
    foreground: HIGH_CONTRAST_MUTED,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "accent/link text",
    foreground: HIGH_CONTRAST_ACCENT,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "text on raised surface",
    foreground: HIGH_CONTRAST_FOREGROUND,
    background: HIGH_CONTRAST_SURFACE_RAISED,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "success status",
    foreground: HIGH_CONTRAST_STATUS.success,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "warning status",
    foreground: HIGH_CONTRAST_STATUS.warning,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "danger status",
    foreground: HIGH_CONTRAST_STATUS.danger,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "info status",
    foreground: HIGH_CONTRAST_STATUS.info,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
  {
    label: "black label on accent fill",
    foreground: HIGH_CONTRAST_BACKGROUND,
    background: HIGH_CONTRAST_ACCENT,
    minimum: WCAG_AAA_NORMAL_TEXT,
  },
];

/**
 * High-contrast CSS custom properties, keyed by the exact declaration name
 * written in `src/app/globals.css`. The unit test verifies each one is present
 * so the TypeScript palette and the stylesheet can never drift apart.
 */
export const HIGH_CONTRAST_CSS_VARIABLES: Readonly<Record<string, string>> = {
  "--background": HIGH_CONTRAST_BACKGROUND,
  "--foreground": HIGH_CONTRAST_FOREGROUND,
  "--surface": HIGH_CONTRAST_SURFACE,
  "--surface-raised": HIGH_CONTRAST_SURFACE_RAISED,
  "--border": HIGH_CONTRAST_BORDER,
  "--muted": HIGH_CONTRAST_MUTED,
  "--control": HIGH_CONTRAST_SURFACE,
  "--control-hover": HIGH_CONTRAST_SURFACE_RAISED,
  "--contrast-focus": HIGH_CONTRAST_FOCUS,
  "--accent": HIGH_CONTRAST_ACCENT,
  "--accent-foreground": HIGH_CONTRAST_BACKGROUND,
  "--status-success": HIGH_CONTRAST_STATUS.success,
  "--status-warning": HIGH_CONTRAST_STATUS.warning,
  "--status-danger": HIGH_CONTRAST_STATUS.danger,
  "--status-info": HIGH_CONTRAST_STATUS.info,
  "--chart-1": HIGH_CONTRAST_CHART_SERIES[0],
  "--chart-2": HIGH_CONTRAST_CHART_SERIES[1],
  "--chart-3": HIGH_CONTRAST_CHART_SERIES[2],
  "--chart-4": HIGH_CONTRAST_CHART_SERIES[3],
  "--chart-5": HIGH_CONTRAST_CHART_SERIES[4],
  "--chart-6": HIGH_CONTRAST_CHART_SERIES[5],
};

/** Every non-text (graphic/UI) pair the high-contrast theme relies on. */
export const HIGH_CONTRAST_NON_TEXT_PAIRS: readonly ContrastPair[] = [
  {
    label: "focus ring on background",
    foreground: HIGH_CONTRAST_FOCUS,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_NON_TEXT_CONTRAST,
  },
  {
    label: "border on background",
    foreground: HIGH_CONTRAST_BORDER,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_NON_TEXT_CONTRAST,
  },
  ...HIGH_CONTRAST_CHART_SERIES.map((color, index) => ({
    label: `chart series ${index + 1}`,
    foreground: color,
    background: HIGH_CONTRAST_BACKGROUND,
    minimum: WCAG_AAA_NORMAL_TEXT,
  })),
];

/* ─── Selectors shared with the components ───────────────────────────────── */

export interface StatusToneStyle {
  color: string;
  background: string;
  border: string;
  minimum: number;
}

/** Returns concrete colours for a status tone in the active contrast mode. */
export function getStatusToneStyle(tone: StatusTone, highContrast: boolean): StatusToneStyle {
  if (highContrast) {
    return {
      color: HIGH_CONTRAST_STATUS[tone],
      background: HIGH_CONTRAST_BACKGROUND,
      border: HIGH_CONTRAST_STATUS[tone],
      minimum: WCAG_AAA_NORMAL_TEXT,
    };
  }

  return {
    color: DEFAULT_STATUS[tone],
    background: "transparent",
    border: DEFAULT_STATUS[tone],
    minimum: WCAG_AA_NORMAL_TEXT,
  };
}

const DEFAULT_STATUS: Record<StatusTone, string> = {
  success: "#4ade80",
  warning: "#fbbf24",
  danger: "#f87171",
  info: "#60a5fa",
};

/**
 * Class names for the reusable status badge. In high-contrast mode the badge
 * falls back to the `.hc-status-badge` rules in `globals.css`.
 */
export function getStatusBadgeClassName(tone: StatusTone, highContrast: boolean): string {
  return highContrast ? `hc-status-badge hc-status-badge--${tone}` : `status-badge status-badge--${tone}`;
}

/** Chart series to render for the active contrast mode. */
export function getChartSeries(highContrast: boolean): readonly string[] {
  return highContrast ? HIGH_CONTRAST_CHART_SERIES : DEFAULT_CHART_SERIES;
}

/** Every pair that failed to reach its promised ratio (empty array == pass). */
export function findContrastFailures(
  pairs: readonly ContrastPair[],
): Array<ContrastPair & { ratio: number }> {
  return pairs
    .map((pair) => ({ ...pair, ratio: roundContrastRatio(contrastRatio(pair.foreground, pair.background)) }))
    .filter((pair) => pair.ratio < pair.minimum);
}
