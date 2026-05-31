"use client";

import React, { useEffect, useMemo, useRef } from "react";
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
import { compressTelemetryPairs } from "./chartUtils";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

interface DashboardTrafficChartProps {
  labels?: string[];
  values?: number[];
}

export default function DashboardTrafficChart({
  labels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
  values = [120, 180, 260, 240, 310, 390],
}: DashboardTrafficChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  const filtered = useMemo(
    () => compressTelemetryPairs(labels, values, 50),
    [labels, values],
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: filtered.labels,
        datasets: [
          {
            label: "NGN/XLM traffic",
            data: filtered.values,
            borderColor: "#D9F99D",
            backgroundColor: "rgba(217, 249, 157, 0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          tooltip: {
            enabled: true,
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255,255,255,0.06)",
            },
            ticks: {
              color: "rgba(255,255,255,0.45)",
            },
          },
          y: {
            grid: {
              color: "rgba(255,255,255,0.06)",
            },
            ticks: {
              color: "rgba(255,255,255,0.45)",
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
  }, [labels, values]);

  return (
    <div className="h-[280px] w-full">
      <canvas ref={canvasRef} aria-label="NGN/XLM traffic chart" />
    </div>
  );
}
