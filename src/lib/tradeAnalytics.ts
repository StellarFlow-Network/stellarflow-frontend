/**
 * tradeAnalytics.ts
 *
 * Post-trade execution quality, price variance and slippage profiler math.
 */

export type FillQualityRating = "perfect" | "minimal" | "high";

export interface TradeHop {
  fromAsset: string;
  toAsset: string;
  expectedRate: number;
  actualRate: number;
  poolId?: string;
}

export interface TradeExecutionProfile {
  tradeId: string;
  timestamp: string;
  pair: string;
  inputAmount: number;
  inputAsset: string;
  expectedOutputAmount: number;
  actualOutputAmount: number;
  outputAsset: string;
  expectedPrice: number; // expected output / input
  actualPrice: number;   // actual output / input
  priceVariance: number; // P_actual - P_expected
  slippagePercent: number; // ((P_expected - P_actual) / P_expected) * 100
  rating: FillQualityRating;
  gasCostXlm: number;
  gasCostUsd?: number;
  tradeSizeUsd?: number;
  gasToTradeSizePercent: number; // (GasCost / TradeSize) * 100
  hops?: TradeHop[];
  txHash?: string;
}

export const TRADE_ANALYTICS_STORAGE_KEY = "stellarflow:trade-analytics-history";

/**
 * Calculate execution price variance: ΔP = P_actual - P_expected
 */
export function calculatePriceVariance(actualPrice: number, expectedPrice: number): number {
  if (!Number.isFinite(actualPrice) || !Number.isFinite(expectedPrice)) {
    return 0;
  }
  return actualPrice - expectedPrice;
}

/**
 * Calculate realized slippage percentage: ((P_expected - P_actual) / P_expected) * 100
 */
export function calculateRealizedSlippagePercent(
  expectedOutput: number,
  actualOutput: number
): number {
  if (!Number.isFinite(expectedOutput) || expectedOutput <= 0 || !Number.isFinite(actualOutput)) {
    return 0;
  }
  const diff = expectedOutput - actualOutput;
  return (diff / expectedOutput) * 100;
}

/**
 * Categorize fill execution quality rating.
 */
export function deriveFillQualityRating(
  realizedSlippagePercent: number,
  priceVariance: number
): FillQualityRating {
  // Positive price improvement or negligible slippage (< 0.05%)
  if (priceVariance >= 0 || realizedSlippagePercent <= 0.05) {
    return "perfect";
  }
  // Minimal slippage between 0.05% and 1.0%
  if (realizedSlippagePercent <= 1.0) {
    return "minimal";
  }
  // High slippage > 1.0%
  return "high";
}

/**
 * Calculate gas cost ratio against total trade size.
 */
export function calculateGasToTradeSizeRatio(
  gasCostUsdOrXlm: number,
  tradeSizeUsdOrXlm: number
): number {
  if (
    !Number.isFinite(gasCostUsdOrXlm) ||
    !Number.isFinite(tradeSizeUsdOrXlm) ||
    tradeSizeUsdOrXlm <= 0
  ) {
    return 0;
  }
  return (gasCostUsdOrXlm / tradeSizeUsdOrXlm) * 100;
}

/**
 * Calculate cumulative multi-hop slippage across routed paths.
 */
export function calculateMultiHopSlippage(hops: TradeHop[]): {
  cumulativeExpectedRate: number;
  cumulativeActualRate: number;
  totalHopSlippagePercent: number;
} {
  if (!hops || hops.length === 0) {
    return {
      cumulativeExpectedRate: 1,
      cumulativeActualRate: 1,
      totalHopSlippagePercent: 0,
    };
  }

  let cumulativeExpected = 1;
  let cumulativeActual = 1;

  for (const hop of hops) {
    cumulativeExpected *= hop.expectedRate;
    cumulativeActual *= hop.actualRate;
  }

  const totalSlippage =
    cumulativeExpected > 0
      ? ((cumulativeExpected - cumulativeActual) / cumulativeExpected) * 100
      : 0;

  return {
    cumulativeExpectedRate: cumulativeExpected,
    cumulativeActualRate: cumulativeActual,
    totalHopSlippagePercent: totalSlippage,
  };
}

/**
 * Save trade fill profile to persistent local trade analytics history.
 */
export function saveTradeAnalyticsProfile(profile: TradeExecutionProfile): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TRADE_ANALYTICS_STORAGE_KEY);
    const history: TradeExecutionProfile[] = raw ? JSON.parse(raw) : [];
    // Keep latest 100 trades
    const updated = [profile, ...history.filter((t) => t.tradeId !== profile.tradeId)].slice(0, 100);
    window.localStorage.setItem(TRADE_ANALYTICS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Load trade fill analytics from localStorage.
 */
export function loadTradeAnalyticsHistory(): TradeExecutionProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRADE_ANALYTICS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
