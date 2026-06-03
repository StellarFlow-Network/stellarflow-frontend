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
import { useRafThrottle } from "../hooks/useRafThrottle";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

const CHART_HISTORY_LIMIT = 150;

interface DashboardTrafficChartProps {
  labels?: string[];
  values?: number[];
}

interface PointerPosition {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
}

export default function DashboardTrafficChart({
  labels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
  values = [120, 180, 260, 240, 310, 390],
}: DashboardTrafficChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  const processPointerMove = useRafThrottle((position: PointerPosition) => {
    const chart = chartRef.current;
    if (!chart) return;

    const event = {
      clientX: position.clientX,
      clientY: position.clientY,
      offsetX: position.offsetX,
      offsetY: position.offsetY,
      type: "pointermove",
    } as unknown as Event;

    const activeElements = chart.getElementsAtEventForMode(
      event,
      "nearest",
      { intersect: false },
      false,
    );

    chart.tooltip.setActiveElements(activeElements, {
      x: position.clientX,
      y: position.clientY,
    });

    chart.update("none");
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    // Cap to the last CHART_HISTORY_LIMIT vectors and null-prune trailing slots
    // to release memory registers back to the browser GC.
    const windowedLabels = labels.slice(-CHART_HISTORY_LIMIT);
    const windowedValues = values.slice(-CHART_HISTORY_LIMIT);
    // Explicit null-prune: overwrite any trailing undefined/null positions
    windowedLabels.length = windowedLabels.length;
    windowedValues.length = windowedValues.length;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: windowedLabels,
        datasets: [
          {
            label: "NGN/XLM traffic",
            data: windowedValues,
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
        events: [],
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

    const handlePointerMove = (event: PointerEvent) => {
      processPointerMove({
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: event.offsetX,
        offsetY: event.offsetY,
      });
    };

    const hideTooltip = () => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      chart.update("none");
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", hideTooltip);
    canvas.addEventListener("pointerout", hideTooltip);
    canvas.addEventListener("pointercancel", hideTooltip);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
      canvas.removeEventListener("pointerout", hideTooltip);
      canvas.removeEventListener("pointercancel", hideTooltip);
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, values, processPointerMove]);

  return (
    <div className="h-[280px] w-full">
      <canvas ref={canvasRef} aria-label="NGN/XLM traffic chart" />
    </div>
  );
}
