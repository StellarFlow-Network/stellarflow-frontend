import { describe, it, expect } from "vitest";
import {
  formatTokenAmount,
  formatXLM,
  formatUSD,
  formatCountdown,
  formatStroops,
} from "../formatters";

describe("formatTokenAmount", () => {
  it("treats zero and non-numeric input as zero", () => {
    expect(formatTokenAmount("0")).toBe("0");
    expect(formatTokenAmount("0.0000000")).toBe("0");
    expect(formatTokenAmount("")).toBe("0");
    expect(formatTokenAmount("abc")).toBe("0");
  });

  it("formats positive amounts with grouped thousands", () => {
    expect(formatTokenAmount("1234567.89")).toBe("1,234,567.89");
  });

  it("strips trailing fractional digits beyond the configured maximum", () => {
    expect(formatTokenAmount("1.23456789", 7, 4)).toBe("1.2346");
  });

  it("removes trailing zeros without forcing decimals", () => {
    expect(formatTokenAmount("100.50")).toBe("100.5");
    expect(formatTokenAmount("100.00")).toBe("100");
  });
});

describe("formatXLM", () => {
  it("formats stroop-based XLM balances at 7 decimals", () => {
    expect(formatXLM("0")).toBe("0");
    expect(formatXLM("1234.5678901")).toBe("1,234.5678901");
  });
});

describe("formatUSD", () => {
  it("formats US dollar amounts with two decimals", () => {
    expect(formatUSD(19.99)).toBe("$19.99");
    expect(formatUSD(1000)).toBe("$1,000.00");
  });
});

describe("formatCountdown", () => {
  it("formats seconds into HH:MM:SS", () => {
    expect(formatCountdown(3600)).toBe("01:00:00");
    expect(formatCountdown(3725)).toBe("01:02:05");
    expect(formatCountdown(59)).toBe("00:00:59");
  });

  it("never returns a negative countdown", () => {
    expect(formatCountdown(-5)).toBe("00:00:00");
  });
});

describe("formatStroops", () => {
  it("converts stroops to XLM", () => {
    expect(formatStroops("10000000")).toBe("1");
    expect(formatStroops("15000000")).toBe("1.5");
  });

  it("keeps sub-stroop precision at the XLM bound", () => {
    expect(formatStroops("1")).toBe("0.0000001");
  });
});