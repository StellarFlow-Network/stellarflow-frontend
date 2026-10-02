/**
 * src/components/glass/GlassCard.tsx
 *
 * Rounded card built on {@link GlassPanel}. Use it for content blocks, stat
 * tiles and option summaries that sit on top of the app background.
 *
 * `interactive` only swaps colours/borders on hover — it deliberately avoids a
 * translate/scale lift, because transforming a backdrop-filtered element makes
 * the compositor re-sample the backdrop on every frame.
 */

import React from "react";

import { GlassPanel, type GlassPanelProps } from "./GlassPanel";

export interface GlassCardProps extends GlassPanelProps {
  /** Adds a hover/focus border highlight so the card reads as actionable. */
  interactive?: boolean;
}

export function GlassCard({
  variant = "panel",
  interactive = false,
  className,
  children,
  ...rest
}: GlassCardProps) {
  const interactiveClasses = interactive
    ? "cursor-pointer transition-colors duration-200 hover:border-white/25 focus-visible:border-white/40"
    : "";

  return (
    <GlassPanel
      {...rest}
      variant={variant}
      className={`rounded-2xl p-5 ${interactiveClasses} ${className ?? ""}`}
    >
      {children}
    </GlassPanel>
  );
}

export default GlassCard;
