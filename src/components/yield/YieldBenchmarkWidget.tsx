"use client";

/**
 * YieldBenchmarkWidget — #990
 *
 * Compares StellarFlow vault performance against benchmark lending rates and
 * external protocol yields for the core assets (USDC, XLM, BTC).
 *
 * Renders:
 *   • A grouped bar chart of StellarFlow Vault APY vs Industry Average APY.
 *   • A headline net APY advantage metric (e.g. "+3.2% Higher Yield").
 *   • An informative tooltip detailing the vault's yield sources.
 *
 * The chart is scaled from the active yield feed metrics via
 * `calculateChartMax`, so the tallest bar always fills the plot area.
 */

import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { TrendingUp, TrendingDown, Info, RefreshCw } from "lucide-react";
import {
  useYieldBenchmarks,
  calculateApyAdvantage,
  calculateAggregateAdvantage,
  calculateChartMax,
  type YieldBenchmarkAsset,
} from "@/hooks/useYieldBenchmarks";

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatApy(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Formats the net APY spread as a signed percentage-point string, e.g.
 * "+3.2%" or "-1.4%".
 */
export function formatAdvantage(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface YieldBenchmarkWidgetProps {
  /** Optional pre-fetched assets; when omitted the hook fetches them. */
  assets?: YieldBenchmarkAsset[];
  /** Chart height in pixels. */
  height?: number;
  /** Additional CSS class names for the outer container. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function YieldBenchmarkWidget({
  assets: assetsProp,
  height = 280,
  className = "",
}: YieldBenchmarkWidgetProps) {
  // When assets are supplied directly (tests / storybook) we skip the
  // react-query fetch entirely so the widget can render without a provider.
  if (assetsProp) {
    return (
      <YieldBenchmarkView
        assets={assetsProp}
        height={height}
        className={className}
        isLoading={false}
        isError={false}
        onRefresh={() => {}}
      />
    );
  }

  return <YieldBenchmarkContainer height={height} className={className} />;
}

function YieldBenchmarkContainer({
  height,
  className,
}: {
  height: number;
  className: string;
}) {
  const { data, isLoading, isError, refetch } = useYieldBenchmarks();

  return (
    <YieldBenchmarkView
      assets={data?.assets ?? []}
      height={height}
      className={className}
      isLoading={isLoading}
      isError={isError}
      onRefresh={() => refetch()}
    />
  );
}

interface YieldBenchmarkViewProps {
  assets: YieldBenchmarkAsset[];
  height: number;
  className: string;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}

function YieldBenchmarkView({
  assets,
  height,
  className,
  isLoading,
  isError,
  onRefresh,
}: YieldBenchmarkViewProps) {
  const [showSources, setShowSources] = useState(false);

  const chartMax = useMemo(() => calculateChartMax(assets), [assets]);
  const aggregateAdvantage = useMemo(
    () => calculateAggregateAdvantage(assets),
    [assets]
  );

  const chartData: ChartData<"bar"> = useMemo(
    () => ({
      labels: assets.map((asset) => asset.symbol),
      datasets: [
        {
          label: "StellarFlow Vault APY",
          data: assets.map((asset) => asset.vaultApyPercent),
          backgroundColor: "rgba(52, 211, 153, 0.85)", // emerald-400
          borderColor: "#34d399",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Industry Average APY",
          data: assets.map((asset) => asset.industryApyPercent),
          backgroundColor: "rgba(148, 163, 184, 0.7)", // slate-400
          borderColor: "#94a3b8",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    }),
    [assets]
  );

  const chartOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      // Scale the y-axis from the active yield feed metrics so the tallest bar
      // fills the plot area with a small headroom.
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: chartMax * 1.1,
          ticks: {
            callback: (value) => `${value}%`,
            color: "#94a3b8",
          },
          grid: { color: "rgba(148, 163, 184, 0.15)" },
        },
        x: {
          ticks: { color: "#cbd5e1" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#cbd5e1", boxWidth: 12, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${formatApy(context.parsed.y)}`,
          },
        },
      },
    }),
    [chartMax]
  );

  const isPositive = aggregateAdvantage >= 0;

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-950/70 p-5 ${className}`}
      aria-label="Yield farming performance benchmark comparison"
      data-testid="yield-benchmark-widget"
    >
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <TrendingUp className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            Yield Benchmark Comparison
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            StellarFlow Vault APY vs industry-average lending rates
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRefresh()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          aria-label="Refresh benchmark data"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* Advantage metric */}
      <div
        className="mb-4 flex flex-wrap items-center gap-3"
        data-testid="yield-advantage-metric"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            isPositive
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-rose-500/15 text-rose-300"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
          )}
          {formatAdvantage(aggregateAdvantage)} Higher Yield
        </span>
        <span className="text-xs text-slate-400">
          Average net APY spread across {assets.length} core assets
        </span>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height }}>
        {isLoading && assets.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-sm text-slate-500"
            data-testid="yield-benchmark-loading"
          >
            Loading benchmark yields…
          </div>
        ) : isError && assets.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-sm text-rose-400"
            data-testid="yield-benchmark-error"
          >
            Unable to load benchmark yields.
          </div>
        ) : (
          <Bar
            data={chartData}
            options={chartOptions}
            aria-label="Bar chart comparing StellarFlow vault APY against industry average APY"
          />
        )}
      </div>

      {/* Per-asset advantage table */}
      <ul className="mt-4 space-y-2" data-testid="yield-benchmark-rows">
        {assets.map((asset) => {
          const advantage = calculateApyAdvantage(
            asset.vaultApyPercent,
            asset.industryApyPercent
          );
          return (
            <li
              key={asset.symbol}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
              data-testid={`yield-benchmark-row-${asset.symbol}`}
            >
              <span className="font-medium text-slate-200">
                {asset.symbol}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {asset.name}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-slate-400">
                  {formatApy(asset.vaultApyPercent)} vs{" "}
                  {formatApy(asset.industryApyPercent)}
                </span>
                <span
                  className={`font-semibold ${
                    advantage >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {formatAdvantage(advantage)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Yield sources tooltip */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowSources((prev) => !prev)}
          aria-expanded={showSources}
          aria-controls="yield-sources-panel"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
          data-testid="yield-sources-toggle"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Where does the vault yield come from?
        </button>

        {showSources && (
          <div
            id="yield-sources-panel"
            role="tooltip"
            data-testid="yield-sources-panel"
            className="mt-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300"
          >
            <p className="mb-2 text-slate-400">
              StellarFlow vault yield is generated from multiple on-chain
              sources, aggregated per asset:
            </p>
            <ul className="space-y-2">
              {assets.map((asset) => (
                <li key={asset.symbol}>
                  <span className="font-semibold text-slate-200">
                    {asset.symbol}
                  </span>
                  <span className="ml-2 text-slate-500">
                    benchmark: {asset.benchmarkSource}
                  </span>
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {asset.yieldSources.map((source) => (
                      <li
                        key={source.label}
                        className="flex items-center justify-between"
                      >
                        <span>{source.label}</span>
                        <span className="text-emerald-300">
                          {formatApy(source.apyPercent)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default YieldBenchmarkWidget;
