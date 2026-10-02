/**
 * lpPnl.ts — pure PnL / ROI math for the historical LP yield &
 * impermanent-loss tracker table (#954).
 *
 * Deliberately free of React / DOM / `@/` imports so the math can be unit
 * tested with Node's built-in `node:test` runner without a bundler:
 *
 *   node --test tests/unit/lpPnl.test.ts
 *
 * The net-PnL identity implemented here is the one named in the issue:
 *
 *   PnL_net = V_current + Fee_claimed - V_initial
 */

export type LPPositionStatus = "active" | "closed";

/**
 * A single liquidity-provider position as reported by the portfolio /
 * pool-positions API. All monetary values are USD.
 */
export interface LPPosition {
  id: string;
  /** Display pair, e.g. `"XLM / USDC"`. */
  pair: string;
  status: LPPositionStatus;
  /** ISO-8601 timestamp of the initial deposit. */
  openedAt: string;
  /** ISO-8601 timestamp the position was withdrawn. Required for `closed`. */
  closedAt?: string;
  /** `V_initial` — USD value of the assets deposited when the position opened. */
  depositedUsd: number;
  /** `V_current` — USD value redeemable now (at withdrawal for closed rows). */
  currentValueUsd: number;
  /** `Fee_claimed` — USD value of trading fees earned/claimed since open. */
  feesClaimedUsd: number;
  /** Current USD TVL of the underlying pool (used by the TVL sort). */
  poolTvlUsd: number;
}

/** A position enriched with the derived PnL metrics rendered by the table. */
export interface LPPnLRow extends LPPosition {
  /** `V_current + Fee_claimed - V_initial`. */
  netPnlUsd: number;
  /** `netPnlUsd / V_initial * 100`. */
  roiPercent: number;
  /** Alias of `feesClaimedUsd`, itemised so the row reads self-documenting. */
  feeYieldUsd: number;
  /** `Fee_claimed / V_initial * 100`. */
  feeYieldPercent: number;
  /**
   * `V_current - V_initial` — the principal value drift. Negative values are
   * the net impermanent-loss / divergence component, positive values are a
   * favourable pool-share price move.
   */
  impermanentLossUsd: number;
  /** `impermanentLossUsd / V_initial * 100`. */
  impermanentLossPercent: number;
  /** Convenience flag used to pick the green/red ROI badge. */
  isProfit: boolean;
}

export interface LPPnLSummary {
  rowCount: number;
  activeCount: number;
  closedCount: number;
  totalDepositedUsd: number;
  totalCurrentValueUsd: number;
  totalFeesClaimedUsd: number;
  totalNetPnlUsd: number;
  /** Aggregate ROI across every row, weighted by each row's initial deposit. */
  totalRoiPercent: number;
}

export type LPPnLSortKey = "roi" | "tvl" | "openedAt";
export type SortDirection = "asc" | "desc";
export type LPPnLStatusFilter = "all" | LPPositionStatus;
export type RoiTone = "profit" | "loss" | "flat";

/** Coerces non-finite inputs (NaN / Infinity / undefined) to 0. */
function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function percentOf(numerator: number, denominator: number): number {
  const base = safeNumber(denominator);
  if (base <= 0) return 0;
  return (safeNumber(numerator) / base) * 100;
}

function toTimestamp(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Derives every PnL / ROI metric for one position. Pure and non-mutating. */
export function computeLPPnL(position: LPPosition): LPPnLRow {
  const depositedUsd = safeNumber(position.depositedUsd);
  const currentValueUsd = safeNumber(position.currentValueUsd);
  const feesClaimedUsd = safeNumber(position.feesClaimedUsd);

  // PnL_net = V_current + Fee_claimed - V_initial
  const netPnlUsd = currentValueUsd + feesClaimedUsd - depositedUsd;
  const impermanentLossUsd = currentValueUsd - depositedUsd;

  return {
    ...position,
    depositedUsd,
    currentValueUsd,
    feesClaimedUsd,
    netPnlUsd,
    roiPercent: percentOf(netPnlUsd, depositedUsd),
    feeYieldUsd: feesClaimedUsd,
    feeYieldPercent: percentOf(feesClaimedUsd, depositedUsd),
    impermanentLossUsd,
    impermanentLossPercent: percentOf(impermanentLossUsd, depositedUsd),
    isProfit: netPnlUsd >= 0,
  };
}

export function computeLPPnLRows(positions: readonly LPPosition[]): LPPnLRow[] {
  return positions.map(computeLPPnL);
}

/** Keeps only the rows matching the requested active/closed filter. */
export function filterLPPnLRows(
  rows: readonly LPPnLRow[],
  filter: LPPnLStatusFilter,
): LPPnLRow[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => row.status === filter);
}

/**
 * Sorts rows by ROI %, pool TVL or date opened, ascending or descending.
 * Never mutates the input; equal keys fall back to an ascending `id`
 * comparison so the rendered order is deterministic across renders.
 */
export function sortLPPnLRows(
  rows: readonly LPPnLRow[],
  key: LPPnLSortKey,
  direction: SortDirection = "desc",
): LPPnLRow[] {
  const factor = direction === "asc" ? 1 : -1;

  const valueOf = (row: LPPnLRow): number => {
    switch (key) {
      case "roi":
        return row.roiPercent;
      case "tvl":
        return safeNumber(row.poolTvlUsd);
      case "openedAt":
        return toTimestamp(row.openedAt);
      default:
        return 0;
    }
  };

  return [...rows].sort((a, b) => {
    const delta = (valueOf(a) - valueOf(b)) * factor;
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function summarizeLPPnL(rows: readonly LPPnLRow[]): LPPnLSummary {
  let totalDepositedUsd = 0;
  let totalCurrentValueUsd = 0;
  let totalFeesClaimedUsd = 0;
  let totalNetPnlUsd = 0;
  let activeCount = 0;
  let closedCount = 0;

  for (const row of rows) {
    totalDepositedUsd += row.depositedUsd;
    totalCurrentValueUsd += row.currentValueUsd;
    totalFeesClaimedUsd += row.feeYieldUsd;
    totalNetPnlUsd += row.netPnlUsd;
    if (row.status === "active") activeCount += 1;
    else closedCount += 1;
  }

  return {
    rowCount: rows.length,
    activeCount,
    closedCount,
    totalDepositedUsd,
    totalCurrentValueUsd,
    totalFeesClaimedUsd,
    totalNetPnlUsd,
    totalRoiPercent: percentOf(totalNetPnlUsd, totalDepositedUsd),
  };
}

/** Maps an ROI / net-PnL value to the badge colour token used by the table. */
export function roiTone(netPnlUsd: number): RoiTone {
  const value = safeNumber(netPnlUsd);
  if (value > 0) return "profit";
  if (value < 0) return "loss";
  return "flat";
}

// ---------------------------------------------------------------------------
// Formatting helpers (kept pure so they can be asserted in tests)
// ---------------------------------------------------------------------------

export function formatUsd(value: number): string {
  const safe = safeNumber(value);
  const sign = safe < 0 ? "-" : "";
  return `${sign}$${Math.abs(safe).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSignedUsd(value: number): string {
  const safe = safeNumber(value);
  return `${safe > 0 ? "+" : ""}${formatUsd(safe)}`;
}

export function formatPercent(value: number): string {
  const safe = safeNumber(value);
  return `${safe > 0 ? "+" : ""}${safe.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// CSV export (spreadsheet download for the table's export button)
// ---------------------------------------------------------------------------

export const LP_PNL_CSV_HEADERS = [
  "Pair",
  "Status",
  "Opened",
  "Closed",
  "Deposited (USD)",
  "Current Value (USD)",
  "Fees Claimed (USD)",
  "Net PnL (USD)",
  "ROI (%)",
  "Pool TVL (USD)",
] as const;

/** RFC-4180 field escaping: quote when the value contains `"`, `,` or a newline. */
export function escapeCsvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function isoDate(iso?: string): string {
  if (!iso) return "";
  const timestamp = toTimestamp(iso);
  if (timestamp === 0) return "";
  return new Date(timestamp).toISOString().slice(0, 10);
}

function csvRow(row: LPPnLRow): string {
  return [
    escapeCsvField(row.pair),
    row.status,
    isoDate(row.openedAt),
    isoDate(row.closedAt),
    row.depositedUsd.toFixed(2),
    row.currentValueUsd.toFixed(2),
    row.feeYieldUsd.toFixed(2),
    row.netPnlUsd.toFixed(2),
    row.roiPercent.toFixed(2),
    safeNumber(row.poolTvlUsd).toFixed(2),
  ].join(",");
}

/** Builds the full CSV document (header + one row per position). */
export function buildLPPnLCsv(rows: readonly LPPnLRow[]): string {
  return [LP_PNL_CSV_HEADERS.join(","), ...rows.map(csvRow)].join("\n");
}
