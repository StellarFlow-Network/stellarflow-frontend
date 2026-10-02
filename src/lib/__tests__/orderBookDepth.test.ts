import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accumulateAsks,
  accumulateBids,
  buildDepthChartModel,
  buildDepthSeries,
  computeMarketSpread,
  computeZoomDomain,
  getPriceDomain,
  getVisibleMaxDepth,
  resolveDepthViewport,
  roundUpToNiceNumber,
  slicePointsToDomain,
  type DepthChartPoint,
} from "../orderBookDepth.ts";

const level = (price: number, amount: number) => ({ price, amount, total: 0 });

const BIDS = [level(99, 20), level(100, 10), level(98, 30)];
const ASKS = [level(102, 5), level(101, 15), level(103, 25)];

describe("Cumulative order book depth (#997)", () => {
  it("accumulates bids from the best (highest) price outward", () => {
    assert.deepEqual(accumulateBids(BIDS), [
      { price: 100, amount: 10, cumulativeVolume: 10 },
      { price: 99, amount: 20, cumulativeVolume: 30 },
      { price: 98, amount: 30, cumulativeVolume: 60 },
    ]);
  });

  it("accumulates asks from the best (lowest) price outward", () => {
    assert.deepEqual(accumulateAsks(ASKS), [
      { price: 101, amount: 15, cumulativeVolume: 15 },
      { price: 102, amount: 5, cumulativeVolume: 20 },
      { price: 103, amount: 25, cumulativeVolume: 45 },
    ]);
  });

  it("recomputes cumulative volume from amounts instead of trusting feed totals", () => {
    const levels = [
      { price: 100, amount: 10, total: 999 },
      { price: 99, amount: 5, total: 999 },
    ];
    assert.deepEqual(
      accumulateBids(levels).map(({ cumulativeVolume }) => cumulativeVolume),
      [10, 15],
    );
  });

  it("merges duplicate price levels and drops invalid ones", () => {
    const levels = [
      level(100, 10),
      level(100, 5),
      level(99, 0),
      level(-1, 10),
      level(Number.NaN, 10),
      level(98, Number.POSITIVE_INFINITY),
    ];
    assert.deepEqual(accumulateBids(levels), [{ price: 100, amount: 15, cumulativeVolume: 15 }]);
  });

  it("builds a price-ascending series with side-specific depth", () => {
    const series = buildDepthSeries(accumulateBids(BIDS), accumulateAsks(ASKS));

    assert.deepEqual(series, [
      { price: 98, bidDepth: 60, askDepth: null },
      { price: 99, bidDepth: 30, askDepth: null },
      { price: 100, bidDepth: 10, askDepth: null },
      { price: 101, bidDepth: null, askDepth: 15 },
      { price: 102, bidDepth: null, askDepth: 20 },
      { price: 103, bidDepth: null, askDepth: 45 },
    ]);
  });

  it("computes best bid, best ask, mid price and spread", () => {
    const spread = computeMarketSpread(accumulateBids(BIDS), accumulateAsks(ASKS));

    assert.ok(spread);
    assert.equal(spread.bestBid, 100);
    assert.equal(spread.bestAsk, 101);
    assert.equal(spread.midPrice, 100.5);
    assert.equal(spread.spread, 1);
    assert.ok(Math.abs(spread.spreadPercent - (1 / 100.5) * 100) < 1e-9);
  });

  it("returns no spread when either side of the book is empty", () => {
    assert.equal(computeMarketSpread(accumulateBids(BIDS), []), null);
    assert.equal(computeMarketSpread([], accumulateAsks(ASKS)), null);
  });

  it("derives the price domain and pads single-price books", () => {
    assert.equal(getPriceDomain([]), null);
    assert.deepEqual(
      getPriceDomain(buildDepthSeries(accumulateBids(BIDS), accumulateAsks(ASKS))),
      { min: 98, max: 103 },
    );

    const padded = getPriceDomain([{ price: 100, bidDepth: 1, askDepth: null }]);
    assert.ok(padded);
    assert.ok(padded.min < 100 && padded.max > 100);
  });

  it("builds an empty model when the book has no valid liquidity", () => {
    assert.deepEqual(buildDepthChartModel([], []), { points: [], spread: null, domain: null });
  });

  it("narrows the zoom domain around the mid price and clamps to the full range", () => {
    const fullDomain = { min: 98, max: 103 };

    assert.deepEqual(computeZoomDomain(fullDomain, 100.5, 1), fullDomain);
    assert.deepEqual(computeZoomDomain(fullDomain, 100.5, 2), { min: 99.25, max: 101.75 });
    assert.deepEqual(computeZoomDomain(fullDomain, 100.5, 0), fullDomain);
  });

  it("keeps the spread visible at maximum zoom", () => {
    const zoomed = computeZoomDomain({ min: 98, max: 103 }, 100.5, 1000, 0.75);
    assert.deepEqual(zoomed, { min: 99.75, max: 101.25 });
  });

  it("slices points to the domain while keeping one neighbour on each side", () => {
    const points = buildDepthSeries(accumulateBids(BIDS), accumulateAsks(ASKS));
    const sliced = slicePointsToDomain(points, { min: 99.5, max: 101.5 });

    assert.deepEqual(
      sliced.map(({ price }) => price),
      [99, 100, 101, 102],
    );
    assert.deepEqual(slicePointsToDomain(points, { min: 200, max: 300 }), []);
    assert.deepEqual(slicePointsToDomain(points, { min: 1, max: 2 }), []);
  });

  it("measures only the depth that is visible inside the domain", () => {
    const points: DepthChartPoint[] = [
      { price: 98, bidDepth: 60, askDepth: null },
      { price: 99, bidDepth: 30, askDepth: null },
      { price: 100, bidDepth: 10, askDepth: null },
      { price: 101, bidDepth: null, askDepth: 15 },
      { price: 102, bidDepth: null, askDepth: 20 },
      { price: 103, bidDepth: null, askDepth: 45 },
    ];

    assert.equal(getVisibleMaxDepth(points, { min: 99.5, max: 101.5 }), 15);
    assert.equal(getVisibleMaxDepth(points, { min: 98, max: 103 }), 60);
    assert.equal(getVisibleMaxDepth(points, { min: 101.2, max: 101.8 }), 15);
  });

  it("rounds axis bounds up to half-magnitude steps", () => {
    assert.equal(roundUpToNiceNumber(6700), 7000);
    assert.equal(roundUpToNiceNumber(462), 500);
    assert.equal(roundUpToNiceNumber(1200), 1500);
    assert.equal(roundUpToNiceNumber(5000), 5000);
    assert.equal(roundUpToNiceNumber(0.37), 0.4);
    assert.equal(roundUpToNiceNumber(0), 0);
    assert.equal(roundUpToNiceNumber(Number.NaN), 0);
  });

  it("resolves a zoomed viewport with rescaled depth", () => {
    const model = buildDepthChartModel(BIDS, ASKS);

    assert.equal(resolveDepthViewport(buildDepthChartModel([], []), 1, 1.5), null);

    const full = resolveDepthViewport(model, 1, 1.5);
    assert.ok(full);
    assert.deepEqual(full.domain, { min: 98, max: 103 });
    assert.equal(full.maxDepth, 60);

    const focused = resolveDepthViewport(model, 32, 1.5);
    assert.ok(focused);
    assert.deepEqual(focused.domain, { min: 99.75, max: 101.25 });
    assert.equal(focused.maxDepth, 15);
  });
});
