/**
 * Aggregate portfolio types backing the portfolio tracker dashboard —
 * net worth, allocation across wallet/LP/vault positions, and historical
 * balance growth.
 */

export type PortfolioAssetClass = "native" | "lp" | "vault";

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
}
