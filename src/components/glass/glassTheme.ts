/**
 * src/components/glass/glassTheme.ts
 *
 * Framework-free helpers behind the dark-mode glassmorphism theme.
 *
 * The visual contract itself lives in `src/app/globals.css`:
 *   - design tokens are declared on `:root` / `.dark` / `.high-contrast`
 *   - `.glass-surface` paints the opaque fallback first and only upgrades to
 *     `backdrop-filter: blur(...)` inside `@supports`, so engines without
 *     backdrop-filter support keep readable solid panels.
 *
 * This module owns only the deterministic string/number composition, which
 * keeps it unit-testable with `node:test` — no DOM, no JSX, no dependencies.
 */

/** Density preset for a glass surface. */
export type GlassVariant = "panel" | "modal" | "nav";

/** Per-instance overrides for the backdrop filter. */
export interface GlassTuning {
  /** Backdrop blur radius in px. Clamped to {@link GLASS_MIN_BLUR}–{@link GLASS_MAX_BLUR}. */
  blur?: number;
  /** Backdrop saturation in percent. Clamped to {@link GLASS_MIN_SATURATE}–{@link GLASS_MAX_SATURATE}. */
  saturate?: number;
}

/** Every supported variant. */
export const GLASS_VARIANTS = ["panel", "modal", "nav"] as const;

/**
 * Class shared by every glass surface. It carries both the opaque fallback and
 * the `@supports (backdrop-filter: blur(...))` upgrade, so a surface stays
 * readable when the engine cannot blur the backdrop.
 */
export const GLASS_BASE_CLASS = "glass-surface";

/** Variant class appended after {@link GLASS_BASE_CLASS}. */
export const GLASS_VARIANT_CLASS: Record<GlassVariant, string> = {
  panel: "glass-panel",
  modal: "glass-modal",
  nav: "glass-nav",
};

/** CSS custom properties a caller may override for a single instance. */
export const GLASS_TOKEN = {
  blur: "--glass-blur",
  saturate: "--glass-saturate",
} as const;

export const GLASS_DEFAULT_BLUR = 16;
export const GLASS_MIN_BLUR = 0;
export const GLASS_MAX_BLUR = 40;

export const GLASS_DEFAULT_SATURATE = 160;
export const GLASS_MIN_SATURATE = 100;
export const GLASS_MAX_SATURATE = 200;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when `value` is one of the supported {@link GlassVariant} presets. */
export function isGlassVariant(value: unknown): value is GlassVariant {
  return (
    typeof value === "string" &&
    (GLASS_VARIANTS as readonly string[]).includes(value)
  );
}

/**
 * Clamps a requested blur radius to the range the compositor can sustain
 * without dropping frames. Non-finite or missing values fall back to
 * {@link GLASS_DEFAULT_BLUR} so a bad prop can never emit `blur(NaNpx)`, which
 * would invalidate the whole `backdrop-filter` declaration.
 */
export function clampGlassBlur(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return GLASS_DEFAULT_BLUR;
  }
  return clamp(value, GLASS_MIN_BLUR, GLASS_MAX_BLUR);
}

/**
 * Clamps a requested backdrop saturation percentage. Non-finite or missing
 * values fall back to {@link GLASS_DEFAULT_SATURATE}.
 */
export function clampGlassSaturate(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return GLASS_DEFAULT_SATURATE;
  }
  return clamp(value, GLASS_MIN_SATURATE, GLASS_MAX_SATURATE);
}

/**
 * Builds the `className` for a glass surface: base layer + variant layer +
 * caller classes, whitespace-normalised and de-duplicated so a caller passing
 * `glass-surface` twice cannot disturb cascade ordering.
 *
 * A missing or unknown variant degrades to `panel`, which matters for plain-JS
 * callers such as `src/app/components/nav.jsx`.
 */
export function resolveGlassClassName(
  options: { variant?: GlassVariant; className?: string } = {},
): string {
  const variant: GlassVariant = isGlassVariant(options.variant)
    ? options.variant
    : "panel";

  const seen = new Set<string>();
  const classes: string[] = [];

  for (const token of [
    GLASS_BASE_CLASS,
    GLASS_VARIANT_CLASS[variant],
    ...(options.className ?? "").split(/\s+/),
  ]) {
    const name = token.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    classes.push(name);
  }

  return classes.join(" ");
}

/**
 * Converts {@link GlassTuning} into inline CSS custom properties.
 * Only explicitly supplied values are emitted, so an unset `blur`/`saturate`
 * keeps whatever the active variant token resolved to.
 */
export function buildGlassStyle(
  tuning: GlassTuning = {},
): Record<string, string> {
  const style: Record<string, string> = {};

  if (tuning.blur !== undefined) {
    style[GLASS_TOKEN.blur] = `${clampGlassBlur(tuning.blur)}px`;
  }
  if (tuning.saturate !== undefined) {
    style[GLASS_TOKEN.saturate] = `${clampGlassSaturate(tuning.saturate)}%`;
  }

  return style;
}

/**
 * Splits glass-only props from DOM props so `<GlassPanel blur={30}>` never
 * leaks a non-standard `blur` / `saturate` attribute onto the rendered element.
 */
export function splitGlassProps<T extends GlassTuning>(
  props: T,
): { glass: GlassTuning; rest: Omit<T, keyof GlassTuning> } {
  const { blur, saturate, ...rest } = props;

  const glass: GlassTuning = {};
  if (blur !== undefined) glass.blur = blur;
  if (saturate !== undefined) glass.saturate = saturate;

  return { glass, rest };
}
