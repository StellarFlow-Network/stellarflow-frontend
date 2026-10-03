"use client";

import React from "react";
import Image from "next/image";
import { useAssetThemeColor, type UseAssetThemeColorOptions } from "@/hooks/ui/useAssetThemeColor";
import { Sparkles } from "lucide-react";

export interface AssetGlowCardProps {
  /** Logo image URL */
  logoSrc?: string;
  /** Token ticker symbol (e.g. USDC, XLM, ETH) */
  tokenSymbol?: string;
  /** Full token name */
  tokenName?: string;
  /** Card body contents */
  children?: React.ReactNode;
  /** Options for the theme color extractor */
  options?: UseAssetThemeColorOptions;
  /** Additional CSS class names */
  className?: string;
  /** Whether to display color badge in header */
  showColorBadge?: boolean;
}

/**
 * AssetGlowCard
 *
 * Renders a dark-theme card with dynamic ambient radial background glow
 * derived from the asset's logo color. Features smooth CSS opacity/background
 * transitions upon token selection.
 */
export function AssetGlowCard({
  logoSrc,
  tokenSymbol = "XLM",
  tokenName,
  children,
  options,
  className = "",
  showColorBadge = true,
}: AssetGlowCardProps) {
  const { hex, ambientGlowStyle, cardBorderStyle, isFallback, isLoading } =
    useAssetThemeColor(logoSrc, options);

  return (
    <div
      className={`relative rounded-2xl bg-[#161b22] border overflow-hidden p-5 sm:p-6 transition-all duration-300 ${className}`}
      style={{
        ...ambientGlowStyle,
        ...cardBorderStyle,
      }}
      data-testid="asset-glow-card"
    >
      {/* Subtle top ambient accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-colors duration-500"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${hex} 50%, transparent 100%)`,
        }}
      />

      {/* Header with Token Meta & Dynamic Color Badge */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <div className="relative h-10 w-10 rounded-full overflow-hidden bg-black/40 border border-gray-800 shrink-0">
              <Image
                src={logoSrc}
                alt={`${tokenSymbol} logo`}
                width={40}
                height={40}
                className="h-full w-full object-cover transition-opacity duration-300"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs text-white border border-white/20 shrink-0"
              style={{ backgroundColor: hex }}
            >
              {tokenSymbol.slice(0, 3)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-100">{tokenSymbol}</h3>
              {showColorBadge && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all duration-300"
                  style={{
                    backgroundColor: `${hex}22`,
                    color: hex,
                    borderColor: `${hex}44`,
                    borderWidth: 1,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  {hex}
                </span>
              )}
            </div>
            {tokenName && <p className="text-xs text-gray-400">{tokenName}</p>}
          </div>
        </div>

        {/* Ambient status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
          <Sparkles size={13} style={{ color: hex }} />
          <span>{isFallback ? "Default Glow" : "Dynamic Glow"}</span>
        </div>
      </div>

      {/* Card Content Slot */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AssetGlowCard;
