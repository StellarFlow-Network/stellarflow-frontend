import React from "react";

interface ModularStatsCardProps {
  label: string;
  value: number;
  trend?: number; // e.g., 5.2 for +5.2% or -2.1 for -2.1%
  unit?: string;  // e.g., "XLM", "USD"
}

/**
 * Modular Stats Card Component
 * Displays a label, a value formatted with Intl.NumberFormat, and a trend percentage.
 */
const ModularStatsCard: React.FC<ModularStatsCardProps> = ({
  label,
  value,
  trend,
  unit,
}) => {
  // Format value using Intl.NumberFormat
  const formattedValue = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);

  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="relative h-full bg-[#0A121E] border border-[#1B2A3B] rounded-xl p-6 shadow-lg hover:border-[#39FF14]/50 transition-all duration-300 group">
      <div className="flex flex-col gap-2">
        {/* Label */}
        <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider group-hover:text-[#39FF14] transition-colors">
          {label}
        </h3>

        {/* Value Area */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-white leading-none">
            {formattedValue}
          </span>
          {unit && (
            <span className="text-gray-500 text-sm font-bold">{unit}</span>
          )}
        </div>

        {/* Trend Indicator */}
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPositive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              <span>{isPositive ? "▲" : "▼"}</span>
              <span>{Math.abs(trend)}%</span>
            </div>
            <span className="text-[10px] text-gray-600 font-medium italic">
              vs last 24h
            </span>
          </div>
        )}
      </div>

      {/* Decorative cyber line */}
      <div className="absolute top-0 right-0 w-8 h-[2px] bg-gradient-to-l from-[#39FF14] to-transparent" />
      <div className="absolute bottom-0 left-0 w-8 h-[2px] bg-gradient-to-r from-[#39FF14] to-transparent" />
    </div>
  );
};

export default ModularStatsCard;
