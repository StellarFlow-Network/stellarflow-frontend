"use client";

/**
 * TickAggregationController — Issue #969
 *
 * Precision tick-grouping controls for the live order book. Traders pick a
 * tick step size (e.g. 0.001 / 0.01 / 0.1 / 1) and every price level inside a
 * step is merged into one aggregated row: size is summed per bucket and the
 * cumulative depth used by the visual depth bars is recomputed from the
 * aggregated volumes.
 *
 * The component owns its own `useOrderBook` subscription but the tick step is
 * deliberately *not* part of the subscription deps — the hook's callbacks only
 * depend on `assetId` / `depth` / visibility, so changing the tick only re-runs
 * the memoised aggregation and never tears down the WebSocket consumer.
 *
 * The user's preferred tick step is persisted per market in localStorage via
 * the shared `@/utils/storage` envelope so it survives reloads and stays
 * independent for each trading pair.
 */

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useOrderBook } from "@/app/hooks/useOrderBook";
import type { AssetSymbol } from "@/config/assetSymbols";
import { getItem, setItem } from "@/utils/storage";
import {
  aggregateLevels,
  computeDepthRatios,
  decimalsForTick,
  getDefaultTickSize,
  getTickStepOptions,
  parseTickSize,
  tickPreferenceKey,
  type AggregatedLevel,
  type OrderBookSide,
} from "./tickAggregation";

export interface TickAggregationControllerProps {
  assetId: AssetSymbol;
  /** Raw price levels requested from the socket per side. Defaults to 20. */
  depth?: number;
  /** Called with the newly selected tick step whenever the user changes it. */
  onTickSizeChange?: (tickSize: number) => void;
  className?: string;
}

interface DepthColumnProps {
  side: OrderBookSide;
  levels: AggregatedLevel[];
  tickSize: number;
}

function isPositiveTick(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatPrice(value: number, tickSize: number): string {
  const decimals = Math.min(Math.max(decimalsForTick(tickSize), 2), 8);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatTickLabel(tickSize: number): string {
  return tickSize.toFixed(decimalsForTick(tickSize));
}

function DepthColumn({ side, levels, tickSize }: DepthColumnProps) {
  const isBid = side === "bid";

  return (
    <div className="min-w-0" data-testid={`tick-depth-${side}`}>
      <div className="mb-1.5 grid grid-cols-3 text-[9px] font-semibold uppercase tracking-widest text-gray-600">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Cum.</span>
      </div>
      <div className="space-y-0.5">
        {levels.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-gray-600">No levels</p>
        ) : (
          levels.map((level) => (
            <div
              key={`${side}-${level.price}`}
              className="relative grid grid-cols-3 py-0.5 font-mono text-xs"
            >
              <span
                className={`absolute inset-y-0 ${
                  isBid ? "right-0 bg-emerald-500/10" : "left-0 bg-rose-500/10"
                }`}
                style={{ width: `${level.depthRatio * 100}%` }}
                aria-hidden="true"
              />
              <span className={`relative ${isBid ? "text-emerald-400" : "text-rose-400"}`}>
                {formatPrice(level.price, tickSize)}
              </span>
              <span className="relative text-right text-gray-300">
                {formatAmount(level.amount)}
              </span>
              <span className="relative text-right text-gray-500">
                {formatAmount(level.total)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TickAggregationController({
  assetId,
  depth = 20,
  onTickSizeChange,
  className = "",
}: TickAggregationControllerProps) {
  const { orderBook, isConnected } = useOrderBook({ assetId, depth });

  const options = useMemo(() => getTickStepOptions(assetId), [assetId]);
  const marketDefault = useMemo(() => getDefaultTickSize(assetId), [assetId]);

  // Initialise from the market default so the server and first client render
  // agree; the persisted per-market preference is applied after mount.
  const [tickSize, setTickSize] = useState<number>(marketDefault);

  useEffect(() => {
    const stored = getItem<number>(tickPreferenceKey(assetId), isPositiveTick);
    setTickSize(parseTickSize(stored, options, marketDefault));
  }, [assetId, options, marketDefault]);

  const handleTickChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = parseTickSize(event.target.value, options, marketDefault);
      setTickSize(next);
      setItem(tickPreferenceKey(assetId), next);
      onTickSizeChange?.(next);
    },
    [assetId, marketDefault, onTickSizeChange, options],
  );

  // Re-aggregation is a pure memo over the last snapshot + tick step; it never
  // touches the socket subscription above.
  const aggregated = useMemo(() => {
    if (!orderBook) return null;

    const bids = aggregateLevels(orderBook.bids, tickSize, "bid", depth);
    const asks = aggregateLevels(orderBook.asks, tickSize, "ask", depth);
    const reference = Math.max(
      bids.length > 0 ? bids[bids.length - 1].total : 0,
      asks.length > 0 ? asks[asks.length - 1].total : 0,
      1,
    );

    return {
      bids: computeDepthRatios(bids, reference),
      asks: computeDepthRatios(asks, reference),
    };
  }, [orderBook, tickSize, depth]);

  const bestBid = orderBook?.bids[0]?.price ?? 0;
  const bestAsk = orderBook?.asks[0]?.price ?? 0;
  const spread = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : 0;
  const bucketCount = aggregated
    ? aggregated.bids.length + aggregated.asks.length
    : 0;

  return (
    <section
      className={`rounded-2xl border border-[#1B2A3B] bg-[#0A121E] p-4 shadow-lg ${className}`}
      aria-label={`Aggregated order book depth for ${assetId}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
            Depth Aggregation
          </p>
          <h3 className="mt-0.5 text-base font-black tracking-tight text-white">{assetId}</h3>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="tick-size-select"
            className="text-[10px] font-semibold uppercase tracking-widest text-gray-500"
          >
            Tick
          </label>
          <select
            id="tick-size-select"
            data-testid="tick-step-select"
            aria-label={`Tick step size for ${assetId}`}
            value={tickSize}
            onChange={handleTickChange}
            className="rounded-md border border-[#1B2A3B] bg-[#0A121E] px-2 py-1 font-mono text-xs text-gray-200 focus:border-cyan-400 focus:outline-none"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {formatTickLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 text-[10px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? "bg-[#39FF14]" : "bg-yellow-500"
            }`}
          />
          {isConnected ? "LIVE" : "OFF"}
        </span>
        <span className="font-mono">Spread: {spread.toFixed(4)}</span>
        <span className="font-mono">{bucketCount} buckets</span>
      </div>

      {!aggregated ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-1.5">
              {Array.from({ length: Math.min(depth, 8) }).map((_, i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded bg-white/5" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <DepthColumn side="bid" levels={aggregated.bids} tickSize={tickSize} />
          <DepthColumn side="ask" levels={aggregated.asks} tickSize={tickSize} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[#1B2A3B] pt-3">
        <span className="font-mono text-[9px] text-gray-700">
          Tick step {formatTickLabel(tickSize)}
        </span>
        <span className="font-mono text-[9px] tracking-widest text-gray-700">
          STELLARFLOW DEPTH
        </span>
      </div>
    </section>
  );
}

export default TickAggregationController;
