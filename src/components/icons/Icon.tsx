/**
 * Icon — lightweight pointer to a symbol in the global SvgSprite sheet.
 *
 * Renders a single <svg> with a <use href="#icon-*"> reference.
 * Zero inline path data; the browser resolves the symbol from the
 * single sprite mounted in the root layout.
 *
 * IconId is imported from `./iconIds` (a plain data module) rather than
 * from `./SvgSprite` (a React component module) to prevent the bundler
 * from inadvertently pulling the full sprite sheet into any chunk that
 * only needs the Icon component.
 */
import React from "react";
import type { IconId } from "./iconIds";

interface IconProps {
  id: IconId;
  size?: number;
  className?: string;
  strokeWidth?: number;
  "aria-label"?: string;
}

const Icon = React.memo(function Icon({
  id,
  size = 16,
  className,
  strokeWidth = 2,
  "aria-label": ariaLabel,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <use href={`#${id}`} />
    </svg>
  );
});

Icon.displayName = "Icon";
export default Icon;
