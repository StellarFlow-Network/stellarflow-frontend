import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as ReactDOMServer from "react-dom/server";
import {
  DEFAULT_ARBITRAGE_THRESHOLD,
  buildReserveRatioBarElement,
  computePoolPrice,
  computePriceDeviationPercent,
  computeReserveRatioProjection,
  describeDrift,
  formatPercent,
  formatReserve,
  formatSignedPercent,
  shouldSuggestArbitrage,
  toFiniteReserve,
} from "../../src/components/amm/PoolReserveMonitor.helpers.ts";

function closeTo(actual: number, expected: number, epsilon = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

describe("PoolReserveMonitor numeric projection", () => {
  it("coerces non-finite and negative reserves to zero", () => {
    assert.equal(toFiniteReserve("1200.5"), 1200.5);
    assert.equal(toFiniteReserve("not-a-number"), 0);
    assert.equal(toFiniteReserve(-5), 0);
    assert.equal(toFiniteReserve(Number.NaN), 0);
    assert.equal(toFiniteReserve(0), 0);
  });

  it("preserves caller-precision strings when formatting reserves", () => {
    assert.equal(formatReserve("12345678901234567890"), "12345678901234567890");
    assert.equal(formatReserve(42_500_000), "42,500,000");
    assert.equal(formatReserve(1.234567), "1.2346");
  });

  it("derives unit shares and the pool price without a spot price", () => {
    const projection = computeReserveRatioProjection({
      reserveA: 60,
      reserveB: 40,
    });

    closeTo(projection.shareA, 0.6);
    closeTo(projection.shareB, 0.4);
    closeTo(projection.poolPrice, 40 / 60);
    closeTo(projection.driftPercent, 10);
    assert.equal(projection.valueWeighted, false);
    assert.equal(projection.priceDeviationPercent, null);
    assert.equal(projection.arbitrageAvailable, false);
  });

  it("weights the split by value when a spot price is supplied", () => {
    const projection = computeReserveRatioProjection({
      reserveA: 100,
      reserveB: 100,
      spotPrice: 2,
    });

    closeTo(projection.valueA, 200);
    closeTo(projection.valueB, 100);
    closeTo(projection.shareA, 200 / 300);
    closeTo(projection.shareB, 100 / 300);
    closeTo(projection.driftPercent, (200 / 300 - 0.5) * 100);
    assert.equal(projection.valueWeighted, true);
  });

  it("falls back to a neutral 50/50 split for an empty pool", () => {
    const projection = computeReserveRatioProjection({
      reserveA: 0,
      reserveB: 0,
    });

    closeTo(projection.shareA, 0.5);
    closeTo(projection.shareB, 0.5);
    assert.equal(projection.totalReserve, 0);
  });

  it("computes the pool price and its deviation from the market price", () => {
    closeTo(computePoolPrice(2, 3), 1.5);
    assert.equal(computePoolPrice(0, 3), 0);
    assert.equal(computePriceDeviationPercent(1.5), null);
    closeTo(computePriceDeviationPercent(1.5, 1.5) ?? Number.NaN, 0);
    closeTo(computePriceDeviationPercent(1.53, 1.5) ?? Number.NaN, 2);
  });

  it("gates the arbitrage signal on the deviation threshold", () => {
    assert.equal(shouldSuggestArbitrage(null), false);
    assert.equal(shouldSuggestArbitrage(0.4), false);
    assert.equal(shouldSuggestArbitrage(1), true);
    assert.equal(shouldSuggestArbitrage(-2.5), true);
    assert.equal(shouldSuggestArbitrage(-2.5, 0.03), false);

    const projection = computeReserveRatioProjection({
      reserveA: 100,
      reserveB: 104,
      spotPrice: 1,
      arbitrageThreshold: DEFAULT_ARBITRAGE_THRESHOLD,
    });
    assert.equal(projection.arbitrageAvailable, true);
    closeTo(projection.priceDeviationPercent ?? Number.NaN, 4);
  });

  it("classifies drift severity", () => {
    assert.equal(describeDrift(0), "balanced");
    assert.equal(describeDrift(1.99), "balanced");
    assert.equal(describeDrift(2), "moderate");
    assert.equal(describeDrift(-5), "severe");
  });

  it("formats percentages for display", () => {
    assert.equal(formatPercent(62.5), "62.50%");
    assert.equal(formatSignedPercent(2.5), "+2.50%");
    assert.equal(formatSignedPercent(-2.5), "-2.50%");
    assert.equal(formatSignedPercent(0), "0.00%");
  });
});

describe("PoolReserveMonitor ratio bar markup", () => {
  it("renders both segments with their exact widths and an accessible label", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      buildReserveRatioBarElement({
        shareA: 0.625,
        shareB: 0.375,
        label: "XLM / USDC reserve ratio: 62.50% XLM, 37.50% USDC",
        barClassName: "bar",
        segmentAClassName: "segment-a",
        segmentBClassName: "segment-b",
        markerClassName: "marker",
      }),
    );

    assert.match(html, /role="img"/);
    assert.match(
      html,
      /aria-label="XLM \/ USDC reserve ratio: 62\.50% XLM, 37\.50% USDC"/,
    );
    assert.match(html, /class="segment-a"[^>]*style="width:62\.5%"/);
    assert.match(html, /class="segment-b"[^>]*style="width:37\.5%"/);
    assert.match(html, /class="marker"[^>]*style="left:50%"/);
  });

  it("clamps out-of-range shares into the bar", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      buildReserveRatioBarElement({
        shareA: 1.4,
        shareB: -0.4,
        label: "clamped",
        segmentAClassName: "a",
        segmentBClassName: "b",
      }),
    );

    assert.match(html, /class="a"[^>]*style="width:100%"/);
    assert.match(html, /class="b"[^>]*style="width:0%"/);
  });
});
