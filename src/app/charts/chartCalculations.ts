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

export interface TimePointValue {
  time: number;
  value: number;
}

/**
 * Calculates a Simple Moving Average (SMA) across timestamped price points.
 * Returns only data points starting where enough history exists for the window period.
 */
export function calculateSimpleMovingAverage(
  data: readonly { time: number; close: number }[],
  period: number = 20,
): TimePointValue[] {
  if (data.length < period || period <= 0) {
    return [];
  }

  const results: TimePointValue[] = [];
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;

    if (i >= period) {
      sum -= data[i - period].close;
    }

    if (i >= period - 1) {
      results.push({
        time: data[i].time,
        value: Number((sum / period).toFixed(6)),
      });
    }
  }

  return results;
}

/**
 * Calculates the Relative Strength Index (RSI) using Wilder's smoothed method.
 * Standard period is 14. Output values range between 0 and 100.
 */
export function calculateRSI(
  data: readonly { time: number; close: number }[],
  period: number = 14,
): TimePointValue[] {
  if (data.length <= period || period <= 0) {
    return [];
  }

  const results: TimePointValue[] = [];
  let gains = 0;
  let losses = 0;

  // First period average gain / loss
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) {
      gains += diff;
    } else {
      losses += Math.abs(diff);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  results.push({
    time: data[period].time,
    value: Number(rsi.toFixed(2)),
  });

  // Wilder's smoothing for subsequent periods
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    results.push({
      time: data[i].time,
      value: Number(rsi.toFixed(2)),
    });
  }

  return results;
}

