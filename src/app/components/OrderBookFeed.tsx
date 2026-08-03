"use client";

import React, { memo } from "react";
import { useOrderBook } from "@/app/hooks/useOrderBook";
import { useMounted } from "@/app/hooks/useMounted";
import type { AssetSymbol } from "@/config/assetSymbols";

interface OrderBookFeedProps {
  assetId: AssetSymbol;
  /** Number of price levels to show per side. Defaults to 8. */
  depth?: number;
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function OrderBookSkeleton({ depth }: { depth: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-1.5">
          {Array.from({ length: depth }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ))}
    </div>
  );
}

function OrderBookFeed({ assetId, depth = 8 }: OrderBookFeedProps) {
  const mounted = useMounted();
  const { orderBook, isConnected } = useOrderBook({ assetId, depth });

  const maxTotal = orderBook
    ? Math.max(
        orderBook.bids[orderBook.bids.length - 1]?.total ?? 0,
        orderBook.asks[orderBook.asks.length - 1]?.total ?? 0,
        1,
      )
    : 1;

  return (
    <div className="relative h-full max-w-full overflow-hidden rounded-2xl border border-[#1B2A3B] bg-[#0A121E] p-6 shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
            Order Book
          </p>
          <h3 className="mt-0.5 text-base font-black tracking-tight text-white">{assetId}</h3>
        </div>

        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
            mounted && isConnected
              ? "border-[#39FF14]/20 bg-[#39FF14]/10 text-[#39FF14]"
              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                mounted && isConnected ? "animate-ping bg-[#39FF14] opacity-60" : "bg-yellow-500 opacity-60"
              }`}
            />
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                mounted && isConnected ? "bg-[#39FF14]" : "bg-yellow-500"
              }`}
            />
          </span>
          {mounted && isConnected ? "LIVE" : "OFF"}
        </span>
      </div>

      {!mounted || !orderBook ? (
        <OrderBookSkeleton depth={depth} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Bids */}
          <div className="min-w-0">
            <div className="mb-1.5 grid grid-cols-2 text-[9px] font-semibold uppercase tracking-widest text-gray-600">
              <span>Price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="space-y-0.5">
              {orderBook.bids.map((level) => (
                <div
                  key={level.price}
                  className="relative grid grid-cols-2 py-0.5 font-mono text-xs"
                >
                  <span
                    className="absolute inset-y-0 right-0 bg-emerald-500/10"
                    style={{ width: `${Math.min(100, (level.total / maxTotal) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative text-emerald-400">{formatPrice(level.price)}</span>
                  <span className="relative text-right text-gray-300">
                    {formatAmount(level.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Asks */}
          <div className="min-w-0">
            <div className="mb-1.5 grid grid-cols-2 text-[9px] font-semibold uppercase tracking-widest text-gray-600">
              <span>Price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="space-y-0.5">
              {orderBook.asks.map((level) => (
                <div
                  key={level.price}
                  className="relative grid grid-cols-2 py-0.5 font-mono text-xs"
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-rose-500/10"
                    style={{ width: `${Math.min(100, (level.total / maxTotal) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative text-rose-400">{formatPrice(level.price)}</span>
                  <span className="relative text-right text-gray-300">
                    {formatAmount(level.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[#1B2A3B] pt-3">
        <span className="font-mono text-[9px] text-gray-700">
          {orderBook ? `Updated ${new Date(orderBook.timestamp).toLocaleTimeString()}` : "—"}
        </span>
        <span className="font-mono text-[9px] tracking-widest text-gray-700">
          STELLARFLOW ORDER BOOK
        </span>
      </div>
    </div>
  );
}

export default memo(OrderBookFeed);
