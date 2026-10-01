"use client";

import { memo, useCallback, useDeferredValue, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { SkeletonChart } from "@/components/skeletons/SkeletonChart";
import { ASSET_DECIMALS, type AssetSymbol } from "@/config/assetSymbols";
import { useDepthChartZoom } from "@/hooks/useDepthChartZoom";
import {
  buildDepthChartModel,
  resolveDepthViewport,
  roundUpToNiceNumber,
} from "@/lib/orderBookDepth";
import type { OrderBookSnapshot } from "@/types";
import { formatCompactAmount, formatOrderBookPrice } from "@/utils/formatters";
import {
  CONNECTION_STATUS_LABELS,
  DEFAULT_DEPTH_CHART_HEIGHT,
  DEPTH_AXIS_WIDTH,
  DEPTH_CHART_COLORS,
  DEPTH_CHART_MARGIN,
  DEPTH_SERIES,
  PRICE_AXIS_TICK_COUNT,
  RESIZE_DEBOUNCE_MS,
  SPREAD_VISIBILITY_MULTIPLIER,
  Y_AXIS_HEADROOM_RATIO,
} from "./CumulativeDepthChart.constants";
import DepthChartLegend from "./DepthChartLegend";
import DepthChartSummary from "./DepthChartSummary";
import DepthChartTooltip from "./DepthChartTooltip";
import DepthZoomControls from "./DepthZoomControls";

export interface CumulativeDepthChartViewProps {
  assetId: AssetSymbol;
  orderBook: OrderBookSnapshot | null;
  isConnected: boolean;
  height?: number;
  className?: string;
}

const AXIS_TICK_STYLE = { fontSize: 11, fill: DEPTH_CHART_COLORS.axis } as const;
const ACTIVE_DOT_STYLE = { r: 3, strokeWidth: 0 } as const;
const MIN_DEPTH_DOMAIN = 1;

function CumulativeDepthChartViewComponent({
  assetId,
  orderBook,
  isConnected,
  height = DEFAULT_DEPTH_CHART_HEIGHT,
  className = "",
}: CumulativeDepthChartViewProps) {
  const containerRef = useRef<HTMLElement>(null);
  const deferredOrderBook = useDeferredValue(orderBook);
  const { zoomFactor, canZoomIn, canZoomOut, dispatchZoom } = useDepthChartZoom(containerRef);
  const priceFractionDigits = ASSET_DECIMALS[assetId];

  const model = useMemo(
    () => buildDepthChartModel(deferredOrderBook?.bids ?? [], deferredOrderBook?.asks ?? []),
    [deferredOrderBook],
  );

  const viewport = useMemo(
    () => resolveDepthViewport(model, zoomFactor, SPREAD_VISIBILITY_MULTIPLIER),
    [model, zoomFactor],
  );

  const formatPrice = useCallback(
    (value: number) => formatOrderBookPrice(value, priceFractionDigits),
    [priceFractionDigits],
  );

  const renderTooltip = useCallback(
    ({ active, payload }: TooltipContentProps) => (
      <DepthChartTooltip active={active} payload={payload} formatPrice={formatPrice} />
    ),
    [formatPrice],
  );

  const { spread } = model;
  const depthDomainMax =
    roundUpToNiceNumber((viewport?.maxDepth ?? 0) * Y_AXIS_HEADROOM_RATIO) || MIN_DEPTH_DOMAIN;

  const renderChartBody = () => {
    if (!deferredOrderBook) {
      return <SkeletonChart variant="orderbook" height={height} />;
    }

    if (!viewport) {
      return (
        <div className="flex items-center justify-center text-xs text-gray-500" style={{ height }}>
          No order book liquidity available.
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height} debounce={RESIZE_DEBOUNCE_MS}>
        <AreaChart data={viewport.points} margin={DEPTH_CHART_MARGIN}>
          <CartesianGrid stroke={DEPTH_CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="price"
            type="number"
            domain={[viewport.domain.min, viewport.domain.max]}
            allowDataOverflow
            tickCount={PRICE_AXIS_TICK_COUNT}
            tickFormatter={formatPrice}
            tick={AXIS_TICK_STYLE}
            stroke={DEPTH_CHART_COLORS.axis}
          />
          <YAxis
            type="number"
            domain={[0, depthDomainMax]}
            allowDataOverflow
            width={DEPTH_AXIS_WIDTH}
            tickFormatter={formatCompactAmount}
            tick={AXIS_TICK_STYLE}
            stroke={DEPTH_CHART_COLORS.axis}
          />
          <Tooltip content={renderTooltip} isAnimationActive={false} />
          {spread && (
            <ReferenceArea
              x1={spread.bestBid}
              x2={spread.bestAsk}
              fill={DEPTH_CHART_COLORS.spread}
              stroke={DEPTH_CHART_COLORS.spreadStroke}
              ifOverflow="hidden"
            />
          )}
          {DEPTH_SERIES.map(({ side, dataKey, curve, label }) => (
            <Area
              key={side}
              name={label}
              dataKey={dataKey}
              type={curve}
              stroke={DEPTH_CHART_COLORS[side].stroke}
              fill={DEPTH_CHART_COLORS[side].fill}
              strokeWidth={2}
              dot={false}
              activeDot={ACTIVE_DOT_STYLE}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {spread && (
            <ReferenceLine
              x={spread.midPrice}
              stroke={DEPTH_CHART_COLORS.midPrice}
              strokeDasharray="4 4"
              ifOverflow="hidden"
              label={{
                value: `Mid ${formatPrice(spread.midPrice)}`,
                position: "top",
                fill: DEPTH_CHART_COLORS.midPrice,
                fontSize: 11,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <section
      ref={containerRef}
      className={`relative w-full max-w-full overflow-hidden rounded-2xl border border-[#1B2A3B] bg-[#0A121E] p-6 shadow-lg ${className}`}
      aria-label={`Cumulative order book depth for ${assetId}`}
      data-testid="cumulative-depth-chart"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
            Market Depth
          </p>
          <h3 className="mt-0.5 flex items-center gap-2 text-base font-black tracking-tight text-white">
            <span>{assetId}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                isConnected ? "bg-[#39FF14]/10 text-[#39FF14]" : "bg-yellow-500/10 text-yellow-500"
              }`}
            >
              {isConnected ? CONNECTION_STATUS_LABELS.live : CONNECTION_STATUS_LABELS.offline}
            </span>
          </h3>
        </div>
        <DepthZoomControls
          zoomFactor={zoomFactor}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onAction={dispatchZoom}
        />
      </header>

      <DepthChartSummary spread={spread} formatPrice={formatPrice} />

      <div className="mt-4">{renderChartBody()}</div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <DepthChartLegend />
        <span className="text-[10px] text-gray-600">Ctrl / ⌘ + scroll to zoom</span>
      </footer>
    </section>
  );
}

export const CumulativeDepthChartView = memo(CumulativeDepthChartViewComponent);

export default CumulativeDepthChartView;
