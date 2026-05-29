"use client";

import React, { useEffect, useRef } from "react";
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

interface Point {
  label: string;
  value: number;
  index: number;
}

/**
 * Largest Triangle Three Buckets (LTTB) down-sampling algorithm.
 * Reduces a series of points to a smaller number of points (threshold) while preserving visual characteristics.
 */
function downsampleLTTB(
  labels: string[],
  values: number[],
  threshold: number,
): { labels: string[]; values: number[] } {
  const len = values.length;
  if (len <= threshold || threshold <= 2) {
    return { labels, values };
  }

  // Map values to points with coordinates where x is the index and y is the value.
  const data: Point[] = values.map((val, idx) => ({
    label: labels[idx] ?? "",
    value: val,
    index: idx,
  }));

  const sampled: Point[] = [];
  const bucketSize = (len - 2) / (threshold - 2);

  let a = 0; // index of the current point 'a'
  sampled.push(data[a]); // Always add the first point

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate point b (the average of the next bucket)
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgRangeEnd = avgRangeEnd < len ? avgRangeEnd : len;

    const avgRangeLength = avgRangeEnd - avgRangeStart || 1;
    for (let k = avgRangeStart; k < avgRangeEnd; k++) {
      avgX += data[k].index;
      avgY += data[k].value;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    // Get the range for the current bucket
    let rangeStart = Math.floor(i * bucketSize) + 1;
    let rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    rangeEnd = rangeEnd < len ? rangeEnd : len;

    // Point a coordinates
    const pointAX = data[a].index;
    const pointAY = data[a].value;

    let maxArea = -1;
    let nextA = rangeStart;

    for (let k = rangeStart; k < rangeEnd; k++) {
      // Calculate triangle area over three points: a, current point, and next bucket average
      const area = Math.abs(
        (pointAX - avgX) * (data[k].value - pointAY) -
        (pointAX - data[k].index) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = k;
      }
    }

    sampled.push(data[nextA]);
    a = nextA; // Set the selected point as the new 'a'
  }

  sampled.push(data[len - 1]); // Always add the last point

  return {
    labels: sampled.map((p) => p.label),
    values: sampled.map((p) => p.value),
  };
}

export default function DashboardTrafficChart({
  labels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
  values = [120, 180, 260, 240, 310, 390],
}: DashboardTrafficChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  // Apply LTTB downsampling, clamping the rendered array to a maximum of 40 plot marks
  const { sampledLabels, sampledValues } = React.useMemo(() => {
    return downsampleLTTB(labels, values, 40);
  }, [labels, values]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: sampledLabels,
        datasets: [
          {
            label: "NGN/XLM traffic",
            data: sampledValues,
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
  }, [sampledLabels, sampledValues]);

  return (
    <div className="h-[280px] w-full">
      <canvas ref={canvasRef} aria-label="NGN/XLM traffic chart" />
    </div>
  );
}
