"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import type { PortfolioSummaryData, PortfolioTimeframe } from "@/types/portfolio";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

const TIMEFRAMES: PortfolioTimeframe[] = ["7D", "30D", "90D", "1Y"];

interface PortfolioHistoryChartProps {
  history: PortfolioSummaryData["history"];
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatLabel(date: string, timeframe: PortfolioTimeframe): string {
  const parsed = new Date(date);
  if (timeframe === "1Y") {
    return parsed.toLocaleDateString(undefined, { month: "short" });
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PortfolioHistoryChart({
  history,
}: PortfolioHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);
  const [timeframe, setTimeframe] = useState<PortfolioTimeframe>("30D");

  const points = history[timeframe];

  const { changeUsd, changePercent } = useMemo(() => {
    if (points.length < 2) return { changeUsd: 0, changePercent: 0 };
    const first = points[0].netWorthUsd;
    const last = points[points.length - 1].netWorthUsd;
    return {
      changeUsd: last - first,
      changePercent: first !== 0 ? ((last - first) / first) * 100 : 0,
    };
  }, [points]);

  const isPositive = changeUsd >= 0;

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: points.map((point) => formatLabel(point.date, timeframe)),
        datasets: [
          {
            label: "Net Worth",
            data: points.map((point) => point.netWorthUsd),
            borderColor: isPositive ? "#34d399" : "#f87171",
            backgroundColor: isPositive
              ? "rgba(52, 211, 153, 0.12)"
              : "rgba(248, 113, 113, 0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatUsd(context.parsed.y as number),
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: {
              color: "rgba(255,255,255,0.45)",
              maxTicksLimit: 8,
              autoSkip: true,
            },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: {
              color: "rgba(255,255,255,0.45)",
              callback: (value) => formatUsd(value as number),
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
  }, [points, timeframe, isPositive]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`font-mono text-sm ${isPositive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isPositive ? "+" : ""}
          {formatUsd(changeUsd)} ({isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%) · {timeframe}
        </span>

        <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                timeframe === tf
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <canvas ref={canvasRef} aria-label="Portfolio net worth history" />
      </div>
    </div>
  );
}
