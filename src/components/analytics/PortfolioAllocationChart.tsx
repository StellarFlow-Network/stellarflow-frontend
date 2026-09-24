"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  ArcElement,
  DoughnutController,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import type { PortfolioAllocationSlice } from "@/types/portfolio";

Chart.register(ArcElement, DoughnutController, Tooltip);

const SLICE_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#4ade80",
];

interface PortfolioAllocationChartProps {
  allocation: PortfolioAllocationSlice[];
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function PortfolioAllocationChart({
  allocation,
}: PortfolioAllocationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"doughnut"> | null>(null);
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set());

  const total = useMemo(
    () => allocation.reduce((sum, slice) => sum + slice.valueUsd, 0),
    [allocation],
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ChartConfiguration<"doughnut"> = {
      type: "doughnut",
      data: {
        labels: allocation.map((slice) => slice.symbol),
        datasets: [
          {
            data: allocation.map((slice) => slice.valueUsd),
            backgroundColor: allocation.map(
              (_, index) => SLICE_COLORS[index % SLICE_COLORS.length],
            ),
            borderColor: "#161b22",
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        animation: { duration: 250 },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed as number;
                const pct = total > 0 ? (value / total) * 100 : 0;
                return `${context.label}: ${formatUsd(value)} (${pct.toFixed(1)}%)`;
              },
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
  }, [allocation, total]);

  const toggleSlice = (symbol: string, index: number) => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.toggleDataVisibility(index);
    chart.update();

    setHiddenSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-48 w-48 shrink-0 sm:mx-0">
        <canvas ref={canvasRef} aria-label="Portfolio allocation by asset" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">
            Total
          </span>
          <span className="font-mono text-lg font-bold text-neutral-100">
            {formatUsd(total)}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {allocation.map((slice, index) => {
          const isHidden = hiddenSymbols.has(slice.symbol);
          const pct = total > 0 ? (slice.valueUsd / total) * 100 : 0;

          return (
            <li key={slice.symbol}>
              <button
                type="button"
                onClick={() => toggleSlice(slice.symbol, index)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm transition-opacity hover:bg-neutral-800/60 ${
                  isHidden ? "opacity-40" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-neutral-300">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length],
                    }}
                  />
                  {slice.symbol}
                </span>
                <span className="font-mono text-xs text-neutral-500">
                  {pct.toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
