"use client";

import React from "react";

const CORRIDOR_SPRITE = "/corridor-sprite.svg";

const ASSET_SYMBOL_IDS: Record<string, string> = {
  USD: "corridor-asset-usd",
  NGN: "corridor-asset-ngn",
  XLM: "corridor-asset-xlm",
  KES: "corridor-asset-kes",
  GHS: "corridor-asset-ghs",
};

export function corridorAssetSymbolId(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return ASSET_SYMBOL_IDS[normalized] ?? null;
}

interface CorridorAssetIconProps {
  code: string;
  size?: number;
  className?: string;
}

export const CorridorAssetIcon = React.memo(function CorridorAssetIcon({
  code,
  size = 18,
  className,
}: CorridorAssetIconProps) {
  const symbolId = corridorAssetSymbolId(code);
  if (!symbolId) {
    return null;
  }

  return (
    <svg
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <use href={`${CORRIDOR_SPRITE}#${symbolId}`} />
    </svg>
  );
});

CorridorAssetIcon.displayName = "CorridorAssetIcon";

interface CorridorSpriteIconProps {
  symbolId: string;
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export const CorridorSpriteIcon = React.memo(function CorridorSpriteIcon({
  symbolId,
  size = 20,
  className,
  "aria-label": ariaLabel,
}: CorridorSpriteIconProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <use href={`${CORRIDOR_SPRITE}#${symbolId}`} />
    </svg>
  );
});

CorridorSpriteIcon.displayName = "CorridorSpriteIcon";

export function parseCorridorPairCodes(pair: string): [string, string] | null {
  const segments = pair
    .split(" / ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  return [segments[0], segments[1]];
}
