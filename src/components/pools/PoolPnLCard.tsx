"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolPnLPosition {
  id: string;
  pair: string;
  /** ISO timestamp of the initial deposit */
  depositedAt: string;
  /** USD value of the assets contributed at deposit time */
  initialDepositValue: number;
  /** USD value redeemable right now if the position were withdrawn */
  currentRedeemableValue: number;
  /** USD value of trading fees accrued to this position since deposit */
  feesEarnedValue: number;
}

export interface PoolPnLCardProps {
  /** Active LP positions to summarize. Falls back to demo data when omitted. */
  positions?: PoolPnLPosition[];
}

interface PositionBreakdown extends PoolPnLPosition {
  /** currentRedeemableValue - initialDepositValue */
  totalPnLValue: number;
  totalPnLPercent: number;
  /** yield attributable to collected trading fees */
  feeYieldValue: number;
  feeYieldPercent: number;
  /** remaining PnL attributable to pool share / asset price shifts (e.g. impermanent loss) */
  assetShiftValue: number;
  assetShiftPercent: number;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const MOCK_POSITIONS: PoolPnLPosition[] = [
  {
    id: "pos-1",
    pair: "XLM / USDC",
    depositedAt: "2026-05-12T00:00:00Z",
    initialDepositValue: 5000,
    currentRedeemableValue: 5420,
    feesEarnedValue: 610,
  },
  {
    id: "pos-2",
    pair: "NGN / XLM",
    depositedAt: "2026-06-01T00:00:00Z",
    initialDepositValue: 2200,
    currentRedeemableValue: 2065,
    feesEarnedValue: 95,
  },
  {
    id: "pos-3",
    pair: "USD / GHS",
    depositedAt: "2026-04-20T00:00:00Z",
    initialDepositValue: 8000,
    currentRedeemableValue: 8340,
    feesEarnedValue: 340,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeBreakdown(position: PoolPnLPosition): PositionBreakdown {
  const { initialDepositValue, currentRedeemableValue, feesEarnedValue } = position;
  const totalPnLValue = currentRedeemableValue - initialDepositValue;
  const assetShiftValue = totalPnLValue - feesEarnedValue;
  const base = initialDepositValue || 1;

  return {
    ...position,
    totalPnLValue,
    totalPnLPercent: (totalPnLValue / base) * 100,
    feeYieldValue: feesEarnedValue,
    feeYieldPercent: (feesEarnedValue / base) * 100,
    assetShiftValue,
    assetShiftPercent: (assetShiftValue / base) * 100,
  };
}

function formatUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pnlColorClasses(value: number): { text: string; bg: string; border: string } {
  if (value > 0) {
    return { text: "text-lime-400", bg: "bg-lime-500/10", border: "border-lime-500/30" };
  }
  if (value < 0) {
    return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  }
  return { text: "text-neutral-400", bg: "bg-neutral-500/10", border: "border-neutral-500/30" };
}

function PnLBadge({ value, percent }: { value: number; percent: number }) {
  const colors = pnlColorClasses(value);
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${colors.bg} ${colors.border} ${colors.text}`}
    >
      <Icon size={12} />
      <span>{formatPercent(percent)}</span>
      <span className="text-neutral-500 font-normal">|</span>
      <span>{formatUsd(value)}</span>
    </div>
  );
}

function PositionRow({ position }: { position: PositionBreakdown }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono font-bold text-neutral-200 text-sm">{position.pair}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Deposited {new Date(position.depositedAt).toLocaleDateString()}
          </p>
        </div>
        <PnLBadge value={position.totalPnLValue} percent={position.totalPnLPercent} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Initial Value</p>
          <p className="text-sm font-mono text-neutral-300 mt-1">
            ${position.initialDepositValue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Redeemable Now</p>
          <p className="text-sm font-mono text-neutral-300 mt-1">
            ${position.currentRedeemableValue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Fee Yield</p>
          <p className="text-sm font-mono text-lime-400 mt-1">
            {formatUsd(position.feeYieldValue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Asset Value Shift</p>
          <p
            className={`text-sm font-mono mt-1 ${
              position.assetShiftValue >= 0 ? "text-lime-400" : "text-red-400"
            }`}
          >
            {formatUsd(position.assetShiftValue)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PoolPnLCard
// ---------------------------------------------------------------------------

/**
 * PoolPnLCard
 *
 * Realized/unrealized PnL summary for a liquidity provider's active pool
 * positions. Decomposes each position's total PnL into yield earned from
 * collected trading fees versus raw pool-share asset valuation shifts
 * (e.g. impermanent loss), and surfaces color-coded PnL badges per position.
 */
export function PoolPnLCard({ positions = MOCK_POSITIONS }: PoolPnLCardProps) {
  const breakdowns = useMemo(() => positions.map(computeBreakdown), [positions]);

  const totals = useMemo(() => {
    const initial = breakdowns.reduce((sum, p) => sum + p.initialDepositValue, 0);
    const redeemable = breakdowns.reduce((sum, p) => sum + p.currentRedeemableValue, 0);
    const fees = breakdowns.reduce((sum, p) => sum + p.feeYieldValue, 0);
    const totalPnLValue = redeemable - initial;
    const base = initial || 1;

    return {
      totalPnLValue,
      totalPnLPercent: (totalPnLValue / base) * 100,
      feeYieldValue: fees,
      assetShiftValue: totalPnLValue - fees,
    };
  }, [breakdowns]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-neutral-200">Liquidity Position PnL</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Realized &amp; unrealized profit/loss across your active pool positions.
          </p>
        </div>
        <PnLBadge value={totals.totalPnLValue} percent={totals.totalPnLPercent} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Total Fee Yield
          </p>
          <p className="text-base font-mono font-bold text-lime-400 mt-1">
            {formatUsd(totals.feeYieldValue)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Asset Valuation Shift
          </p>
          <p
            className={`text-base font-mono font-bold mt-1 ${
              totals.assetShiftValue >= 0 ? "text-lime-400" : "text-red-400"
            }`}
          >
            {formatUsd(totals.assetShiftValue)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {breakdowns.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-6">
            No active liquidity positions.
          </p>
        ) : (
          breakdowns.map((position) => <PositionRow key={position.id} position={position} />)
        )}
      </div>
    </div>
  );
}

export default PoolPnLCard;
