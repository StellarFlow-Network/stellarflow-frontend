"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chart,
  CategoryScale,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import {
  SEP38_PAIRS,
  type Sep38Pair,
  type Sep38RateHistory,
} from "@/types/sep38Rates";

Chart.register(
  CategoryScale,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

export interface SEP38RateChartProps {
  className?: string;
}

function formatRate(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 6,
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SEP38RateChart({ className = "" }: SEP38RateChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);
  const [pair, setPair] = useState<Sep38Pair>(SEP38_PAIRS[0]);
  const { data, isLoading, isFetching, error } = useQuery<Sep38RateHistory, Error>({
    queryKey: ["sep38-rate-history", pair],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/sep38/rates?pair=${encodeURIComponent(pair)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load SEP-38 rates (${response.status})`);
      }
      return response.json() as Promise<Sep38RateHistory>;
    },
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Mid-market",
            data: [],
            borderColor: "#60a5fa",
            backgroundColor: "#60a5fa",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
          },
          {
            label: "Anchor firm rate",
            data: [],
            borderColor: "#a3e635",
            backgroundColor: "rgba(163, 230, 53, 0.16)",
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: {
              target: 0,
              above: "rgba(163, 230, 53, 0.16)",
              below: "rgba(251, 146, 60, 0.18)",
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: "easeOutQuart" },
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label ?? "",
              label: (context) => `${context.dataset.label}: ${formatRate(context.parsed.y)}`,
              afterBody: (items) => {
                if (items.length < 2) return "";
                const spread = items[1].parsed.y - items[0].parsed.y;
                const pct = items[0].parsed.y ? (spread / items[0].parsed.y) * 100 : 0;
                return `Anchor spread: ${pct.toFixed(2)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "rgba(255,255,255,0.45)",
              maxTicksLimit: 7,
            },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: {
              color: "rgba(255,255,255,0.45)",
              callback: (value) => formatRate(Number(value)),
            },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Chart is initialized once; rate data is applied by the update effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data) return;
    chart.data.labels = data.points.map((point) => formatTime(point.timestamp));
    chart.data.datasets[0].data = data.points.map((point) => point.midMarketRate);
    chart.data.datasets[1].data = data.points.map((point) => point.anchorRate);
    chart.update("active");
  }, [data]);

  const latest = data?.points[data.points.length - 1];
  const spreadPct = latest?.midMarketRate
    ? ((latest.anchorRate - latest.midMarketRate) / latest.midMarketRate) * 100
    : null;

  return (
    <section
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 sm:p-5 ${className}`}
      data-testid="sep38-rate-chart"
      aria-labelledby="sep38-rate-chart-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            SEP-38 quote history · 24 hours
          </p>
          <h2 id="sep38-rate-chart-title" className="mt-1 text-lg font-semibold text-neutral-100">
            Cross-asset exchange rate
          </h2>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${
            isFetching
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
          aria-live="polite"
        >
          {isFetching ? "Updating…" : data?.source === "demo" ? "Demo data" : "Indexer"}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Currency pair">
        {SEP38_PAIRS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPair(option)}
            aria-pressed={pair === option}
            className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
              pair === option
                ? "border-lime-400/50 bg-lime-400/10 text-lime-200"
                : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-mono text-neutral-300">
          {pair} {latest ? <strong className="ml-1 text-lime-300">{formatRate(latest.anchorRate)}</strong> : null}
        </span>
        {spreadPct !== null && (
          <span className="text-orange-300">
            Anchor spread <strong>{spreadPct > 0 ? "+" : ""}{spreadPct.toFixed(2)}%</strong>
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-neutral-400">
          <i className="h-2 w-2 rounded-full bg-blue-400" aria-hidden /> Mid-market
          <i className="ml-2 h-2 w-2 rounded-full bg-lime-400" aria-hidden /> Anchor firm
        </span>
      </div>

      <div className="relative h-64 w-full sm:h-72">
        <canvas ref={canvasRef} aria-label={`${pair} firm and mid-market rate over the last 24 hours`} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/50 text-sm text-neutral-400">
            Loading quote history…
          </div>
        )}
        {error && !data && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 px-4 text-center text-sm text-rose-300">
            {error.message}
          </div>
        )}
        {!isLoading && data?.points.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 text-sm text-neutral-400">
            No quote history available for this pair.
          </div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-neutral-500">
        Shaded area shows the gap between the anchor&apos;s firm rate and the mid-market reference.
        {data?.source === "demo" ? " Demo values are illustrative, not live SEP-38 quotes." : ""}
      </p>
    </section>
  );
}