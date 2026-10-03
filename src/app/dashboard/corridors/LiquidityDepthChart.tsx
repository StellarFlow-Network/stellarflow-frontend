"use client";

import { useEffect, useMemo, useState } from "react";
import { useCorridorStream } from "@/context/CorridorContext";
import type { OrderBookEntry } from "../../hooks/useCorridorMetrics";
import OrderBookDepthChart from "@/components/charts/OrderBookDepthChart";

type LiquidityDepthChartProps = {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  activePair: string;
};

function applyPriceDelta(
  entries: OrderBookEntry[],
  livePrice?: number,
  side?: "bid" | "ask",
): OrderBookEntry[] {
  if (!livePrice) return entries;

  return entries.map((entry, index) => {
    const drift = (livePrice - entry.price) * 0.0008;
    const multiplier = side === "ask" ? 1 + index * 0.005 : 1 - index * 0.003;
    const amount = Math.max(120, entry.amount + drift * 60 * multiplier);
    const total = Math.max(entry.total + amount * 0.06, entry.total + 10);

    return {
      price: entry.price + drift,
      amount,
      total,
    };
  });
}

/**
 * Live-updating wrapper around the shared `OrderBookDepthChart`. Subscribes
 * to the corridor price stream and nudges the mock bid/ask book on every
 * tick so the depth curves feel "live" on the monitor dashboard, then hands
 * the resulting book off to the presentational chart component.
 */
export default function LiquidityDepthChart({ bids, asks, activePair }: LiquidityDepthChartProps) {
  const { lastUpdate } = useCorridorStream();

  const [liveBids, setLiveBids] = useState<OrderBookEntry[]>(bids);
  const [liveAsks, setLiveAsks] = useState<OrderBookEntry[]>(asks);

  useEffect(() => {
    setLiveBids((prev) => applyPriceDelta(prev, lastUpdate?.price, "bid"));
  }, [lastUpdate?.price]);

  useEffect(() => {
    setLiveAsks((prev) => applyPriceDelta(prev, lastUpdate?.price, "ask"));
  }, [lastUpdate?.price]);

  useEffect(() => {
    setLiveBids(bids);
    setLiveAsks(asks);
  }, [bids, asks]);

  const bestBid = liveBids[0]?.price ?? 0;
  const bestAsk = liveAsks[0]?.price ?? 0;
  const midPrice = useMemo(() => (bestBid + bestAsk) / 2, [bestBid, bestAsk]);

  return (
    <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            Liquidity Depth
          </p>
          <p className="text-sm font-semibold text-neutral-200">{activePair}</p>
        </div>
        <div className="text-right text-[11px] text-neutral-400">
          <div>Best bid: <span className="text-emerald-400">{bestBid.toFixed(2)}</span></div>
          <div>Best ask: <span className="text-rose-400">{bestAsk.toFixed(2)}</span></div>
        </div>
      </div>

      <OrderBookDepthChart bids={liveBids} asks={liveAsks} height={192} />

      <div className="mt-2 text-right text-[11px] text-neutral-500">
        Mid: <span className="font-mono text-neutral-200">{midPrice.toFixed(2)}</span>
      </div>
    </div>
  );
}
