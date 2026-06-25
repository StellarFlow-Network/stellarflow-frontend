/// <reference lib="webworker" />
//
// Chart Calculation Worker (#391)
//
// Runs the heavy series windowing + arithmetic aggregation + sparkline
// normalisation off the main thread so active chart changes never block the
// UI's critical interaction lane. All maths lives in the shared, pure
// `chartCalculations` module — this file is purely the message-passing shell.

import {
  windowSeries,
  aggregateSeriesStats,
  computeSparklinePoints,
} from "./chartCalculations";
import type {
  ChartWorkerInboundMessage,
  ChartWorkerOutboundMessage,
} from "./chart-worker-types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: ChartWorkerOutboundMessage) {
  ctx.postMessage(message);
}

ctx.addEventListener(
  "message",
  (event: MessageEvent<ChartWorkerInboundMessage>) => {
    const { type, payload } = event.data;

    try {
      switch (type) {
        case "WINDOW_SERIES": {
          const window = windowSeries(
            payload.labels,
            payload.values,
            payload.limit,
          );
          post({
            type: "SERIES_RESULT",
            payload: {
              id: payload.id,
              window,
              stats: aggregateSeriesStats(window.values),
            },
          });
          break;
        }

        case "COMPUTE_SPARKLINE": {
          post({
            type: "SPARKLINE_RESULT",
            payload: {
              id: payload.id,
              points: computeSparklinePoints(payload.data, payload.geometry),
            },
          });
          break;
        }

        default: {
          // Exhaustiveness guard — `type` is `never` here if all cases handled.
          const unknown = type as string;
          post({
            type: "CHART_ERROR",
            payload: {
              id: (payload as { id?: string })?.id ?? "unknown",
              error: `Unknown chart worker message type: ${unknown}`,
            },
          });
        }
      }
    } catch (err) {
      post({
        type: "CHART_ERROR",
        payload: {
          id: (payload as { id?: string })?.id ?? "unknown",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  },
);
