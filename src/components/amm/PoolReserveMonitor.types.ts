/**
 * Shared types for the AMM pool reserve monitor.
 *
 * The monitor is intentionally presentational: it receives the reserve
 * balances (and, when available, the market spot price) as props and derives
 * every displayed value from them. That keeps it trivially wireable into the
 * pool detail view and testable without a DOM.
 */

export interface PoolReserveMonitorProps {
  /** Ticker/symbol of the first reserve asset, e.g. `"XLM"`. */
  assetA: string;
  /** Ticker/symbol of the second reserve asset, e.g. `"USDC"`. */
  assetB: string;
  /** Current reserve balance of `assetA` (whole units). */
  reserveA: number | string;
  /** Current reserve balance of `assetB` (whole units). */
  reserveB: number | string;
  /**
   * Market spot price of 1 unit of `assetA` quoted in `assetB`.
   *
   * When supplied the ratio bar is weighted by value and the arbitrage CTA is
   * gated on the deviation between this price and the pool-implied price.
   * When omitted the bar falls back to a raw unit split.
   */
  spotPrice?: number;
  /** Target share for `assetA` as a fraction (default `0.5` → ideal 50/50). */
  idealShare?: number;
  /**
   * Absolute market deviation (as a fraction, e.g. `0.01` = 1%) that unlocks
   * the `Arbitrage Swap` CTA. Defaults to `DEFAULT_ARBITRAGE_THRESHOLD`.
   */
  arbitrageThreshold?: number;
  /** Optional CTA handler. When omitted the button renders disabled. */
  onArbitrageSwap?: () => void;
  /** Extra class names for the outer wrapper. */
  className?: string;
  /** Accessible name for the widget. */
  ariaLabel?: string;
}

/** Input accepted by {@link computeReserveRatioProjection}. */
export interface ReserveRatioProjectionInput {
  reserveA: number | string;
  reserveB: number | string;
  spotPrice?: number;
  idealShare?: number;
  arbitrageThreshold?: number;
}

/** How far the value split has drifted from the ideal target. */
export type DriftSeverity = "balanced" | "moderate" | "severe";

/** Fully-derived view model rendered by the monitor. */
export interface ReserveRatioProjection {
  /** Reserve balances coerced to finite, non-negative numbers. */
  reserveA: number;
  reserveB: number;
  /** Total reserves in raw units. */
  totalReserve: number;
  /** Pool-implied price of 1 `assetA` in `assetB`; `0` when unknown. */
  poolPrice: number;
  /** Value of reserve A expressed in `assetB` (raw units when no spot price). */
  valueA: number;
  /** Value of reserve B expressed in `assetB`. */
  valueB: number;
  /** Share of the pool value held in `assetA` (0–1). */
  shareA: number;
  /** Share of the pool value held in `assetB` (0–1). */
  shareB: number;
  /** Signed drift of `shareA` from the ideal target, in percent. */
  driftPercent: number;
  /** Signed deviation of the pool price from the market price, in percent. */
  priceDeviationPercent: number | null;
  /** True when the market deviation meets/exceeds the arbitrage threshold. */
  arbitrageAvailable: boolean;
  /** Whether the projection weighted the split by a market spot price. */
  valueWeighted: boolean;
}
