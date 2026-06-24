"use client";

import React, { useMemo } from "react";
import { Shimmer } from "@/components/skeletons";

const CHART_HISTORY_LIMIT = 150;

interface RateSparklineCardProps {
  currency: string;
  rate: number;
  trend: number;
  sparklineData?: number[];
  loading?: boolean;
}

const MiniSparkline = React.memo(function MiniSparkline({
  data,
}: {
  data: number[];
}) {
  const points = useMemo(() => {
    const width = 120;
    const height = 32;

    // Cap to the last CHART_HISTORY_LIMIT vectors and null-prune trailing slots.
    const windowed = data.slice(-CHART_HISTORY_LIMIT);
    windowed.length = windowed.length;

    if (windowed.length < 2) {
      return "";
    }

    const min = Math.min(...windowed);
    const max = Math.max(...windowed);
    const range = max - min || 1;

    return windowed
      .map((value, index) => {
        const x = (index / (windowed.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data]);

  return (
    <svg
      viewBox="0 0 120 32"
      className="h-8 w-full overflow-visible"
      role="img"
      aria-label="Sparkline chart"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

const RateSparklineCard: React.FC<RateSparklineCardProps> = ({
  currency,
  rate,
  trend,
  sparklineData = [],
  loading = false,
}) => {
  const isPositive = trend >= 0;
  const displayData = sparklineData;

  const formattedRate = useMemo(
    () => `${currency} ${rate.toFixed(2)}`,
    [currency, rate],
  );

  const trendLabel = useMemo(
    () => `${isPositive ? "▲" : "▼"} ${Math.abs(trend).toFixed(2)}%`,
    [isPositive, trend],
  );

  const trendClasses = isPositive
    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-300 border border-rose-500/20";

  const sparklineClasses = isPositive ? "text-emerald-400" : "text-rose-400";

  if (loading) {
    return (
      <div
        style={{ contain: "paint layout" }}
        className="aspect-[16/10] rounded-3xl border border-[#1B2A3B] bg-[#08111E] p-5 shadow-lg shadow-black/20"
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Shimmer className="h-3 w-14 rounded-md" />
              <Shimmer className="h-8 w-32 rounded-md" />
            </div>
            <Shimmer className="h-6 w-16 rounded-full" />
          </div>

          <div className="space-y-3">
            <Shimmer className="h-[1px] w-full" />
            <Shimmer className="h-8 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ contain: "paint layout" }}
      className="aspect-[16/10] rounded-3xl border border-[#1B2A3B] bg-[#08111E] p-5 shadow-lg shadow-black/20 transition duration-300 hover:border-[#39FF14]/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            {currency}
          </p>
          <p className="mt-2 text-2xl font-black text-white tracking-tight">
            {formattedRate}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold ${trendClasses}`}
        >
          {trendLabel}
        </span>
      </div>

      <div className={`mt-4 ${sparklineClasses}`}>
        <MiniSparkline data={displayData} />
      </div>
    </div>
  );
};

export default React.memo(RateSparklineCard);
