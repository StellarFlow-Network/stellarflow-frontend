/**
 * tickAggregation — pure helpers for order-book tick aggregation (Issue #969).
 *
 * The order book WebSocket streams fine-grained price levels. This module
 * groups those levels into price buckets of a caller-chosen tick step and
 * derives the cumulative volume / depth ratios the UI needs to draw scaling
 * depth bars.
 *
 * Everything here is a pure function over plain data so it can be unit tested
 * with Node's built-in test runner and reused by any renderer. Persistence and
 * React wiring live in `TickAggregationController.tsx`.
 */

/** A raw order-book level as streamed over the socket. */
export interface TickSourceLevel {
  price: number;
  amount: number;
  /** Existing cumulative total from the socket feed (recomputed here). */
  total?: number;
}

/** One aggregated price bucket. */
export interface AggregatedLevel {
  /** Bucket lower bound, snapped to the tick grid (floor of `price / tick`). */
  price: number;
  /** Summed size of every source level that fell into this bucket. */
  amount: number;
  /** Cumulative size from the top of the book through this bucket. */
  total: number;
  /** Cumulative size as a fraction in [0, 1] of the deepest reference total. */
  depthRatio: number;
}

export type OrderBookSide = "bid" | "ask";

/** Fallback tick steps matching the issue's example granularity. */
export const DEFAULT_TICK_STEPS: readonly number[] = [0.001, 0.01, 0.1, 1];

/** Per-market predefined tick steps. Keys are normalised `BASE-QUOTE` pairs. */
export const MARKET_TICK_STEPS: Readonly<Record<string, readonly number[]>> = {
  "NGN-XLM": [0.1, 0.5, 1, 5],
  "USD-XLM": [0.0001, 0.001, 0.01, 0.1],
  "EUR-XLM": [0.0001, 0.001, 0.01, 0.1],
};

/** Uppercases and normalises separators so `usd / xlm` and `USD-XLM` match. */
export function normalizeMarket(pair: string): string {
  return String(pair ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Predefined tick step options for a trading pair (per-market, with fallback). */
export function getTickStepOptions(pair: string): readonly number[] {
  return MARKET_TICK_STEPS[normalizeMarket(pair)] ?? DEFAULT_TICK_STEPS;
}

/** The default tick step for a pair — the second-smallest predefined option. */
export function getDefaultTickSize(pair: string): number {
  const options = getTickStepOptions(pair);
  return options.length > 1 ? options[1] : options[0] ?? DEFAULT_TICK_STEPS[1];
}

/** Number of decimal places implied by a tick step (e.g. `0.001` -> 3). */
export function decimalsForTick(tickSize: number): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return 0;

  const text = tickSize.toString();
  const exponentIndex = text.indexOf("e-");
  if (exponentIndex !== -1) {
    const exponent = Number(text.slice(exponentIndex + 2));
    return Number.isFinite(exponent) ? exponent : 0;
  }

  const dotIndex = text.indexOf(".");
  return dotIndex === -1 ? 0 : text.length - dotIndex - 1;
}

/** Coerces a step to a usable positive number, falling back when invalid. */
export function normalizeTickSize(
  tickSize: number,
  fallback: number = DEFAULT_TICK_STEPS[0],
): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return fallback;
  return tickSize;
}

/**
 * Buckets a level price onto the tick grid, returning the bucket's lower bound.
 * Uses a relative epsilon so floor() does not slip a bucket on values such as
 * `0.12 / 0.0001`, then rounds to the tick's own precision to strip binary
 * floating-point noise (e.g. `3 * 0.1` -> `0.3`).
 */
export function bucketStart(price: number, tickSize: number): number {
  const step = normalizeTickSize(tickSize);
  if (!Number.isFinite(price)) return price;

  const raw = price / step;
  const index = Math.floor(raw + Math.abs(raw) * Number.EPSILON * 4);
  return Number((index * step).toFixed(decimalsForTick(step)));
}

/**
 * Validates a persisted / user-supplied tick size against the allowed options.
 * Returns the exact matching option, or `fallback` when the value is invalid or
 * not part of the market's predefined set (so the `<select>` always matches).
 */
export function parseTickSize(
  raw: unknown,
  allowed: readonly number[],
  fallback: number,
): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;

  const match = allowed.find((option) => Math.abs(option - value) < 1e-12);
  return match ?? fallback;
}

/** localStorage key holding a market's preferred tick step. */
export function tickPreferenceKey(pair: string): string {
  const market = normalizeMarket(pair) || "default";
  return `stellarflow:tick-size:${market}`;
}

/** Rounds volume sums to 12 significant digits to absorb float accumulation. */
function roundAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toPrecision(12));
}

/**
 * Groups `levels` into buckets of `tickSize`, summing amount per bucket. Bids
 * stay best (highest) first and asks best (lowest) first; `total` is the running
 * cumulative from the top of that side through the bucket. Pass `depth` to keep
 * only the top N aggregated buckets.
 */
export function aggregateLevels(
  levels: readonly TickSourceLevel[],
  tickSize: number,
  side: OrderBookSide,
  depth?: number,
): AggregatedLevel[] {
  const step = normalizeTickSize(tickSize);
  if (!Array.isArray(levels) || levels.length === 0) return [];

  const ordered = levels
    .filter(
      (level) =>
        Number.isFinite(level?.price) &&
        Number.isFinite(level?.amount) &&
        level.amount >= 0,
    )
    .slice()
    .sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));

  const buckets: AggregatedLevel[] = [];
  const bucketIndex = new Map<number, number>();

  for (const level of ordered) {
    const key = bucketStart(level.price, step);
    let position = bucketIndex.get(key);

    if (position === undefined) {
      position = buckets.length;
      bucketIndex.set(key, position);
      buckets.push({ price: key, amount: 0, total: 0, depthRatio: 0 });
    }

    buckets[position].amount = roundAmount(
      buckets[position].amount + level.amount,
    );
  }

  const trimmed =
    depth !== undefined && depth > 0 ? buckets.slice(0, depth) : buckets;

  let cumulative = 0;
  return trimmed.map((bucket) => {
    cumulative = roundAmount(cumulative + bucket.amount);
    return { ...bucket, total: cumulative };
  });
}

/**
 * Recomputes cumulative depth ratios in [0, 1]. Pass `referenceTotal` to scale
 * both book sides against a single shared maximum; otherwise the deepest level
 * in `levels` is the reference.
 */
export function computeDepthRatios(
  levels: readonly AggregatedLevel[],
  referenceTotal?: number,
): AggregatedLevel[] {
  if (levels.length === 0) return [];

  const deepest = levels[levels.length - 1]?.total ?? 0;
  const reference =
    typeof referenceTotal === "number" &&
    Number.isFinite(referenceTotal) &&
    referenceTotal > 0
      ? referenceTotal
      : deepest;
  const denominator = reference > 0 ? reference : 1;

  return levels.map((level) => ({
    ...level,
    depthRatio: Math.min(1, Math.max(0, level.total / denominator)),
  }));
}
