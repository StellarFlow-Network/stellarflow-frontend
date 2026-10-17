import { describe, expect, it } from "vitest";
import { calculateILScenario, calculateImpermanentLoss } from "@/components/pools/ilCalculatorMath";

describe("impermanent loss calculator math", () => {
  it("matches HODL when both assets move by the same amount", () => {
    const result = calculateILScenario({
      assetAChange: 100,
      assetBChange: 100,
      initialInvestment: 1000,
      feeEarningsPercent: 0,
    });

    expect(result.hodlValue).toBe(2000);
    expect(result.poolValue).toBe(2000);
    expect(result.netImpermanentLoss).toBe(0);
  });

  it("uses the constant-product pool value for a diverging price pair", () => {
    const result = calculateILScenario({
      assetAChange: 100,
      assetBChange: 0,
      initialInvestment: 1000,
      feeEarningsPercent: 0,
    });

    expect(result.hodlValue).toBe(1500);
    expect(result.poolValue).toBeCloseTo(1000 * Math.sqrt(2));
    expect(result.grossImpermanentLoss).toBeCloseTo(calculateImpermanentLoss(2));
    expect(result.netImpermanentLoss).toBeCloseTo(-5.71909584);
  });

  it("applies pool fees to the LP value when calculating net IL", () => {
    const withoutFees = calculateILScenario({
      assetAChange: 100,
      assetBChange: 0,
      initialInvestment: 1000,
      feeEarningsPercent: 0,
    });
    const withFees = calculateILScenario({
      assetAChange: 100,
      assetBChange: 0,
      initialInvestment: 1000,
      feeEarningsPercent: 10,
    });

    expect(withFees.feeIncome).toBe(100);
    expect(withFees.netImpermanentLoss).toBeGreaterThan(withoutFees.netImpermanentLoss);
  });

  it("keeps zero-price edge cases finite", () => {
    const result = calculateILScenario({
      assetAChange: -200,
      assetBChange: -200,
      initialInvestment: 1000,
      feeEarningsPercent: 0,
    });
    expect(result.hodlValue).toBe(0);
    expect(result.poolValue).toBe(0);
    expect(result.netImpermanentLoss).toBe(0);
  });
});
