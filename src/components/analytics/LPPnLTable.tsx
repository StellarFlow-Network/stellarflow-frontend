"use client";

/**
 * LPPnLTable — #954
 *
 * Historical LP yield & impermanent-loss PnL tracker. Itemises every open and
 * closed liquidity position — deposit value, current value, claimed fees and
 * the net impermanent-loss component — and rolls them up into a portfolio
 * summary. Rows are sortable by ROI %, pool TVL and date opened, and the whole
 * (filtered) breakdown can be exported to a CSV spreadsheet.
 *
 * All PnL/ROI math lives in `./lpPnl` so it stays unit-testable without a DOM.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Droplets,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  buildLPPnLCsv,
  computeLPPnLRows,
  filterLPPnLRows,
  formatPercent,
  formatSignedUsd,
  formatUsd,
  roiTone,
  sortLPPnLRows,
  summarizeLPPnL,
  type LPPnLRow,
  type LPPnLSortKey,
  type LPPnLStatusFilter,
  type LPPosition,
  type SortDirection,
} from "./lpPnl";

// ---------------------------------------------------------------------------
// Demo data — falls back to this when no positions are supplied.
// ---------------------------------------------------------------------------

const MOCK_POSITIONS: LPPosition[] = [
  {
    id: "pos-1",
    pair: "XLM / USDC",
    status: "active",
    openedAt: "2026-05-12T00:00:00Z",
    depositedUsd: 5_000,
    currentValueUsd: 5_420,
    feesClaimedUsd: 610,
    poolTvlUsd: 10_200_000,
  },
  {
    id: "pos-2",
    pair: "NGN / XLM",
    status: "closed",
    openedAt: "2026-06-01T00:00:00Z",
    closedAt: "2026-07-15T00:00:00Z",
    depositedUsd: 2_200,
    currentValueUsd: 2_065,
    feesClaimedUsd: 95,
    poolTvlUsd: 1_850_000,
  },
  {
    id: "pos-3",
    pair: "USD / GHS",
    status: "active",
    openedAt: "2026-04-20T00:00:00Z",
    depositedUsd: 8_000,
    currentValueUsd: 8_340,
    feesClaimedUsd: 340,
    poolTvlUsd: 890_000,
  },
  {
    id: "pos-4",
    pair: "EUR / XLM",
    status: "closed",
    openedAt: "2026-03-02T00:00:00Z",
    closedAt: "2026-05-30T00:00:00Z",
    depositedUsd: 3_500,
    currentValueUsd: 3_150,
    feesClaimedUsd: 180,
    poolTvlUsd: 2_750_000,
  },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function PnlText({ value, signed = false }: { value: number; signed?: boolean }) {
  const positive = value >= 0;
  return (
    <span className={`font-mono ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {signed ? formatSignedUsd(value) : formatUsd(value)}
    </span>
  );
}

/** Green = profit, red = loss, neutral = break-even. */
export function RoiBadge({ row }: { row: LPPnLRow }) {
  const tone = roiTone(row.netPnlUsd);
  const Icon = tone === "profit" ? TrendingUp : tone === "loss" ? TrendingDown : Minus;
  const toneClasses =
    tone === "profit"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : tone === "loss"
        ? "bg-red-500/10 border-red-500/30 text-red-400"
        : "bg-neutral-500/10 border-neutral-500/30 text-neutral-400";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${toneClasses}`}
      aria-label={`ROI ${formatPercent(row.roiPercent)}`}
    >
      <Icon size={12} aria-hidden="true" />
      {formatPercent(row.roiPercent)}
    </span>
  );
}

const SORT_LABELS: Record<LPPnLSortKey, string> = {
  roi: "ROI %",
  tvl: "TVL",
  openedAt: "Date opened",
};

interface SortableHeaderProps {
  label: string;
  sortKey: LPPnLSortKey;
  activeKey: LPPnLSortKey;
  direction: SortDirection;
  onSort: (key: LPPnLSortKey) => void;
  align?: "left" | "right";
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "right",
}: SortableHeaderProps) {
  const isActive = activeKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`py-3 px-4 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${SORT_LABELS[sortKey]}`}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-wider transition-colors hover:text-neutral-200 ${
          isActive ? "text-emerald-400" : "text-neutral-400"
        }`}
      >
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-base font-bold text-neutral-100">{value}</p>
    </div>
  );
}

function downloadCsv(csv: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface LPPnLTableProps {
  /** Positions to render. Falls back to demo data when omitted. */
  positions?: LPPosition[];
  /** Overrides the exported CSV filename. */
  exportFilename?: string;
}

export default function LPPnLTable({
  positions = MOCK_POSITIONS,
  exportFilename,
}: LPPnLTableProps) {
  const [sortKey, setSortKey] = useState<LPPnLSortKey>("roi");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<LPPnLStatusFilter>("all");
  const [exportError, setExportError] = useState<string | null>(null);

  const rows = useMemo(() => computeLPPnLRows(positions), [positions]);

  const visibleRows = useMemo(
    () => sortLPPnLRows(filterLPPnLRows(rows, statusFilter), sortKey, sortDirection),
    [rows, statusFilter, sortKey, sortDirection],
  );

  const summary = useMemo(() => summarizeLPPnL(visibleRows), [visibleRows]);

  const handleSort = useCallback((key: LPPnLSortKey) => {
    setSortKey((previousKey) => {
      setSortDirection((previousDirection) =>
        previousKey === key && previousDirection === "desc" ? "asc" : "desc",
      );
      return key;
    });
  }, []);

  const handleExport = useCallback(() => {
    try {
      const csv = buildLPPnLCsv(visibleRows);
      const filename =
        exportFilename ?? `lp-pnl-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(csv, filename);
      setExportError(null);
    } catch {
      setExportError("Could not generate the CSV export. Please try again.");
    }
  }, [visibleRows, exportFilename]);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-200">
            <Droplets size={18} className="text-cyan-400" aria-hidden="true" />
            LP Yield &amp; Impermanent Loss PnL
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Historical net PnL for every active and closed liquidity position
            (deposits + claimed fees − impermanent loss).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="uppercase tracking-wider">Positions</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as LPPnLStatusFilter)
              }
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-300 focus:border-cyan-500 focus:outline-none"
              aria-label="Filter positions by status"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleExport}
            disabled={visibleRows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:border-cyan-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Roll-up summary ────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Net PnL" value={<PnlText value={summary.totalNetPnlUsd} signed />} />
        <SummaryCard
          label="Aggregate ROI"
          value={
            <span
              className={
                summary.totalNetPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {formatPercent(summary.totalRoiPercent)}
            </span>
          }
        />
        <SummaryCard label="Fees claimed" value={formatUsd(summary.totalFeesClaimedUsd)} />
        <SummaryCard
          label="Positions"
          value={
            <span className="text-sm">
              {summary.activeCount} active · {summary.closedCount} closed
            </span>
          }
        />
      </div>

      {exportError && (
        <p role="alert" className="mb-3 text-xs text-red-400">
          {exportError}
        </p>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <caption className="sr-only">
            Historical LP yield and impermanent-loss profit and loss by position
          </caption>
          <thead>
            <tr className="border-b border-neutral-800 font-mono text-xs uppercase tracking-wider text-neutral-400">
              <th scope="col" className="py-3 px-4 font-medium">
                Position
              </th>
              <th scope="col" className="py-3 px-4 font-medium">
                Status
              </th>
              <SortableHeader
                label="Opened"
                sortKey="openedAt"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
                align="left"
              />
              <th scope="col" className="py-3 px-4 text-right font-medium">
                Deposited
              </th>
              <th scope="col" className="py-3 px-4 text-right font-medium">
                Current Value
              </th>
              <th scope="col" className="py-3 px-4 text-right font-medium">
                Fees Claimed
              </th>
              <th scope="col" className="py-3 px-4 text-right font-medium">
                Impermanent Loss
              </th>
              <SortableHeader
                label="TVL"
                sortKey="tvl"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <th scope="col" className="py-3 px-4 text-right font-medium">
                Net PnL
              </th>
              <SortableHeader
                label="ROI %"
                sortKey="roi"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50 text-sm">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-neutral-500">
                  No liquidity positions match this filter.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-neutral-800/30">
                  <td className="px-4 py-3">
                    <span className="block font-mono font-bold text-neutral-200">
                      {row.pair}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        row.status === "active"
                          ? "bg-cyan-500/10 text-cyan-400"
                          : "bg-neutral-700/40 text-neutral-400"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                    {new Date(row.openedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-neutral-300">
                    {formatUsd(row.depositedUsd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-neutral-300">
                    {formatUsd(row.currentValueUsd)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlText value={row.feeYieldUsd} signed />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlText value={row.impermanentLossUsd} signed />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-neutral-400">
                    {formatUsd(row.poolTvlUsd)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlText value={row.netPnlUsd} signed />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RoiBadge row={row} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-mono text-xs text-neutral-500">
        {visibleRows.length} position{visibleRows.length !== 1 ? "s" : ""} · net PnL
        = current value + claimed fees − initial deposit
      </p>
    </section>
  );
}
