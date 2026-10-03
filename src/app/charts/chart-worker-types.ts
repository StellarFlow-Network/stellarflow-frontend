// ─── Chart Worker Message Types (#391) ──────────────────────────────────────
//
// Message protocol for offloading chart sorting/aggregation/normalisation work
// to a dedicated Web Worker, mirroring the XDR worker thread-isolation pattern.

import type {
  SeriesWindow,
  SeriesStats,
  SparklineGeometry,
} from "./chartCalculations";

export type ChartWorkerInboundType = "WINDOW_SERIES" | "COMPUTE_SPARKLINE";
export type ChartWorkerOutboundType =
  | "SERIES_RESULT"
  | "SPARKLINE_RESULT"
  | "CHART_ERROR";

// ─── Inbound (Main Thread → Worker) ──────────────────────────────────────────

export interface WindowSeriesPayload {
  id: string;
  labels: string[];
  values: number[];
  limit?: number;
}

export interface ComputeSparklinePayload {
  id: string;
  data: number[];
  geometry: SparklineGeometry;
}

export interface WindowSeriesMessage {
  type: "WINDOW_SERIES";
  payload: WindowSeriesPayload;
}

export interface ComputeSparklineMessage {
  type: "COMPUTE_SPARKLINE";
  payload: ComputeSparklinePayload;
}

export type ChartWorkerInboundMessage =
  | WindowSeriesMessage
  | ComputeSparklineMessage;

// ─── Outbound (Worker → Main Thread) ─────────────────────────────────────────

/** Windowed series plus its pre-computed arithmetic aggregates. */
export interface SeriesResultPayload {
  id: string;
  window: SeriesWindow;
  stats: SeriesStats;
}

export interface SparklineResultPayload {
  id: string;
  points: string;
}

export interface ChartErrorPayload {
  id: string;
  error: string;
}

export interface SeriesResultMessage {
  type: "SERIES_RESULT";
  payload: SeriesResultPayload;
}

export interface SparklineResultMessage {
  type: "SPARKLINE_RESULT";
  payload: SparklineResultPayload;
}

export interface ChartErrorMessage {
  type: "CHART_ERROR";
  payload: ChartErrorPayload;
}

export type ChartWorkerOutboundMessage =
  | SeriesResultMessage
  | SparklineResultMessage
  | ChartErrorMessage;
