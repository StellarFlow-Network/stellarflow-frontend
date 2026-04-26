"use client";

import React, { useMemo } from "react";

interface RateSparklineCardProps {
  currency: string;
  rate: number;
  trend: number;
  sparklineData: number[];
}

const MiniSparkline = React.memo(function MiniSparkline({
  data,
}: {
  data: number[];
}) {
  const points = useMemo(() => {
    const width = 120;
    const height = 32;

    if (data.length < 2) {
      return "";
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data]);

  return (
    <svg viewBox="0 0 120 32" className="h-8 w-full overflow-visible" role="img" aria-label="Sparkline chart">
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
  sparklineData,
}) => {
  const isPositive = trend >= 0;

  const formattedRate = useMemo(
    () => `${currency} ${rate.toFixed(2)}`,
    [currency, rate]
  );

  const trendLabel = useMemo(
    () => `${isPositive ? "▲" : "▼"} ${Math.abs(trend).toFixed(2)}%`,
    [isPositive, trend]
  );

  const trendClasses = useMemo(
    () =>
      isPositive
        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
        : "bg-rose-500/10 text-rose-300 border border-rose-500/20",
    [isPositive]
  );

  const sparklineClasses = useMemo(
    () => (isPositive ? "text-emerald-400" : "text-rose-400"),
    [isPositive]
  );

  return (
    <div className="rounded-3xl border border-[#1B2A3B] bg-[#08111E] p-5 shadow-lg shadow-black/20 transition duration-300 hover:border-[#39FF14]/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{currency}</p>
          <p className="mt-2 text-2xl font-black text-white tracking-tight">{formattedRate}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold ${trendClasses}`}>
          {trendLabel}
        </span>
      </div>

      <div className={`mt-4 ${sparklineClasses}`}>
        <MiniSparkline data={sparklineData} />
      </div>
    </div>
  );
};

export default React.memo(RateSparklineCard);
