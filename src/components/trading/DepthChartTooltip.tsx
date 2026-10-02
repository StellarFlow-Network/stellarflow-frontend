import type { TooltipContentProps } from "recharts";
import type { DepthChartPoint } from "@/lib/orderBookDepth";
import { formatCompactAmount } from "@/utils/formatters";
import { DEPTH_CHART_COLORS, DEPTH_SERIES } from "./CumulativeDepthChart.constants";

type DepthChartTooltipProps = Pick<TooltipContentProps, "active" | "payload"> & {
  formatPrice: (value: number) => string;
};

export default function DepthChartTooltip({ active, payload, formatPrice }: DepthChartTooltipProps) {
  const point = payload?.[0]?.payload as DepthChartPoint | undefined;

  if (!active || !point) {
    return null;
  }

  const rows = DEPTH_SERIES.filter(({ dataKey }) => point[dataKey] !== null);

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-[11px] shadow-lg">
      <div className="font-mono text-neutral-200">Price: {formatPrice(point.price)}</div>
      {rows.map(({ side, dataKey, label }) => (
        <div key={side} className="mt-0.5 flex items-center gap-1.5 text-neutral-400">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: DEPTH_CHART_COLORS[side].stroke }}
            aria-hidden="true"
          />
          {label} depth:
          <span className="font-mono text-neutral-200">
            {formatCompactAmount(point[dataKey] ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}
