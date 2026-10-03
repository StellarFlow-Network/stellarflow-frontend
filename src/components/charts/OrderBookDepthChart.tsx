"use client";

/**
 * OrderBookDepthChart — Issue #711
 *
 * Renders a live bid/ask order book depth chart as an SVG cumulative-volume
 * curve. Bids render in green, asks in red, and hovering either curve shows
 * the cumulative volume available at that price level.
 *
 * The chart is intentionally presentational — it takes already-fetched
 * `bids`/`asks` and renders them. Callers that need a live-updating feed
 * (e.g. the corridor monitor dashboard) wrap this component and push fresh
 * data down as props; see `src/app/dashboard/corridors/LiquidityDepthChart.tsx`.
 *
 * Responsiveness: a `ResizeObserver` tracks the wrapping container's width so
 * the SVG viewBox is rebuilt at the container's actual pixel size rather than
 * relying solely on the browser's viewBox-to-CSS-box scaling. This keeps
 * stroke widths, hit-circle radii, and tooltip placement visually consistent
 * across breakpoints instead of stretching/squashing with the box.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { OrderBookEntry } from "@/app/hooks/useCorridorMetrics";

export interface OrderBookDepthChartProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  /** Optional label shown in the chart header, e.g. the trading pair. */
  label?: string;
  /** Rendered SVG height in pixels. Width auto-scales to the container. */
  height?: number;
  className?: string;
}

interface DepthPoint {
  price: number;
  cumulativeVolume: number;
  amount: number;
  x: number;
  y: number;
}

interface DepthSeries {
  side: "bid" | "ask";
  points: DepthPoint[];
  areaPath: string;
  linePath: string;
}

type HoverPoint =
  | { side: "bid" | "ask"; price: number; cumulativeVolume: number; x: number; y: number }
  | null;

const BID_STROKE = "#34d399";
const BID_FILL = "rgba(52, 211, 153, 0.16)";
const ASK_STROKE = "#f87171";
const ASK_FILL = "rgba(248, 113, 113, 0.16)";

function buildSeries(
  entries: OrderBookEntry[],
  side: "bid" | "ask",
  width: number,
  height: number,
  minPrice: number,
  maxPrice: number,
  maxVolume: number,
): DepthSeries {
  const priceRange = Math.max(maxPrice - minPrice, 1e-9);

  const points: DepthPoint[] = entries.map((entry, index) => {
    let cumulativeVolume = 0;
    for (let i = 0; i <= index; i += 1) {
      cumulativeVolume += entries[i].total;
    }
    const x = ((entry.price - minPrice) / priceRange) * width;
    const y = height - (cumulativeVolume / Math.max(maxVolume, 1)) * height;
    return { price: entry.price, cumulativeVolume, amount: entry.amount, x, y };
  });

  // Bids read best-to-worst (descending price); asks read best-to-worst
  // (ascending price). Sort left-to-right on the x-axis for both so the
  // curve is monotonic and the fill area closes cleanly.
  const sorted = [...points].sort((a, b) => a.x - b.x);

  const linePath = sorted
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    sorted.length === 0
      ? ""
      : `${linePath} L ${sorted[sorted.length - 1].x.toFixed(2)} ${height} L ${sorted[0].x.toFixed(2)} ${height} Z`;

  return { side, points: sorted, areaPath, linePath };
}

export default function OrderBookDepthChart({
  bids,
  asks,
  label,
  height = 200,
  className = "",
}: OrderBookDepthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hoverPoint, setHoverPoint] = useState<HoverPoint>(null);

  // Auto-scale to the container on resize (acceptance criterion: responsive
  // auto-scaling on screen resize).
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(Math.round(entry.contentRect.width), 120);
      setWidth((prev) => (Math.abs(prev - nextWidth) > 1 ? nextWidth : prev));
    });
    observer.observe(node);
    setWidth(Math.max(Math.round(node.getBoundingClientRect().width), 120));

    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => {
    const allEntries = [...bids, ...asks];
    if (allEntries.length === 0) {
      return null;
    }

    const prices = allEntries.map((entry) => entry.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002, 0.0001);
    const domainMin = minPrice - padding;
    const domainMax = maxPrice + padding;
    const maxVolume = Math.max(...allEntries.map((entry) => entry.total), 1);

    return {
      width,
      height,
      domainMin,
      domainMax,
      maxVolume,
      bids: buildSeries(bids, "bid", width, height, domainMin, domainMax, maxVolume),
      asks: buildSeries(asks, "ask", width, height, domainMin, domainMax, maxVolume),
    };
  }, [bids, asks, width, height]);

  const handlePointHover = useCallback((point: DepthPoint, side: "bid" | "ask") => {
    setHoverPoint({ side, price: point.price, cumulativeVolume: point.cumulativeVolume, x: point.x, y: point.y });
  }, []);

  const clearHover = useCallback(() => setHoverPoint(null), []);

  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;

  const tooltipStyle: CSSProperties | undefined = chart && hoverPoint
    ? {
        left: `${(hoverPoint.x / chart.width) * 100}%`,
        top: `${(hoverPoint.y / chart.height) * 100}%`,
        transform: "translate(-50%, -120%)",
      }
    : undefined;

  return (
    <div ref={containerRef} className={`w-full ${className}`} data-testid="order-book-depth-chart">
      {label && (
        <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="uppercase tracking-[0.2em]">{label}</span>
          <span className="font-mono">
            Spread: <span className="text-amber-400">{spread.toFixed(4)}</span>
          </span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80">
        {chart ? (
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            width={chart.width}
            height={chart.height}
            className="block w-full"
            style={{ height }}
            role="img"
            aria-label={`Order book depth chart${label ? ` for ${label}` : ""}`}
          >
            <line x1={0} y1={chart.height} x2={chart.width} y2={chart.height} stroke="#2a2f38" strokeWidth={1} />
            <line x1={0} y1={0} x2={0} y2={chart.height} stroke="#2a2f38" strokeWidth={1} />

            {/* Bids — green cumulative depth curve */}
            <path d={chart.bids.areaPath} fill={BID_FILL} stroke="none" />
            <path d={chart.bids.linePath} fill="none" stroke={BID_STROKE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {/* Asks — red cumulative depth curve */}
            <path d={chart.asks.areaPath} fill={ASK_FILL} stroke="none" />
            <path d={chart.asks.linePath} fill="none" stroke={ASK_STROKE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {chart.bids.points.map((point) => (
              <circle
                key={`bid-${point.price}`}
                cx={point.x}
                cy={point.y}
                r={hoverPoint?.side === "bid" && hoverPoint.price === point.price ? 5 : 3}
                fill={BID_STROKE}
                className="cursor-crosshair transition-[r]"
                onMouseEnter={() => handlePointHover(point, "bid")}
                onMouseLeave={clearHover}
                onFocus={() => handlePointHover(point, "bid")}
                onBlur={clearHover}
                tabIndex={0}
                role="button"
                aria-label={`Bid at ${point.price.toFixed(4)}, cumulative volume ${point.cumulativeVolume.toFixed(0)}`}
              />
            ))}

            {chart.asks.points.map((point) => (
              <circle
                key={`ask-${point.price}`}
                cx={point.x}
                cy={point.y}
                r={hoverPoint?.side === "ask" && hoverPoint.price === point.price ? 5 : 3}
                fill={ASK_STROKE}
                className="cursor-crosshair transition-[r]"
                onMouseEnter={() => handlePointHover(point, "ask")}
                onMouseLeave={clearHover}
                onFocus={() => handlePointHover(point, "ask")}
                onBlur={clearHover}
                tabIndex={0}
                role="button"
                aria-label={`Ask at ${point.price.toFixed(4)}, cumulative volume ${point.cumulativeVolume.toFixed(0)}`}
              />
            ))}
          </svg>
        ) : (
          <div
            className="flex items-center justify-center text-xs text-neutral-500"
            style={{ height }}
          >
            No order book data available.
          </div>
        )}

        {hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-neutral-700 bg-neutral-900/95 px-2 py-1 text-[11px] shadow-lg"
            style={tooltipStyle}
          >
            <div className={`font-semibold ${hoverPoint.side === "bid" ? "text-emerald-400" : "text-rose-400"}`}>
              {hoverPoint.side === "bid" ? "Bid" : "Ask"}
            </div>
            <div className="text-neutral-300">Price: {hoverPoint.price.toFixed(4)}</div>
            <div className="text-neutral-400">Cum. vol: {hoverPoint.cumulativeVolume.toLocaleString()}</div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Bids
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Asks
        </span>
      </div>
    </div>
  );
}
