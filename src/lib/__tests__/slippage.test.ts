import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PRESET_SLIPPAGE_OPTIONS,
  HIGH_SLIPPAGE_WARNING_THRESHOLD,
  MAX_SLIPPAGE_PERCENT,
  DEFAULT_SLIPPAGE_PERCENT,
  calculatePriceShiftPercent,
  isPriceShiftOutsideSlippage,
  validateSlippagePercent,
  calculateMinAmountOut,
  loadStoredSlippage,
  saveStoredSlippage,
} from "../slippage";

describe("slippage constants", () => {
  it("exposes the documented preset options", () => {
    expect(PRESET_SLIPPAGE_OPTIONS).toEqual([0.1, 0.5, 1.0]);
  });

  it("flags high risk above the warning threshold", () => {
    expect(HIGH_SLIPPAGE_WARNING_THRESHOLD).toBe(5);
    expect(MAX_SLIPPAGE_PERCENT).toBe(50);
    expect(DEFAULT_SLIPPAGE_PERCENT).toBe(0.5);
  });
});

describe("calculatePriceShiftPercent", () => {
  it("computes the signed percentage movement between rates", () => {
    expect(calculatePriceShiftPercent(100, 97.5)).toBeCloseTo(-2.5);
    expect(calculatePriceShiftPercent(100, 105)).toBeCloseTo(5);
    expect(calculatePriceShiftPercent(100, 100)).toBe(0);
  });

  it("throws for invalid initial rates", () => {
    expect(() => calculatePriceShiftPercent(0, 100)).toThrow(RangeError);
    expect(() => calculatePriceShiftPercent(-1, 100)).toThrow(RangeError);
    expect(() => calculatePriceShiftPercent(Number.NaN, 100)).toThrow(RangeError);
  });

  it("throws for invalid current rates", () => {
    expect(() => calculatePriceShiftPercent(100, 0)).toThrow(RangeError);
    expect(() => calculatePriceShiftPercent(100, Number.NaN)).toThrow(RangeError);
  });
});

describe("isPriceShiftOutsideSlippage", () => {
  it("returns true when the shift exceeds the tolerance", () => {
    expect(isPriceShiftOutsideSlippage(-3, 0.5)).toBe(true);
  });

  it("returns false when within the tolerance (including equal)", () => {
    expect(isPriceShiftOutsideSlippage(-0.5, 0.5)).toBe(false);
    expect(isPriceShiftOutsideSlippage(0, 0.5)).toBe(false);
    expect(isPriceShiftOutsideSlippage(100, 50)).toBe(false);
  });

  it("throws on invalid inputs", () => {
    expect(() => isPriceShiftOutsideSlippage(Number.NaN, 0.5)).toThrow(RangeError);
    expect(() => isPriceShiftOutsideSlippage(-1, 0)).toThrow(RangeError);
  });
});

describe("validateSlippagePercent", () => {
  it("accepts positive values within the ceiling", () => {
    expect(validateSlippagePercent(0.5)).toEqual({
      valid: true,
      isHighRisk: false,
      error: null,
    });
  });

  it("flags high-risk tolerance above the warning threshold", () => {
    expect(validateSlippagePercent(6).isHighRisk).toBe(true);
    expect(validateSlippagePercent(MAX_SLIPPAGE_PERCENT).isHighRisk).toBe(true);
  });

  it("rejects zero, negative, NaN, and over-limit values", () => {
    expect(validateSlippagePercent(0).valid).toBe(false);
    expect(validateSlippagePercent(-1).valid).toBe(false);
    expect(validateSlippagePercent(Number.NaN).valid).toBe(false);
    expect(validateSlippagePercent(51).valid).toBe(false);
    expect(validateSlippagePercent(51).error).toContain("50%");
  });
});

describe("calculateMinAmountOut", () => {
  it("applies the slippage discount to the quoted output", () => {
    expect(calculateMinAmountOut(1000, 0.5)).toBe(995);
    expect(calculateMinAmountOut(1000, 10)).toBe(900);
  });

  it("floors rather than rounds so the guard never exceeds intent", () => {
    const floored = calculateMinAmountOut(0.031337, 0.5);
    const expected = Math.floor((0.031337 * 0.995) * 10 ** 7) / 10 ** 7;
    expect(floored).toBe(expected);
  });

  it("respects the requested decimal precision", () => {
    expect(calculateMinAmountOut(1.5, 50, 0)).toBe(0);
    expect(calculateMinAmountOut(10, 1, 2)).toBe(9.9);
  });

  it("throws for negative quoted output", () => {
    expect(() => calculateMinAmountOut(-5, 0.5)).toThrow(RangeError);
  });

  it("throws for invalid slippage", () => {
    expect(() => calculateMinAmountOut(100, 0)).toThrow(RangeError);
    expect(() => calculateMinAmountOut(100, 51)).toThrow(RangeError);
  });
});

describe("loadStoredSlippage / saveStoredSlippage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns the default when nothing is stored", () => {
    expect(loadStoredSlippage()).toBe(DEFAULT_SLIPPAGE_PERCENT);
  });

  it("round-trips a stored value", () => {
    saveStoredSlippage(1);
    expect(loadStoredSlippage()).toBe(1);
  });

  it("falls back to the default for invalid persisted values", () => {
    vi.spyOn(window.localStorage, "getItem").mockReturnValue("999");
    expect(loadStoredSlippage()).toBe(DEFAULT_SLIPPAGE_PERCENT);
  });
});