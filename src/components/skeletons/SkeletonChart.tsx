"use client";

import React from "react";
import { Shimmer } from "./Shimmer";

interface SkeletonChartProps {
  /**
   * Variant of the chart skeleton
   * - price: Matches TokenPriceChart with timeframe controls and indicators
   * - liquidity: Matches LiquidityDepthChart layout
   * - portfolio: Matches PortfolioHistoryChart layout
   * - allocation: Matches PortfolioAllocationChart (pie/donut chart)
   * - orderbook: Matches OrderBookDepthChart layout
   * - apy: Matches APY trend charts with simple line display
   */
  variant?: "price" | "liquidity" | "portfolio" | "allocation" | "orderbook" | "apy";
  /**
   * Chart container height in pixels
   */
  height?: number;
  /**
   * Show timeframe selector controls
   */
  showTimeframes?: boolean;
  /**
   * Show indicator controls
   */
  showIndicators?: boolean;
  /**
   * Custom className for wrapper
   */
  className?: string;
}

/**
 * SkeletonChart - Animated loading skeleton for chart components
 * 
 * Matches exact dimensions and control layouts of various chart types to eliminate
 * layout shift during loading. Default height matches standard chart containers.
 * Uses Shimmer component for smooth linear gradient animation.
 * 
 * @example
 * ```tsx
 * // Replace TokenPriceChart during loading
 * {isLoading ? (
 *   <SkeletonChart variant="price" height={400} showTimeframes showIndicators />
 * ) : (
 *   <TokenPriceChart pairId={pairId} {...props} />
 * )}
 * ```
 */
export const SkeletonChart = React.memo(function SkeletonChart({
  variant = "price",
  height = 400,
  showTimeframes = true,
  showIndicators = false,
  className = "",
}: SkeletonChartProps) {
  switch (variant) {
    case "price":
      return (
        <PriceChartSkeleton
          height={height}
          showTimeframes={showTimeframes}
          showIndicators={showIndicators}
          className={className}
        />
      );
    case "liquidity":
      return <LiquidityChartSkeleton height={height} className={className} />;
    case "portfolio":
      return <PortfolioChartSkeleton height={height} showTimeframes={showTimeframes} className={className} />;
    case "allocation":
      return <AllocationChartSkeleton height={height} className={className} />;
    case "orderbook":
      return <OrderBookChartSkeleton height={height} className={className} />;
    case "apy":
      return <ApyChartSkeleton height={height} className={className} />;
    default:
      return (
        <PriceChartSkeleton
          height={height}
          showTimeframes={showTimeframes}
          showIndicators={showIndicators}
          className={className}
        />
      );
  }
});

/**
 * PriceChartSkeleton - Matches TokenPriceChart layout
 * Includes header with pair info, timeframe controls, indicator toggles, and main chart area
 */
function PriceChartSkeleton({
  height,
  showTimeframes,
  showIndicators,
  className,
}: {
  height: number;
  showTimeframes: boolean;
  showIndicators: boolean;
  className: string;
}) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Chart Header - pair info and current price */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-neutral-800">
        <div className="space-y-2">
          {/* Token pair */}
          <Shimmer className="h-6 w-32 rounded-md" />
          {/* Current price and change */}
          <div className="flex items-center gap-3">
            <Shimmer className="h-8 w-28 rounded-md" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
        </div>
        {/* Refresh button */}
        <Shimmer className="h-9 w-9 rounded-lg" />
      </div>

      {/* Controls Row - Timeframes and Indicators */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Timeframe selector */}
        {showTimeframes && (
          <div className="flex items-center gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Shimmer key={`tf-${index}`} className="h-8 w-12 rounded-lg" />
            ))}
          </div>
        )}

        {/* Indicator toggles */}
        {showIndicators && (
          <div className="flex items-center gap-2">
            <Shimmer className="h-8 w-20 rounded-lg" />
            <Shimmer className="h-8 w-24 rounded-lg" />
            <Shimmer className="h-8 w-16 rounded-lg" />
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div
        className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
        style={{ height: `${height}px` }}
      >
        {/* Chart placeholder with animated bars suggesting candlesticks */}
        <div className="h-full flex items-end justify-around gap-1 px-4">
          {Array.from({ length: 24 }).map((_, index) => {
            // Randomized heights for visual interest
            const heightPercent = 40 + (index % 5) * 10;
            return (
              <Shimmer
                key={`bar-${index}`}
                className="flex-1 rounded-t-sm"
                style={{ height: `${heightPercent}%`, maxWidth: "16px" }}
              />
            );
          })}
        </div>
      </div>

      {/* Chart Stats Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
        <div className="flex items-center gap-6">
          <div className="space-y-1">
            <Shimmer className="h-3 w-16 rounded-md" />
            <Shimmer className="h-4 w-20 rounded-md" />
          </div>
          <div className="space-y-1">
            <Shimmer className="h-3 w-16 rounded-md" />
            <Shimmer className="h-4 w-20 rounded-md" />
          </div>
          <div className="space-y-1">
            <Shimmer className="h-3 w-16 rounded-md" />
            <Shimmer className="h-4 w-20 rounded-md" />
          </div>
        </div>
        <Shimmer className="h-4 w-32 rounded-md" />
      </div>
    </div>
  );
}

/**
 * LiquidityChartSkeleton - Matches LiquidityDepthChart layout
 * Shows bid/ask depth visualization
 */
function LiquidityChartSkeleton({ height, className }: { height: number; className: string }) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
        <Shimmer className="h-5 w-36 rounded-md" />
        <div className="flex items-center gap-3">
          <Shimmer className="h-6 w-20 rounded-full" />
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* Chart Area - Area chart style with gradients */}
      <div
        className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
        style={{ height: `${height}px` }}
      >
        <div className="h-full flex items-end gap-px">
          {/* Left side - Bids (green gradient) */}
          <div className="flex-1 flex items-end justify-start gap-px">
            {Array.from({ length: 12 }).map((_, index) => (
              <Shimmer
                key={`bid-${index}`}
                className="flex-1 rounded-t-sm"
                style={{ height: `${30 + index * 5}%`, maxWidth: "12px" }}
              />
            ))}
          </div>
          {/* Center divider */}
          <div className="w-px bg-neutral-700 h-full" />
          {/* Right side - Asks (red gradient) */}
          <div className="flex-1 flex items-end justify-end gap-px">
            {Array.from({ length: 12 }).map((_, index) => (
              <Shimmer
                key={`ask-${index}`}
                className="flex-1 rounded-t-sm"
                style={{ height: `${90 - index * 5}%`, maxWidth: "12px" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <Shimmer className="h-3 w-3 rounded-full" />
          <Shimmer className="h-3 w-12 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="h-3 w-3 rounded-full" />
          <Shimmer className="h-3 w-12 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * PortfolioChartSkeleton - Matches PortfolioHistoryChart layout
 * Line chart with timeframe controls
 */
function PortfolioChartSkeleton({
  height,
  showTimeframes,
  className,
}: {
  height: number;
  showTimeframes: boolean;
  className: string;
}) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header with value and timeframes */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <Shimmer className="h-4 w-28 rounded-md" />
          <Shimmer className="h-8 w-36 rounded-md" />
          <Shimmer className="h-4 w-24 rounded-full" />
        </div>
        {showTimeframes && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <Shimmer key={`ptf-${index}`} className="h-7 w-10 rounded-md" />
            ))}
          </div>
        )}
      </div>

      {/* Chart Area - Smooth line chart */}
      <div
        className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
        style={{ height: `${height}px` }}
      >
        <Shimmer className="h-full w-full rounded-md" />
      </div>
    </div>
  );
}

/**
 * AllocationChartSkeleton - Matches PortfolioAllocationChart (Pie/Donut chart)
 */
function AllocationChartSkeleton({ height, className }: { height: number; className: string }) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header */}
      <div className="mb-4">
        <Shimmer className="h-5 w-40 rounded-md" />
      </div>

      {/* Chart and Legend Grid */}
      <div className="grid md:grid-cols-2 gap-6 items-center">
        {/* Donut Chart */}
        <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
          <Shimmer className="rounded-full" style={{ width: `${height * 0.8}px`, height: `${height * 0.8}px` }} />
        </div>

        {/* Legend */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`legend-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Shimmer className="h-3 w-3 rounded-full" />
                <Shimmer className="h-4 w-20 rounded-md" />
              </div>
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-4 w-12 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * OrderBookChartSkeleton - Matches OrderBookDepthChart layout
 * Horizontal bar chart showing order book depth
 */
function OrderBookChartSkeleton({ height, className }: { height: number; className: string }) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-neutral-800">
        <Shimmer className="h-5 w-28 rounded-md" />
        <Shimmer className="h-7 w-24 rounded-lg" />
      </div>

      {/* Order Book Grid */}
      <div className="grid grid-cols-2 gap-4" style={{ height: `${height}px` }}>
        {/* Bids */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs mb-2">
            <Shimmer className="h-3 w-12 rounded-md" />
            <Shimmer className="h-3 w-12 rounded-md" />
            <Shimmer className="h-3 w-12 rounded-md" />
          </div>
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`bid-order-${index}`} className="flex items-center justify-between gap-2">
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-4 w-full max-w-[60px] rounded-md" style={{ width: `${100 - index * 8}%` }} />
            </div>
          ))}
        </div>

        {/* Asks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs mb-2">
            <Shimmer className="h-3 w-12 rounded-md" />
            <Shimmer className="h-3 w-12 rounded-md" />
            <Shimmer className="h-3 w-12 rounded-md" />
          </div>
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`ask-order-${index}`} className="flex items-center justify-between gap-2">
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-4 w-16 rounded-md" />
              <Shimmer className="h-4 w-full max-w-[60px] rounded-md" style={{ width: `${60 + index * 4}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ApyChartSkeleton - Matches simple APY trend charts (like in VaultCard)
 * Compact line chart without heavy controls
 */
function ApyChartSkeleton({ height, className }: { height: number; className: string }) {
  return (
    <div
      className={`rounded-xl border border-neutral-800 bg-neutral-950 p-3 ${className}`}
      style={{ contain: "layout paint", height: `${height}px` }}
    >
      {/* Simple line chart representation */}
      <div className="h-full flex items-end gap-1">
        {Array.from({ length: 40 }).map((_, index) => {
          // Create wave pattern for visual interest
          const heightPercent = 30 + Math.sin(index / 5) * 20 + 20;
          return (
            <Shimmer
              key={`apy-bar-${index}`}
              className="flex-1 rounded-t-sm"
              style={{ height: `${heightPercent}%`, maxWidth: "8px" }}
            />
          );
        })}
      </div>
    </div>
  );
}
