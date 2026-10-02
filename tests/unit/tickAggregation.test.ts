import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_TICK_STEPS,
  aggregateLevels,
  bucketStart,
  computeDepthRatios,
  decimalsForTick,
  getDefaultTickSize,
  getTickStepOptions,
  normalizeMarket,
  normalizeTickSize,
  parseTickSize,
  tickPreferenceKey,
  type AggregatedLevel,
} from "../../src/components/trading/tickAggregation.ts";

describe("tick aggregation bucketing", () => {
  it("merges levels that fall into the same tick bucket and sums their amount", () => {
    const result = aggregateLevels(
      [
        { price: 100.4, amount: 2, total: 2 },
        { price: 100.9, amount: 3, total: 5 },
        { price: 99.2, amount: 1, total: 6 },
      ],
      1,
      "bid",
    );

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(
      result.map((level) => level.price),
      [100, 99],
    );
    assert.deepStrictEqual(
      result.map((level) => level.amount),
      [5, 1],
    );
    assert.deepStrictEqual(
      result.map((level) => level.total),
      [5, 6],
    );
  });

  it("keeps distinct buckets separate when prices do not share a bucket", () => {
    const result = aggregateLevels(
      [
        { price: 100.004, amount: 2 },
        { price: 99.998, amount: 3 },
        { price: 99.001, amount: 1 },
      ],
      0.01,
      "bid",
    );

    assert.deepStrictEqual(
      result.map((level) => level.price),
      [100, 99.99, 99],
    );
    assert.deepStrictEqual(
      result.map((level) => level.total),
      [2, 5, 6],
    );
  });

  it("orders bids highest-first and asks lowest-first with running totals", () => {
    const bids = aggregateLevels(
      [
        { price: 10.5, amount: 1 },
        { price: 11.2, amount: 2 },
      ],
      1,
      "bid",
    );
    const asks = aggregateLevels(
      [
        { price: 13.8, amount: 2 },
        { price: 12.1, amount: 1 },
      ],
      1,
      "ask",
    );

    assert.deepStrictEqual(
      bids.map((level) => level.price),
      [11, 10],
    );
    assert.deepStrictEqual(
      bids.map((level) => level.total),
      [2, 3],
    );
    assert.deepStrictEqual(
      asks.map((level) => level.price),
      [12, 13],
    );
    assert.deepStrictEqual(
      asks.map((level) => level.total),
      [1, 3],
    );
  });

  it("trims to the requested depth and recomputes cumulative totals afterwards", () => {
    const result = aggregateLevels(
      [
        { price: 10, amount: 1 },
        { price: 9, amount: 2 },
        { price: 8, amount: 4 },
      ],
      1,
      "bid",
      2,
    );

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(
      result.map((level) => level.total),
      [1, 3],
    );
  });

  it("ignores non-finite prices and negative amounts", () => {
    const result = aggregateLevels(
      [
        { price: Number.NaN, amount: 5 },
        { price: Number.POSITIVE_INFINITY, amount: 5 },
        { price: 1, amount: -1 },
        { price: 1, amount: 2 },
      ],
      1,
      "bid",
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].amount, 2);
    assert.strictEqual(result[0].total, 2);
  });
});

describe("tick rounding and edge cases", () => {
  it("floors prices onto the tick grid without floating-point bucket slips", () => {
    assert.strictEqual(bucketStart(100.004, 0.01), 100);
    assert.strictEqual(bucketStart(99.001, 0.01), 99);
    assert.strictEqual(bucketStart(0.3, 0.1), 0.3);
    assert.strictEqual(bucketStart(100.1, 0.1), 100.1);
    assert.strictEqual(bucketStart(0.12, 0.0001), 0.12);
    assert.strictEqual(bucketStart(1.0004, 0.001), 1);
  });

  it("derives decimal precision from the tick step", () => {
    assert.strictEqual(decimalsForTick(1), 0);
    assert.strictEqual(decimalsForTick(0.1), 1);
    assert.strictEqual(decimalsForTick(0.0001), 4);
    assert.strictEqual(decimalsForTick(1e-7), 7);
    assert.strictEqual(decimalsForTick(0), 0);
  });

  it("normalizes invalid tick sizes back to a usable positive step", () => {
    assert.strictEqual(normalizeTickSize(0.5), 0.5);
    assert.strictEqual(normalizeTickSize(0, 0.01), 0.01);
    assert.strictEqual(normalizeTickSize(-1, 0.01), 0.01);
    assert.strictEqual(normalizeTickSize(Number.NaN, 0.01), 0.01);
    assert.strictEqual(normalizeTickSize(Number.POSITIVE_INFINITY, 0.01), 0.01);
  });

  it("falls back to the default step and returns empty output for empty or invalid input", () => {
    assert.deepStrictEqual(aggregateLevels([], 0.01, "bid"), []);

    const withInvalidTick = aggregateLevels([{ price: 1.0004, amount: 1 }], 0, "bid");
    assert.strictEqual(withInvalidTick.length, 1);
    assert.strictEqual(withInvalidTick[0].price, 1);
  });

  it("validates a stored tick size against the market's allowed options", () => {
    const allowed = [0.01, 0.1, 1];
    assert.strictEqual(parseTickSize("0.1", allowed, 1), 0.1);
    assert.strictEqual(parseTickSize(0.1, allowed, 1), 0.1);
    assert.strictEqual(parseTickSize(0.05, allowed, 0.1), 0.1);
    assert.strictEqual(parseTickSize(0, allowed, 0.01), 0.01);
    assert.strictEqual(parseTickSize("abc", allowed, 0.01), 0.01);
  });
});

describe("cumulative depth ratios", () => {
  const levels: AggregatedLevel[] = [
    { price: 10, amount: 1, total: 1, depthRatio: 0 },
    { price: 9, amount: 2, total: 3, depthRatio: 0 },
    { price: 8, amount: 4, total: 7, depthRatio: 0 },
  ];

  it("scales cumulative totals to the deepest level and ends at 1", () => {
    const ratios = computeDepthRatios(levels).map((level) => level.depthRatio);

    assert.ok(Math.abs(ratios[0] - 1 / 7) < 1e-12);
    assert.ok(Math.abs(ratios[1] - 3 / 7) < 1e-12);
    assert.strictEqual(ratios[2], 1);
  });

  it("scales both book sides against a shared reference total", () => {
    const ratios = computeDepthRatios(levels, 14).map((level) => level.depthRatio);

    assert.ok(Math.abs(ratios[0] - 1 / 14) < 1e-12);
    assert.ok(Math.abs(ratios[1] - 3 / 14) < 1e-12);
    assert.ok(Math.abs(ratios[2] - 0.5) < 1e-12);
  });

  it("clamps ratios to the top of the bar when the reference is smaller", () => {
    const ratios = computeDepthRatios(levels, 3).map((level) => level.depthRatio);

    assert.strictEqual(ratios[0], 1 / 3);
    assert.strictEqual(ratios[1], 1);
    assert.strictEqual(ratios[2], 1);
  });

  it("returns an empty list for an empty order book side", () => {
    assert.deepStrictEqual(computeDepthRatios([]), []);
  });
});

describe("per-market tick preference derivation", () => {
  it("derives a stable localStorage key per market", () => {
    assert.strictEqual(tickPreferenceKey("USD-XLM"), "stellarflow:tick-size:USD-XLM");
    assert.strictEqual(tickPreferenceKey("USD-XLM"), tickPreferenceKey("USD-XLM"));
    assert.notStrictEqual(tickPreferenceKey("NGN-XLM"), tickPreferenceKey("USD-XLM"));
  });

  it("normalizes separators, spacing, and casing before keying", () => {
    assert.strictEqual(tickPreferenceKey("usd / xlm"), tickPreferenceKey("USD-XLM"));
    assert.strictEqual(normalizeMarket(" eur-xlm "), "EUR-XLM");
    assert.strictEqual(tickPreferenceKey(""), "stellarflow:tick-size:default");
  });

  it("exposes predefined tick steps per market with a safe fallback", () => {
    assert.deepStrictEqual(getTickStepOptions("USD-XLM"), [0.0001, 0.001, 0.01, 0.1]);
    assert.deepStrictEqual(getTickStepOptions("NGN-XLM"), [0.1, 0.5, 1, 5]);
    assert.deepStrictEqual(getTickStepOptions("usd / xlm"), [0.0001, 0.001, 0.01, 0.1]);
    assert.deepStrictEqual(getTickStepOptions("GBP-XLM"), DEFAULT_TICK_STEPS);
  });

  it("picks a sensible default step per market", () => {
    assert.strictEqual(getDefaultTickSize("USD-XLM"), 0.001);
    assert.strictEqual(getDefaultTickSize("NGN-XLM"), 0.5);
    assert.strictEqual(getDefaultTickSize("GBP-XLM"), DEFAULT_TICK_STEPS[1]);
  });
});
