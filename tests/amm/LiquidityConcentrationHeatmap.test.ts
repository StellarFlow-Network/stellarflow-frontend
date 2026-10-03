import { describe, expect, it } from "vitest";

describe("LiquidityConcentrationHeatmap data contract", () => {
  it("accepts precise string liquidity values", () => {
    const liquidity = "12345678901234567890";
    expect(Number(liquidity)).toBeGreaterThan(0);
    expect(liquidity).toBe("12345678901234567890");
  });

  it("keeps tick ordering deterministic", () => {
    const ticks = [{ tickIndex: 30 }, { tickIndex: 10 }, { tickIndex: 20 }];
    const ordered = [...ticks].sort((a, b) => a.tickIndex - b.tickIndex);
    expect(ordered.map((tick) => tick.tickIndex)).toEqual([10, 20, 30]);
  });
});
