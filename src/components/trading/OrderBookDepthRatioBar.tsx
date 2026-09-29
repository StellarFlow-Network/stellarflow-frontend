"use client";

import React, { memo, useMemo, useState } from "react";
import type { OrderBookLevel, OrderBookSnapshot } from "@/types";
import type { AssetSymbol } from "@/config/assetSymbols";
import { useOrderBook } from "@/app/hooks/useOrderBook";

export interface DepthRatioResult {
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  bidRatio: number; // 0 - 100
  askRatio: number; // 0 - 100
}

/**
 * Calculates bid/ask volume ratio:
 * R_depth = (V_bids / (V_bids + V_asks)) * 100
 */
export function calculateDepthRatio(
  bids?: Array<{ amount: number }> | null,
  asks?: Array<{ amount: number }> | null,
  depth: number = 10,
): DepthRatioResult {
  const safeBids = Array.isArray(bids) ? bids.slice(0, depth) : [];
  const safeAsks = Array.isArray(asks) ? asks.slice(0, depth) : [];

  const bidVolume = safeBids.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  const askVolume = safeAsks.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  const totalVolume = bidVolume + askVolume;

  let bidRatio = 50;
  let askRatio = 50;

  if (totalVolume > 0) {
    bidRatio = (bidVolume / totalVolume) * 100;
    askRatio = (askVolume / totalVolume) * 100;
  }

  return {
    bidVolume,
    askVolume,
    totalVolume,
    bidRatio,
    askRatio,
  };
}

function formatVolumeCompact(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolumeExact(val: number): string {
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

interface RatioBarViewProps {
  bids?: OrderBookLevel[] | Array<{ amount: number; price?: number }>;
  asks?: OrderBookLevel[] | Array<{ amount: number; price?: number }>;
  depth?: number;
  showLabels?: boolean;
  showStatus?: boolean;
  isConnected?: boolean;
  className?: string;
  compact?: boolean;
  assetPair?: string;
}

function DepthRatioBarView({
  bids,
  asks,
  depth = 10,
  showLabels = true,
  showStatus = false,
  isConnected = false,
  className = "",
  compact = false,
  assetPair,
}: RatioBarViewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverSide, setHoverSide] = useState<"bid" | "ask" | null>(null);

  const { bidVolume, askVolume, totalVolume, bidRatio, askRatio } = useMemo(
    () => calculateDepthRatio(bids, asks, depth),
    [bids, asks, depth],
  );

  const formattedBidPercent = bidRatio.toFixed(1);
  const formattedAskPercent = askRatio.toFixed(1);

  return (
    <div
      className={`relative w-full select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoverSide(null);
      }}
    >
      {/* Top Labels */}
      {showLabels && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-400 font-semibold">
              Bids {formattedBidPercent}%
            </span>
            <span className="text-[10px] text-gray-400">
              ({formatVolumeCompact(bidVolume)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {showStatus && (
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-yellow-500"
                }`}
                title={isConnected ? "WebSocket Connected" : "Connecting..."}
              />
            )}
            {assetPair && (
              <span className="text-[10px] font-mono uppercase text-gray-500">
                {assetPair}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              ({formatVolumeCompact(askVolume)})
            </span>
            <span className="text-rose-400 font-semibold">
              {formattedAskPercent}% Asks
            </span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
        </div>
      )}

      {/* Progress Bar Container */}
      <div
        role="progressbar"
        aria-label="Order book depth ratio"
        aria-valuenow={Math.round(bidRatio)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`Bids: ${formattedBidPercent}%, Asks: ${formattedAskPercent}%`}
        className={`relative flex w-full overflow-hidden rounded-full bg-gray-800 shadow-inner ${
          compact ? "h-2" : "h-3.5"
        }`}
      >
        {/* Bids Segment (Green) */}
        <div
          data-testid="depth-ratio-bid-bar"
          onMouseEnter={() => setHoverSide("bid")}
          style={{ width: `${bidRatio}%` }}
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-300 ease-out hover:brightness-110 cursor-pointer"
        />

        {/* Center Split Marker */}
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-black/40 z-10 pointer-events-none" />

        {/* Asks Segment (Red) */}
        <div
          data-testid="depth-ratio-ask-bar"
          onMouseEnter={() => setHoverSide("ask")}
          style={{ width: `${askRatio}%` }}
          className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-300 ease-out hover:brightness-110 cursor-pointer"
        />
      </div>

      {/* Interactive Tooltip on Hover */}
      {isHovered && (
        <div
          data-testid="depth-ratio-tooltip"
          className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full z-30 pointer-events-none min-w-[220px] rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md transition-all duration-150"
        >
          <div className="mb-1.5 flex items-center justify-between border-b border-gray-800 pb-1 font-semibold text-gray-200">
            <span>Order Book Depth Ratio</span>
            <span className="font-mono text-[11px] text-gray-400">
              Depth: {depth} levels
            </span>
          </div>

          <div className="space-y-1">
            {/* Bid Metric */}
            <div
              className={`flex items-center justify-between transition-colors ${
                hoverSide === "bid" ? "text-emerald-300 font-bold" : "text-gray-300"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Total Bids (Buy):</span>
              </div>
              <div className="font-mono text-right">
                <span className="text-emerald-400 font-semibold">{formattedBidPercent}%</span>
                <span className="ml-1 text-[10px] text-gray-400">({formatVolumeExact(bidVolume)})</span>
              </div>
            </div>

            {/* Ask Metric */}
            <div
              className={`flex items-center justify-between transition-colors ${
                hoverSide === "ask" ? "text-rose-300 font-bold" : "text-gray-300"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                <span>Total Asks (Sell):</span>
              </div>
              <div className="font-mono text-right">
                <span className="text-rose-400 font-semibold">{formattedAskPercent}%</span>
                <span className="ml-1 text-[10px] text-gray-400">({formatVolumeExact(askVolume)})</span>
              </div>
            </div>

            {/* Total Volume */}
            <div className="flex items-center justify-between border-t border-gray-800/80 pt-1 text-[11px] text-gray-400">
              <span>Combined Depth Volume:</span>
              <span className="font-mono font-medium text-gray-200">
                {formatVolumeExact(totalVolume)}
              </span>
            </div>
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900/95" />
        </div>
      )}
    </div>
  );
}

/**
 * Inner component that hooks into the live WebSocket feed when assetId is provided.
 */
function LiveOrderBookDepthRatioBar({
  assetId,
  depth = 10,
  showLabels = true,
  className = "",
  compact = false,
}: {
  assetId: AssetSymbol;
  depth?: number;
  showLabels?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { orderBook, isConnected } = useOrderBook({ assetId, depth });

  return (
    <DepthRatioBarView
      bids={orderBook?.bids}
      asks={orderBook?.asks}
      depth={depth}
      showLabels={showLabels}
      showStatus={true}
      isConnected={isConnected}
      className={className}
      compact={compact}
      assetPair={assetId}
    />
  );
}

export interface OrderBookDepthRatioBarProps {
  /** Optional assetId to subscribe to live WebSocket updates */
  assetId?: AssetSymbol;
  /** Explicit bids array (used directly or as fallback) */
  bids?: OrderBookLevel[] | Array<{ amount: number; price?: number }>;
  /** Explicit asks array (used directly or as fallback) */
  asks?: OrderBookLevel[] | Array<{ amount: number; price?: number }>;
  /** Complete order book snapshot */
  orderBook?: OrderBookSnapshot | null;
  /** Number of depth levels to calculate (default 10) */
  depth?: number;
  /** Show text percentage labels above the bar */
  showLabels?: boolean;
  /** Show live connection indicator dot */
  showStatus?: boolean;
  /** Custom container class */
  className?: string;
  /** Compact mode with smaller padding and height */
  compact?: boolean;
}

/**
 * OrderBookDepthRatioBar
 *
 * Real-time order book depth ratio indicator bar displaying relative balance
 * between total bid and ask volumes with dual-color progress bar and hover tooltip.
 */
export const OrderBookDepthRatioBar = memo(function OrderBookDepthRatioBar({
  assetId,
  bids,
  asks,
  orderBook,
  depth = 10,
  showLabels = true,
  showStatus = false,
  className = "",
  compact = false,
}: OrderBookDepthRatioBarProps) {
  // If explicit bids/asks or orderBook are passed, render view directly
  const explicitBids = bids ?? orderBook?.bids;
  const explicitAsks = asks ?? orderBook?.asks;

  if (explicitBids !== undefined || explicitAsks !== undefined || !assetId) {
    return (
      <DepthRatioBarView
        bids={explicitBids}
        asks={explicitAsks}
        depth={depth}
        showLabels={showLabels}
        showStatus={showStatus}
        isConnected={Boolean(orderBook)}
        className={className}
        compact={compact}
        assetPair={orderBook?.assetPair}
      />
    );
  }

  // Otherwise subscribe dynamically to live WebSocket updates for assetId
  return (
    <LiveOrderBookDepthRatioBar
      assetId={assetId}
      depth={depth}
      showLabels={showLabels}
      className={className}
      compact={compact}
    />
  );
});

export default OrderBookDepthRatioBar;
