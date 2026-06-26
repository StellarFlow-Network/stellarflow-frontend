"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
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
import { useChartWorker } from "../charts/useChartWorker";
import {
  windowSeries,
  CHART_HISTORY_LIMIT,
  type SeriesWindow,
} from "../charts/chartCalculations";

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
  const { computeSeries } = useChartWorker();

  // Track pointer state for RAF loop
  const pointerPositionRef = useRef<PointerPosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const isHoveringRef = useRef(false);
  const updateTooltipRef = useRef<(() => void) | null>(null);

  // Seed synchronously from the shared module so the first paint is correct;
  // the worker then re-windows off the main thread when inputs change.
  const [series, setSeries] = useState<SeriesWindow>(() =>
    windowSeries(labels, values, CHART_HISTORY_LIMIT),
  );

  // Rigid 60 FPS animation loop to update tooltip
  // Use a ref-based pattern to avoid self-referential issues
  useEffect(() => {
    const updateTooltip = () => {
      const chart = chartRef.current;
      const position = pointerPositionRef.current;

      if (!chart) return;

      if (isHoveringRef.current && position) {
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

        if (chart.tooltip) {
          chart.tooltip.setActiveElements(activeElements, {
            x: position.clientX,
            y: position.clientY,
          });
        }

        chart.update("none");
      }

      rafRef.current = requestAnimationFrame(updateTooltip);
    };

    updateTooltipRef.current = updateTooltip;
    rafRef.current = requestAnimationFrame(updateTooltip);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Offload the data sorting / windowing / aggregation to the chart worker so
  // it stays out of the critical interaction lane during active chart changes.
  // Create stable dependency keys from array content to prevent unnecessary re-triggers
  // when parent passes new array instances with identical content.
  const dependencyKey = useMemo(() => {
    return `labels:${labels.length}:${labels.join(',')}|values:${values.length}:${values.join(',')}`;
  }, [labels, values]);
  
  useEffect(() => {
    let cancelled = false;
    computeSeries("dashboard-traffic", labels, values, CHART_HISTORY_LIMIT)
      .then(({ window }) => {
        if (!cancelled) setSeries(window);
      })
      .catch(() => {
        // Worker failed unexpectedly — keep the last good (synchronous) window.
      });
    return () => {
      cancelled = true;
    };
  }, [dependencyKey, computeSeries]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels and values are already reflected in series state
    if (!canvasRef.current) return;

    const { labels: windowedLabels, values: windowedValues } = series;

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
      isHoveringRef.current = true;
      pointerPositionRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: event.offsetX,
        offsetY: event.offsetY,
      };
    };

    const hideTooltip = () => {
      isHoveringRef.current = false;
      pointerPositionRef.current = null;
      const chart = chartRef.current;
      if (!chart) return;
      if (chart.tooltip) {
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      }
      chart.update("none");
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerleave", hideTooltip, { passive: true });
    canvas.addEventListener("pointerout", hideTooltip, { passive: true });
    canvas.addEventListener("pointercancel", hideTooltip, { passive: true });

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
      canvas.removeEventListener("pointerout", hideTooltip);
      canvas.removeEventListener("pointercancel", hideTooltip);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [series]);

  return (
    <div className="aspect-[16/9] min-h-[280px] w-full">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="NGN/XLM traffic chart" />
    </div>
  );
}
