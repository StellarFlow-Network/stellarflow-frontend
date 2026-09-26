"use client";

/**
 * useYieldBenchmarks — #990
 *
 * Fetches benchmark yield data for the core StellarFlow assets (USDC, XLM,
 * BTC) so the YieldBenchmarkWidget can compare StellarFlow Vault APY against
 * the industry-average lending rate for each asset.
 *
 * The hook mirrors the conventions used by `useVaultYieldHarvest`: a
 * react-query wrapper around a mock generator that will be swapped for a real
 * `/api/yield/benchmarks` fetch in production.
 */

import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BenchmarkAssetSymbol = "USDC" | "XLM" | "BTC";

export interface YieldBenchmarkAsset {
  /** Ticker symbol, e.g. "USDC" */
  symbol: BenchmarkAssetSymbol;
  /** Human readable asset name, e.g. "USD Coin" */
  name: string;
  /** StellarFlow vault APY for this asset, in percent (e.g. 12.4) */
  vaultApyPercent: number;
  /** Industry-average lending/benchmark APY, in percent (e.g. 9.2) */
  industryApyPercent: number;
  /** Where the industry benchmark is sourced from */
  benchmarkSource: string;
  /** Breakdown of the vault's yield sources, shown in the tooltip */
  yieldSources: { label: string; apyPercent: number }[];
}

export interface YieldBenchmarkData {
  /** ISO-8601 timestamp of the last benchmark refresh */
  updatedAt: string;
  assets: YieldBenchmarkAsset[];
}

// ---------------------------------------------------------------------------
// Pure calculation helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Net APY spread between the StellarFlow vault and the industry benchmark,
 * expressed in percentage points. Positive means the vault out-yields the
 * benchmark.
 */
export function calculateApyAdvantage(
  vaultApyPercent: number,
  industryApyPercent: number
): number {
  return vaultApyPercent - industryApyPercent;
}

/**
 * Relative outperformance of the vault versus the benchmark, in percent.
 * Returns 0 when the benchmark is 0 to avoid a divide-by-zero.
 */
export function calculateRelativeAdvantage(
  vaultApyPercent: number,
  industryApyPercent: number
): number {
  if (industryApyPercent === 0) return 0;
  return ((vaultApyPercent - industryApyPercent) / industryApyPercent) * 100;
}

/**
 * The maximum APY across every asset/benchmark pair. Used to scale the bar
 * chart so the tallest bar fills the available height. Always returns a
 * positive number so callers never divide by zero.
 */
export function calculateChartMax(assets: YieldBenchmarkAsset[]): number {
  const values = assets.flatMap((asset) => [
    asset.vaultApyPercent,
    asset.industryApyPercent,
  ]);
  const max = values.length > 0 ? Math.max(...values) : 0;
  return max > 0 ? max : 1;
}

/**
 * Aggregate net APY advantage across all assets, weighted equally. This is the
 * headline "+3.2% Higher Yield" metric shown in the widget.
 */
export function calculateAggregateAdvantage(
  assets: YieldBenchmarkAsset[]
): number {
  if (assets.length === 0) return 0;
  const total = assets.reduce(
    (sum, asset) =>
      sum + calculateApyAdvantage(asset.vaultApyPercent, asset.industryApyPercent),
    0
  );
  return total / assets.length;
}

// ---------------------------------------------------------------------------
// Mock data generator
// ---------------------------------------------------------------------------

export function getMockYieldBenchmarkData(): YieldBenchmarkData {
  return {
    updatedAt: new Date().toISOString(),
    assets: [
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
    ],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useYieldBenchmarks() {
  return useQuery<YieldBenchmarkData, Error>({
    queryKey: ["yield-benchmarks"],
    queryFn: async () => {
      // In production: fetch("/api/yield/benchmarks")
      await new Promise((resolve) => setTimeout(resolve, 400));
      return getMockYieldBenchmarkData();
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    placeholderData: getMockYieldBenchmarkData,
  });
}
