/**
 * src/components/glass/GlassPanel.tsx
 *
 * Base glassmorphism surface. Renders the fallback-safe `.glass-surface`
 * recipe (see `src/app/globals.css`) plus a density preset:
 *
 *   - `.glass-surface`      opaque fallback background, upgraded to
 *                           `backdrop-filter: blur()` only when `@supports`
 *                           confirms the engine can blur the backdrop.
 *   - `.glass-<variant>`    density preset (surface opacity + blur radius).
 *
 * `blur` and `saturate` tune the backdrop filter for this instance only and
 * are stripped from the rendered DOM by `splitGlassProps`.
 */

import React from "react";

import {
  buildGlassStyle,
  resolveGlassClassName,
  splitGlassProps,
  type GlassTuning,
  type GlassVariant,
} from "./glassTheme";

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    GlassTuning {
  /** Density preset. Defaults to `panel`. */
  variant?: GlassVariant;
}

export function GlassPanel({
  variant = "panel",
  className,
  style,
  children,
  ...rest
}: GlassPanelProps) {
  const { glass, rest: domProps } = splitGlassProps(rest);
  const classes = resolveGlassClassName({
    variant,
    className: `border ${className ?? ""}`,
  });

  return (
    <div
      {...domProps}
      data-glass-variant={variant}
      className={classes}
      style={{ ...buildGlassStyle(glass), ...style }}
    >
      {children}
    </div>
  );
}

export default GlassPanel;
