import { memo } from "react";
import { DEPTH_CHART_COLORS, DEPTH_SERIES } from "./CumulativeDepthChart.constants";

function DepthChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
      {DEPTH_SERIES.map(({ side, label }) => (
        <span key={side} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: DEPTH_CHART_COLORS[side].stroke }}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-0 w-4 border-t border-dashed"
          style={{ borderColor: DEPTH_CHART_COLORS.midPrice }}
          aria-hidden="true"
        />
        Mid price
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-4 rounded-sm border"
          style={{
            backgroundColor: DEPTH_CHART_COLORS.spread,
            borderColor: DEPTH_CHART_COLORS.spreadStroke,
          }}
          aria-hidden="true"
        />
        Spread
      </span>
    </div>
  );
}

export default memo(DepthChartLegend);
