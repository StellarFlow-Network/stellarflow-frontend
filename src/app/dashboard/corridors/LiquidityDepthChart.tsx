"use client";

import { useEffect, useMemo, useState } from "react";
import { useCorridorStream } from "@/context/CorridorContext";
import type { OrderBookEntry } from "../../hooks/useCorridorMetrics";

type LiquidityDepthChartProps = {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  activePair: string;
};

type DepthPoint = {
  price: number;
  cumulativeVolume: number;
  amount: number;
  total: number;
  x: number;
  y: number;
};

type DepthSeries = {
  side: "bid" | "ask";
  points: DepthPoint[];
  path: string;
  stroke: string;
  fill: string;
};

type HoverPoint = {
  side: "bid" | "ask";
  price: number;
  cumulativeVolume: number;
  x: number;
  y: number;
} | null;

function buildPath(points: DepthPoint[]) {
  if (points.length === 0) return "";

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function createDepthSeries(
  entries: OrderBookEntry[],
  side: "bid" | "ask",
  width: number,
  height: number,
  minPrice: number,
  maxPrice: number,
  maxVolume: number,
): DepthSeries {
  const points = entries.map((entry, index) => {
    const cumulativeVolume = entries
      .slice(0, index + 1)
      .reduce((sum, item) => sum + item.total, 0);

    const x = ((entry.price - minPrice) / Math.max(maxPrice - minPrice, 1)) * width;
    const y = height - (cumulativeVolume / Math.max(maxVolume, 1)) * height;

    return {
      price: entry.price,
      cumulativeVolume,
      amount: entry.amount,
      total: entry.total,
      x,
      y,
    };
  });

  return {
    side,
    points,
    path: buildPath(points),
    stroke: side === "bid" ? "#34d399" : "#f87171",
    fill: side === "bid" ? "rgba(52, 211, 153, 0.16)" : "rgba(248, 113, 113, 0.16)",
  };
}

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

export default function LiquidityDepthChart({ bids, asks, activePair }: LiquidityDepthChartProps) {
  const { lastUpdate } = useCorridorStream();
  const [hoverPoint, setHoverPoint] = useState<HoverPoint>(null);

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

  const chartData = useMemo(() => {
    const allEntries = [...liveBids, ...liveAsks];
    const prices = allEntries.map((entry) => entry.price);
    const minPrice = Math.min(...prices) - 0.3;
    const maxPrice = Math.max(...prices) + 0.3;
    const maxVolume = Math.max(
      ...allEntries.map((entry) => entry.total),
      1,
    );

    return {
      width: 320,
      height: 180,
      minPrice,
      maxPrice,
      maxVolume,
      bids: createDepthSeries(liveBids, "bid", 320, 180, minPrice, maxPrice, maxVolume),
      asks: createDepthSeries(liveAsks, "ask", 320, 180, minPrice, maxPrice, maxVolume),
    };
  }, [liveBids, liveAsks]);

  const bestBid = liveBids[0]?.price ?? 0;
  const bestAsk = liveAsks[0]?.price ?? 0;
  const midPrice = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;

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

      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80">
        <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="h-48 w-full">
          <line x1="0" y1={chartData.height} x2={chartData.width} y2={chartData.height} stroke="#2a2f38" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2={chartData.height} stroke="#2a2f38" strokeWidth="1" />

          <path d={chartData.asks.path} fill="none" stroke={chartData.asks.stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d={chartData.bids.path} fill="none" stroke={chartData.bids.stroke} strokeWidth="2.5" strokeLinecap="round" />

          {chartData.asks.points.map((point) => (
            <circle
              key={`ask-${point.price.toFixed(2)}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#f87171"
              onMouseEnter={() =>
                setHoverPoint({
                  side: "ask",
                  price: point.price,
                  cumulativeVolume: point.cumulativeVolume,
                  x: point.x,
                  y: point.y,
                })
              }
              onMouseLeave={() => setHoverPoint(null)}
            />
          ))}

          {chartData.bids.points.map((point) => (
            <circle
              key={`bid-${point.price.toFixed(2)}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#34d399"
              onMouseEnter={() =>
                setHoverPoint({
                  side: "bid",
                  price: point.price,
                  cumulativeVolume: point.cumulativeVolume,
                  x: point.x,
                  y: point.y,
                })
              }
              onMouseLeave={() => setHoverPoint(null)}
            />
          ))}

          <line
            x1={(midPrice - chartData.minPrice) / Math.max(chartData.maxPrice - chartData.minPrice, 1) * chartData.width}
            y1="0"
            x2={(midPrice - chartData.minPrice) / Math.max(chartData.maxPrice - chartData.minPrice, 1) * chartData.width}
            y2={chartData.height}
            stroke="#facc15"
            strokeDasharray="4 4"
            strokeOpacity="0.7"
          />
        </svg>

        {hoverPoint && (
          <div
            className="pointer-events-none absolute rounded-lg border border-neutral-700 bg-neutral-900/95 px-2 py-1 text-[11px] shadow-lg"
            style={{
              left: `${(hoverPoint.x / chartData.width) * 100}%`,
              top: `${(hoverPoint.y / chartData.height) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className={`font-semibold ${hoverPoint.side === "bid" ? "text-emerald-400" : "text-rose-400"}`}>
              {hoverPoint.side === "bid" ? "Bid" : "Ask"}
            </div>
            <div className="text-neutral-300">Price: {hoverPoint.price.toFixed(2)}</div>
            <div className="text-neutral-400">Cum. vol: {hoverPoint.cumulativeVolume.toFixed(0)}</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Bids</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Asks</span>
        </div>
        <div>
          Mid: <span className="font-mono text-neutral-200">{midPrice.toFixed(2)}</span> · Spread: <span className="font-mono text-amber-400">{spread.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
