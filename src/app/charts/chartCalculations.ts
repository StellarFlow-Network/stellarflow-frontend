/**
 * Chart Calculation Utilities (#391)
 *
 * Pure, side-effect-free implementations of the heavy data sorting, windowing
 * and arithmetic aggregation algorithms that previously lived inline inside
 * chart render loops (`DashboardTrafficChart`, `RateSparklineCard`).
 *
 * Isolating them here gives the bundler a clean module boundary it can split
 * into its own chunk, and lets the exact same code run either synchronously
 * (SSR / first paint / fallback) or off the main thread inside `chart-worker`.
 *
 * Nothing in this file may touch the DOM, React, or any browser-only global so
 * that it stays safe to import from a Web Worker context.
 */

/** Maximum number of trailing samples retained for any rendered series. */
export const CHART_HISTORY_LIMIT = 150;

export interface SeriesWindow {
  labels: string[];
  values: number[];
}

export interface SeriesStats {
  /** Number of samples in the windowed series. */
  count: number;
  min: number;
  max: number;
  /** Sum of all sampled values. */
  sum: number;
  /** Arithmetic mean of the windowed series (0 when empty). */
  average: number;
  /** Difference between the latest and earliest sample (0 when < 2 samples). */
  delta: number;
}

/**
 * Branchless, stack-safe min/max scan.
 *
 * `Math.min(...arr)` / `Math.max(...arr)` spread the whole series onto the call
 * stack and overflow on large inputs — exactly the kind of work this issue asks
 * us to move off the critical path. A single linear reduce is both safe and
 * cheaper.
 */
function minMax(values: readonly number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

/**
 * Caps a label/value series to the last `limit` samples.
 *
 * Returns fresh arrays so callers never mutate the caller's source data, and
 * keeps labels and values index-aligned even when their lengths disagree.
 */
export function windowSeries(
  labels: readonly string[],
  values: readonly number[],
  limit: number = CHART_HISTORY_LIMIT,
): SeriesWindow {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return {
    labels: labels.slice(-safeLimit),
    values: values.slice(-safeLimit),
  };
}

/**
 * Computes the arithmetic aggregates a chart needs (min/max/sum/average/delta)
 * for an already-windowed value series in a single pass.
 */
export function aggregateSeriesStats(values: readonly number[]): SeriesStats {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, sum: 0, average: 0, delta: 0 };
  }

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
  }

  const { min, max } = minMax(values);
  return {
    count: values.length,
    min,
    max,
    sum,
    average: sum / values.length,
    delta: values[values.length - 1] - values[0],
  };
}

export interface SparklineGeometry {
  width: number;
  height: number;
  limit?: number;
}

/**
 * Builds the `points` attribute for an SVG sparkline `<polyline>`: windows the
 * data, derives its min/max range, then normalises each sample into the target
 * viewport. Returns an empty string when there is too little data to draw a
 * line (matching the previous component behaviour).
 */
export function computeSparklinePoints(
  data: readonly number[],
  { width, height, limit = CHART_HISTORY_LIMIT }: SparklineGeometry,
): string {
  const windowed = data.slice(-Math.max(0, Math.trunc(limit)));

  if (windowed.length < 2) {
    return "";
  }

  const { min, max } = minMax(windowed);
  const range = max - min || 1;
  const lastIndex = windowed.length - 1;

  let out = "";
  for (let index = 0; index <= lastIndex; index += 1) {
    const x = (index / lastIndex) * width;
    const y = height - ((windowed[index] - min) / range) * height;
    out += index === 0 ? `${x},${y}` : ` ${x},${y}`;
  }
  return out;
}
