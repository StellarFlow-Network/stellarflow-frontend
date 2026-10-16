import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateImpermanentLoss } from "../../src/components/analytics/impermanentLoss";
import { assessFrontRunningRisk } from "../../src/components/trading/frontRunningRisk";

describe("calculateImpermanentLoss", () => {
  it("compares LP value with HODL and includes fees in net ROI", () => {
    const result = calculateImpermanentLoss({
      initialAmountA: 1,
      initialAmountB: 100,
      initialPriceAUsd: 100,
      initialPriceBUsd: 1,
      currentPriceAUsd: 200,
      currentPriceBUsd: 1,
      currentLpValueUsd: 240,
      feesClaimedUsd: 10,
    });

    assert.equal(result.initialValueUsd, 200);
    assert.equal(result.hodlValueUsd, 300);
    assert.equal(result.impermanentLossUsd, -60);
    assert.equal(result.feeAdjustedLossUsd, -50);
    assert.equal(result.feeAdjustedRoiPercent, 25);
  });

  it("returns zero ROI when the initial deposit is zero", () => {
    const result = calculateImpermanentLoss({
      initialAmountA: 0,
      initialAmountB: 0,
      initialPriceAUsd: 100,
      initialPriceBUsd: 1,
      currentPriceAUsd: 200,
      currentPriceBUsd: 1,
      currentLpValueUsd: 5,
      feesClaimedUsd: 1,
    });

    assert.equal(result.feeAdjustedRoiPercent, 0);
  });
});

describe("assessFrontRunningRisk", () => {
  it("classifies orders by share of visible market depth", () => {
    assert.equal(assessFrontRunningRisk(50, 10_000).risk, "low");
    assert.equal(assessFrontRunningRisk(200, 10_000).risk, "medium");
    assert.equal(assessFrontRunningRisk(600, 10_000).risk, "severe");
  });

  it("treats unavailable depth conservatively", () => {
    const result = assessFrontRunningRisk(1, 0);

    assert.equal(result.risk, "severe");
    assert.equal(result.depthSharePercent, 100);
  });
});