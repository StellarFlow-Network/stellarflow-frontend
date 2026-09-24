/**
 * Aggregate portfolio types backing the portfolio tracker dashboard —
 * net worth, allocation across wallet/LP/vault positions, and historical
 * balance growth.
 *
 * Extended for #762 — Granular Wallet Balance Breakdown by Asset Protocol Lock.
 * Every on-chain asset amount is itemised across four mutually-exclusive
 * protocol-lock categories:
 *   • available      — freely transferable balance in the wallet
 *   • limitOrders    — amounts locked inside open limit-order contracts
 *   • vaults         — amounts staked / deposited in yield vaults
 *   • liquidityPools — amounts committed to AMM liquidity pools
 */

export type PortfolioAssetClass = "native" | "lp" | "vault";

// ─── Protocol-lock breakdown types ──────────────────────────────────────────

/** The four mutually-exclusive categories that can hold an asset balance. */
export type AssetProtocolCategory =
  | "available"
  | "limitOrders"
  | "vaults"
  | "liquidityPools";

/**
 * Per-category USD breakdown for a single asset.
 * Values are in USD; each field defaults to 0 when the category holds nothing.
 */
export interface ProtocolLockBreakdown {
  availableUsd: number;
  limitOrdersUsd: number;
  vaultsUsd: number;
  liquidityPoolsUsd: number;
}

/**
 * Breakdown record keyed by asset symbol.
 * Used to render the granular wallet-balance table and the stacked bar chart.
 */
export interface PerAssetBreakdown {
  /** Token or position symbol, e.g. "XLM", "USDC", "NGN". */
  symbol: string;
  /** Human-readable display name. */
  name: string;
  /** Total USD value across all categories (sum of ProtocolLockBreakdown fields). */
  totalUsd: number;
  breakdown: ProtocolLockBreakdown;
}

export interface PortfolioAllocationSlice {
  /** Token or position symbol, e.g. "XLM", "XLM-USDC-LP", "Blue Chip Vault". */
  symbol: string;
  assetClass: PortfolioAssetClass;
  valueUsd: number;
}

export type PortfolioTimeframe = "7D" | "30D" | "90D" | "1Y";

export interface PortfolioHistoryPoint {
  /** ISO-8601 date, e.g. "2026-07-15". */
  date: string;
  netWorthUsd: number;
}

export interface PortfolioBalanceBreakdown {
  walletUsd: number;
  liquidityPoolsUsd: number;
  vaultsUsd: number;
}

export interface PortfolioSummaryData {
  totalNetWorthUsd: number;
  /** Change over the last 24h, as a percentage (e.g. 2.4 for +2.4%). */
  changePercent24h: number;
  balances: PortfolioBalanceBreakdown;
  allocation: PortfolioAllocationSlice[];
  history: Record<PortfolioTimeframe, PortfolioHistoryPoint[]>;
  /**
   * Granular per-asset breakdown across protocol-lock categories (#762).
   * Present on all non-loading states; empty array when no assets are held.
   */
  breakdownByAsset: PerAssetBreakdown[];
}
