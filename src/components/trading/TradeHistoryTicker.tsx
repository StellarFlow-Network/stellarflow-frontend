"use client";

import { useEffect, useRef, useState } from "react";
import type { AmmTradeEvent } from "@/types";
import { useAmmTrades } from "@/app/hooks/useAmmTrades";

const MAX_TRADES = 50;

interface TradeRow extends AmmTradeEvent {
  localId: number;
}

export interface TradeHistoryTickerProps {
  poolId?: string;
  className?: string;
}

function formatPrice(price?: number): string {
  if (price == null || !Number.isFinite(price)) return "Price unavailable";
  return price.toLocaleString(undefined, { maximumSignificantDigits: 9 });
}

function formatSize(size: number): string {
  return Number.isFinite(size)
    ? size.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })
    : "Unavailable";
}

function formatTime(timestamp: number): string {
  const milliseconds = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toLocaleTimeString()
    : "--:--:--";
}

function isoTimestamp(timestamp: number): string | undefined {
  const milliseconds = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  if (!Number.isFinite(milliseconds)) return undefined;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function TradeHistoryTicker({ poolId, className = "" }: TradeHistoryTickerProps) {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const pendingTradesRef = useRef<TradeRow[]>([]);
  const frameRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const { isConnected } = useAmmTrades({
    poolId,
    onTrade: (trade) => {
      pendingTradesRef.current.push({ ...trade, localId: ++sequenceRef.current });
      if (pendingTradesRef.current.length > MAX_TRADES) {
        pendingTradesRef.current.splice(0, pendingTradesRef.current.length - MAX_TRADES);
      }
      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const batch = pendingTradesRef.current.splice(0, MAX_TRADES);
        setTrades((current) => [...batch.reverse(), ...current].slice(0, MAX_TRADES));
      });
    },
  });

  return (
    <section className={`overflow-hidden border border-white/10 bg-[#101820] text-white ${className}`} aria-label="Recent trade executions">
      <style>{`
        @keyframes trade-buy-flash { 0% { background: rgb(16 185 129 / .3); } 100% { background: transparent; } }
        @keyframes trade-sell-flash { 0% { background: rgb(244 63 94 / .3); } 100% { background: transparent; } }
        .trade-buy-flash { animation: trade-buy-flash 850ms ease-out; }
        .trade-sell-flash { animation: trade-sell-flash 850ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .trade-buy-flash, .trade-sell-flash { animation: none; } }
      `}</style>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">Recent trades</h2>
        <span className="flex items-center gap-2 text-xs text-slate-400" aria-label={isConnected ? "Live feed connected" : "Live feed disconnected"}>
          <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden="true" />
          {isConnected ? "Live" : "Disconnected"}
        </span>
      </header>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 border-b border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Price</span><span>Side / pool</span><span className="text-right">Size · time</span>
      </div>
      <ol className="max-h-[420px] divide-y divide-white/5 overflow-y-auto" aria-live="off">
        {trades.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">Waiting for executions</li>
        ) : trades.map((trade) => {
          const priceTone = trade.side === "buy"
            ? "text-emerald-300 trade-buy-flash"
            : trade.side === "sell"
              ? "text-rose-300 trade-sell-flash"
              : "text-slate-200";
          return (
            <li key={trade.localId} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 px-4 py-2.5 text-xs">
              <span className={`w-fit rounded-sm px-1.5 py-1 font-mono ${priceTone}`}>
                {formatPrice(trade.price)}
              </span>
              <span className="min-w-0 truncate text-slate-300">
                {trade.side ? trade.side.toUpperCase() : "TRADE"} · {trade.assetPair ?? trade.poolId}
              </span>
              <span className="text-right">
                <span className="block font-mono text-slate-200">{formatSize(trade.volumeUsd)}</span>
                <time className="mt-0.5 block text-[10px] text-slate-500" dateTime={isoTimestamp(trade.timestamp)}>
                  {formatTime(trade.timestamp)}
                </time>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default TradeHistoryTicker;