import { memo } from "react";
import type { MarketSpread } from "@/lib/orderBookDepth";
import { formatPercent } from "@/utils/formatters";

interface DepthChartSummaryProps {
  spread: MarketSpread | null;
  formatPrice: (value: number) => string;
}

interface SummaryItem {
  label: string;
  value: string;
  toneClassName: string;
}

const EMPTY_VALUE = "—";

function buildSummaryItems(
  spread: MarketSpread | null,
  formatPrice: (value: number) => string,
): SummaryItem[] {
  const format = (value: number | undefined) =>
    value === undefined ? EMPTY_VALUE : formatPrice(value);

  return [
    { label: "Best bid", value: format(spread?.bestBid), toneClassName: "text-emerald-400" },
    { label: "Mid price", value: format(spread?.midPrice), toneClassName: "text-gray-100" },
    { label: "Best ask", value: format(spread?.bestAsk), toneClassName: "text-rose-400" },
    {
      label: "Spread",
      value: spread
        ? `${formatPrice(spread.spread)} (${formatPercent(spread.spreadPercent)})`
        : EMPTY_VALUE,
      toneClassName: "text-amber-400",
    },
  ];
}

function DepthChartSummary({ spread, formatPrice }: DepthChartSummaryProps) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="depth-chart-summary">
      {buildSummaryItems(spread, formatPrice).map(({ label, value, toneClassName }) => (
        <div key={label} className="min-w-0 rounded-xl border border-[#1B2A3B] bg-[#0D1726] px-3 py-2">
          <dt className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">{label}</dt>
          <dd className={`mt-0.5 truncate font-mono text-xs ${toneClassName}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default memo(DepthChartSummary);
