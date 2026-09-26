/**
 * Unit tests — #990 Yield Farming Performance Benchmark Comparison
 *
 * Coverage:
 *  1. Pure calculation helpers — net APY spread, relative advantage, chart
 *     scaling, and aggregate advantage.
 *  2. YieldBenchmarkWidget rendering — advantage metric, per-asset rows, and
 *     the yield-sources tooltip toggle.
 *
 * Run with:
 *   npx jest src/components/yield/__tests__/YieldBenchmarkWidget.test.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  YieldBenchmarkWidget,
  formatAdvantage,
  formatApy,
} from "../YieldBenchmarkWidget";
import {
  calculateApyAdvantage,
  calculateRelativeAdvantage,
  calculateChartMax,
  calculateAggregateAdvantage,
  type YieldBenchmarkAsset,
} from "@/hooks/useYieldBenchmarks";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const ASSETS: YieldBenchmarkAsset[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    vaultApyPercent: 12.4,
    industryApyPercent: 9.2,
    benchmarkSource: "Money-market lending average",
    yieldSources: [
      { label: "AMM swap fees", apyPercent: 6.1 },
      { label: "Lending interest", apyPercent: 4.0 },
      { label: "Protocol incentives", apyPercent: 2.3 },
    ],
  },
  {
    symbol: "XLM",
    name: "Stellar Lumens",
    vaultApyPercent: 14.7,
    industryApyPercent: 11.5,
    benchmarkSource: "Staking & lending composite",
    yieldSources: [
      { label: "AMM swap fees", apyPercent: 7.4 },
      { label: "Staking rewards", apyPercent: 4.6 },
      { label: "Protocol incentives", apyPercent: 2.7 },
    ],
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    vaultApyPercent: 8.9,
    industryApyPercent: 5.7,
    benchmarkSource: "CeFi lending average",
    yieldSources: [
      { label: "AMM swap fees", apyPercent: 4.2 },
      { label: "Lending interest", apyPercent: 3.1 },
      { label: "Protocol incentives", apyPercent: 1.6 },
    ],
  },
];

// ─── Calculation helpers ────────────────────────────────────────────────────

describe("yield benchmark calculations", () => {
  it("computes the net APY spread in percentage points", () => {
    expect(calculateApyAdvantage(12.4, 9.2)).toBeCloseTo(3.2, 5);
    expect(calculateApyAdvantage(5.0, 7.5)).toBeCloseTo(-2.5, 5);
  });

  it("computes relative advantage and guards against zero benchmarks", () => {
    expect(calculateRelativeAdvantage(12.4, 9.2)).toBeCloseTo(
      ((12.4 - 9.2) / 9.2) * 100,
      5
    );
    expect(calculateRelativeAdvantage(10, 0)).toBe(0);
  });

  it("scales the chart from the tallest active yield metric", () => {
    expect(calculateChartMax(ASSETS)).toBe(14.7);
    expect(calculateChartMax([])).toBe(1);
    expect(
      calculateChartMax([{ ...ASSETS[0], vaultApyPercent: 0, industryApyPercent: 0 }])
    ).toBe(1);
  });

  it("averages per-asset spreads into the aggregate advantage", () => {
    expect(calculateAggregateAdvantage(ASSETS)).toBeCloseTo(3.2, 5);
    expect(calculateAggregateAdvantage([])).toBe(0);
  });

  it("formats APY and signed advantage strings", () => {
    expect(formatApy(12.4)).toBe("12.4%");
    expect(formatAdvantage(3.2)).toBe("+3.2%");
    expect(formatAdvantage(-1.4)).toBe("-1.4%");
  });
});

// ─── Component rendering ────────────────────────────────────────────────────

describe("YieldBenchmarkWidget", () => {
  it("renders the headline advantage metric", () => {
    render(<YieldBenchmarkWidget assets={ASSETS} />);
    expect(screen.getByTestId("yield-advantage-metric")).toHaveTextContent(
      "+3.2% Higher Yield"
    );
  });

  it("renders a comparison row per core asset", () => {
    render(<YieldBenchmarkWidget assets={ASSETS} />);
    expect(screen.getByTestId("yield-benchmark-row-USDC")).toBeInTheDocument();
    expect(screen.getByTestId("yield-benchmark-row-XLM")).toBeInTheDocument();
    expect(screen.getByTestId("yield-benchmark-row-BTC")).toBeInTheDocument();
  });

  it("toggles the yield-sources tooltip", () => {
    render(<YieldBenchmarkWidget assets={ASSETS} />);
    expect(screen.queryByTestId("yield-sources-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("yield-sources-toggle"));
    const panel = screen.getByTestId("yield-sources-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("AMM swap fees");
    expect(panel).toHaveTextContent("Money-market lending average");
  });
});
