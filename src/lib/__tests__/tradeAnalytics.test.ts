import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePriceVariance,
  calculateRealizedSlippagePercent,
  deriveFillQualityRating,
  calculateGasToTradeSizeRatio,
  calculateMultiHopSlippage,
  type TradeHop,
} from "../tradeAnalytics.ts";

describe("Trade Analytics & Execution Fill Quality Profiler (#939)", () => {
  it("calculates price variance ΔP correctly", () => {
    // Expected rate = 1.25, Actual rate = 1.26 (Positive price improvement)
    const variancePositive = calculatePriceVariance(1.26, 1.25);
    assert.equal(variancePositive.toFixed(2), "0.01");

    // Expected rate = 1.25, Actual rate = 1.24 (Slippage)
    const varianceNegative = calculatePriceVariance(1.24, 1.25);
    assert.equal(varianceNegative.toFixed(2), "-0.01");
  });

  it("calculates realized slippage percent correctly", () => {
    // Expected output: 100 USDC, Actual output: 99.5 USDC -> 0.5% slippage
    const slippage = calculateRealizedSlippagePercent(100, 99.5);
    assert.equal(slippage.toFixed(1), "0.5");

    // Expected output: 100 USDC, Actual output: 100.2 USDC -> negative slippage (improvement)
    const improvement = calculateRealizedSlippagePercent(100, 100.2);
    assert.equal(improvement < 0, true);
  });

  it("assigns appropriate fill quality rating badges", () => {
    // Perfect fill
    assert.equal(deriveFillQualityRating(0.02, 0.001), "perfect");
    assert.equal(deriveFillQualityRating(-0.1, 0.05), "perfect");

    // Minimal slippage
    assert.equal(deriveFillQualityRating(0.45, -0.005), "minimal");
    assert.equal(deriveFillQualityRating(1.0, -0.01), "minimal");

    // High slippage
    assert.equal(deriveFillQualityRating(1.85, -0.03), "high");
    assert.equal(deriveFillQualityRating(4.5, -0.15), "high");
  });

  it("calculates gas to trade size ratio percentage", () => {
    // $0.0001 gas on $100 trade -> 0.0001%
    const ratio = calculateGasToTradeSizeRatio(0.0001, 100);
    assert.equal(ratio.toFixed(4), "0.0001");
  });

  it("evaluates multi-hop routed trades accurately", () => {
    const hops: TradeHop[] = [
      { fromAsset: "XLM", toAsset: "USDC", expectedRate: 0.12, actualRate: 0.12 },
      { fromAsset: "USDC", toAsset: "EURC", expectedRate: 0.92, actualRate: 0.915 },
    ];

    const result = calculateMultiHopSlippage(hops);
    assert.ok(result.cumulativeExpectedRate > 0);
    assert.ok(result.cumulativeActualRate > 0);
    assert.ok(result.totalHopSlippagePercent >= 0);
  });
});
