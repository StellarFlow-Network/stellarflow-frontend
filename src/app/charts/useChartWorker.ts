import { useCallback, useEffect, useRef } from "react";
import {
  windowSeries,
  aggregateSeriesStats,
  computeSparklinePoints,
  type SeriesStats,
  type SeriesWindow,
  type SparklineGeometry,
} from "./chartCalculations";
import type {
  ChartWorkerOutboundMessage,
  SeriesResultPayload,
} from "./chart-worker-types";

export interface SeriesComputation {
  window: SeriesWindow;
  stats: SeriesStats;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Offloads chart series/sparkline calculations to a dedicated Web Worker (#391)
 * so they run outside the main thread's critical interaction lane.
 *
 * When a worker is unavailable (SSR, unsupported runtime, or instantiation
 * failure) every method transparently falls back to the identical synchronous
 * implementation from `chartCalculations`, so callers can always `await` a
 * result without branching on environment.
 */
export function useChartWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    let worker: Worker;
    try {
      worker = new Worker(new URL("./chart-worker.ts", import.meta.url));
    } catch {
      // Leave workerRef null — methods fall back to synchronous computation.
      return;
    }
    workerRef.current = worker;

    const handleMessage = (
      event: MessageEvent<ChartWorkerOutboundMessage>,
    ) => {
      const { type, payload } = event.data;
      const request = pendingRef.current.get(payload.id);
      if (!request) return;

      clearTimeout(request.timeoutId);
      pendingRef.current.delete(payload.id);

      if (type === "CHART_ERROR") {
        request.reject(new Error(payload.error));
        return;
      }
      if (type === "SERIES_RESULT") {
        request.resolve({ window: payload.window, stats: payload.stats });
        return;
      }
      if (type === "SPARKLINE_RESULT") {
        request.resolve(payload.points);
      }
    };

    worker.addEventListener("message", handleMessage);

    return () => {
      worker.removeEventListener("message", handleMessage);
      pendingRef.current.forEach(({ timeoutId, reject }) => {
        clearTimeout(timeoutId);
        reject(new Error("Chart worker terminated"));
      });
      pendingRef.current.clear();
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const request = useCallback(
    <T>(
      id: string,
      message: object,
      fallback: () => T,
      timeoutMs: number = DEFAULT_TIMEOUT_MS,
    ): Promise<T> => {
      const worker = workerRef.current;
      if (!worker) {
        // No worker available — compute synchronously via the shared module.
        try {
          return Promise.resolve(fallback());
        } catch (err) {
          return Promise.reject(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      }

      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (pendingRef.current.delete(id)) {
            // Don't fail the UI on a slow worker — degrade to sync computation.
            try {
              resolve(fallback());
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          }
        }, timeoutMs);

        pendingRef.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timeoutId,
        });

        try {
          worker.postMessage(message);
        } catch (err) {
          clearTimeout(timeoutId);
          pendingRef.current.delete(id);
          // postMessage failed (e.g. non-cloneable data) — fall back to sync.
          try {
            resolve(fallback());
          } catch {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        }
      });
    },
    [],
  );

  const computeSeries = useCallback(
    (
      id: string,
      labels: string[],
      values: number[],
      limit?: number,
    ): Promise<SeriesComputation> =>
      request<SeriesComputation>(
        id,
        { type: "WINDOW_SERIES", payload: { id, labels, values, limit } },
        () => {
          const window = windowSeries(labels, values, limit);
          return { window, stats: aggregateSeriesStats(window.values) };
        },
      ),
    [request],
  );

  const computeSparkline = useCallback(
    (id: string, data: number[], geometry: SparklineGeometry): Promise<string> =>
      request<string>(
        id,
        { type: "COMPUTE_SPARKLINE", payload: { id, data, geometry } },
        () => computeSparklinePoints(data, geometry),
      ),
    [request],
  );

  return { computeSeries, computeSparkline };
}

export type { SeriesResultPayload };
