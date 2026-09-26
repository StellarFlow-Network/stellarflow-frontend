"use client";

import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react";
import { DeFiTooltip } from "@/components/ui/DeFiTooltip";
import type { PoolPnLPosition } from "@/components/pools/PoolPnLCard";
import {
  computeIlMitigationForPosition,
  type IlMitigationScore,
  type IlMitigationStatus,
} from "./ilMitigationScore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ILMitigationScoreWidgetProps {
  /** Active LP positions to score. Falls back to demo data when omitted. */
  positions?: PoolPnLPosition[];
}

interface StatusStyle {
  label: string;
  badge: string;
  meter: string;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

/**
 * Covers the five states the widget can render: a net-profitable position
 * (fees exceed IL), an exactly break-even position (fees equal IL), a
 * partially offset position, a position whose fees have not covered the IL
 * yet, and a pool that diverged in the LP's favour (no IL at all).
 */
const MOCK_POSITIONS: PoolPnLPosition[] = [
  {
    // totalPnL +495, asset shift -115 => M_offset = 610 / 115 = 530.43%
    id: "il-pos-1",
    pair: "XLM / USDC",
    depositedAt: "2026-05-12T00:00:00Z",
    initialDepositValue: 5000,
    currentRedeemableValue: 5495,
    feesEarnedValue: 610,
  },
  {
    // totalPnL 0, asset shift -500 => M_offset = 500 / 500 = 100%
    id: "il-pos-2",
    pair: "USD / GHS",
    depositedAt: "2026-04-20T00:00:00Z",
    initialDepositValue: 8000,
    currentRedeemableValue: 8000,
    feesEarnedValue: 500,
  },
  {
    // totalPnL -110, asset shift -205 => M_offset = 95 / 205 = 46.34%
    id: "il-pos-3",
    pair: "NGN / XLM",
    depositedAt: "2026-06-01T00:00:00Z",
    initialDepositValue: 2200,
    currentRedeemableValue: 2090,
    feesEarnedValue: 95,
  },
  {
    // totalPnL -200, asset shift -200, no fees => M_offset = 0%
    id: "il-pos-4",
    pair: "EUR / USDC",
    depositedAt: "2026-03-18T00:00:00Z",
    initialDepositValue: 8000,
    currentRedeemableValue: 7800,
    feesEarnedValue: 0,
  },
  {
    // totalPnL +440, asset shift +320 => favourable divergence, no IL
    id: "il-pos-5",
    pair: "BTC / USDC",
    depositedAt: "2026-04-02T00:00:00Z",
    initialDepositValue: 12500,
    currentRedeemableValue: 12940,
    feesEarnedValue: 120,
  },
];

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<IlMitigationStatus, StatusStyle> = {
  "net-profitable": {
    label: "Net Profitable",
    badge: "bg-lime-500/10 border-lime-500/30 text-lime-400",
    meter: "bg-lime-400",
  },
  partial: {
    label: "Partial Offset",
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    meter: "bg-amber-400",
  },
  unmitigated: {
    label: "Unmitigated",
    badge: "bg-red-500/10 border-red-500/30 text-red-400",
    meter: "bg-red-400",
  },
  "no-divergence": {
    label: "No IL",
    badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",
    meter: "bg-sky-400",
  },
};

function StatusIcon({ status }: { status: IlMitigationStatus }) {
  if (status === "net-profitable") return <CheckCircle2 size={12} aria-hidden="true" />;
  if (status === "no-divergence") return <ShieldCheck size={12} aria-hidden="true" />;
  if (status === "partial") return <TrendingUp size={12} aria-hidden="true" />;
  return <AlertTriangle size={12} aria-hidden="true" />;
}

function formatUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** `125` -> "125%", `33.33` -> "33.33%"; never prints NaN/Infinity. */
function formatPercent(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(2)}%`;
}

function offsetLabel(score: IlMitigationScore): string {
  if (score.mitigationPercent === null) return "No divergence";
  if (score.mitigationPercent >= 100) return "Fees exceed IL";
  if (score.mitigationPercent <= 0) return "No fees accrued";
  return "Fees partially offset IL";
}

function offsetText(score: IlMitigationScore): string {
  if (score.mitigationPercent === null) return "No IL";
  return `${formatPercent(score.mitigationPercent)} Offset`;
}

function PositionMeter({ score, label }: { score: IlMitigationScore; label: string }) {
  const styles = STATUS_STYLES[score.status];

  return (
    <div
      role="meter"
      aria-label={`Fee offset for ${label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score.meterPercent}
      aria-valuetext={offsetText(score)}
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-800"
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${styles.meter}`}
        style={{ width: `${score.meterPercent}%` }}
        data-testid="il-mitigation-meter-fill"
      />
    </div>
  );
}

function PositionRow({ position }: { position: PoolPnLPosition }) {
  const score = useMemo(() => computeIlMitigationForPosition(position), [position]);
  const styles = STATUS_STYLES[score.status];
  const netOffset = score.feesCollected - score.ilMagnitude;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono font-bold text-neutral-200 text-sm">{position.pair}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Deposited {new Date(position.depositedAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${styles.badge}`}
            data-status={score.status}
            data-testid="il-mitigation-status-badge"
          >
            <StatusIcon status={score.status} />
            {styles.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              score.isNetProfitable
                ? "bg-lime-500/10 border-lime-500/30 text-lime-300"
                : "bg-neutral-500/10 border-neutral-700 text-neutral-300"
            }`}
            data-testid="il-mitigation-offset-badge"
          >
            {offsetText(score)}
            <span className="font-normal text-neutral-500">|</span>
            <span className="font-normal">{offsetLabel(score)}</span>
          </span>
        </div>
      </div>

      <div className="mt-4">
        <PositionMeter score={score} label={position.pair} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Fees Collected</p>
          <p className="text-sm font-mono text-lime-400 mt-1">{formatUsd(score.feesCollected)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Impermanent Loss</p>
          <p className="text-sm font-mono text-red-400 mt-1">
            {score.ilMagnitude > 0 ? `-$${score.ilMagnitude.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}` : "$0.00"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Net Fee Offset</p>
          <p
            className={`text-sm font-mono mt-1 ${netOffset >= 0 ? "text-lime-400" : "text-red-400"}`}
          >
            {formatUsd(netOffset)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ILMitigationScoreWidget
// ---------------------------------------------------------------------------

/**
 * ILMitigationScoreWidget
 *
 * Real-time impermanent loss mitigation score for a liquidity provider's
 * active AMM positions. For every position it compares accumulated trading
 * fee earnings against the impermanent loss leg of PnL:
 *
 *   M_offset = (Fees_collected / |IL|) * 100
 *
 * A value of 100% or more means the collected fees have fully paid back the
 * divergence loss (a net-profitable position, marked with a green checkmark).
 * Positions where the pool diverged in the LP's favour carry no IL at all and
 * render a distinct "no divergence" state instead of an undefined percentage.
 */
export function ILMitigationScoreWidget({
  positions = MOCK_POSITIONS,
}: ILMitigationScoreWidgetProps) {
  const scores = useMemo(
    () => positions.map((position) => computeIlMitigationForPosition(position)),
    [positions],
  );

  const totals = useMemo(() => {
    const feesCollected = scores.reduce((sum, score) => sum + score.feesCollected, 0);
    const ilMagnitude = scores.reduce((sum, score) => sum + score.ilMagnitude, 0);
    const netOffset = feesCollected - ilMagnitude;

    return { feesCollected, ilMagnitude, netOffset };
  }, [scores]);

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-lg font-semibold text-neutral-200 flex items-center gap-1.5">
            <DeFiTooltip termKey="il-mitigation-score" position="bottom" showIcon>
              IL Mitigation Score
            </DeFiTooltip>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            How much of each position&apos;s impermanent loss has been paid back by trading fees.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
            totals.netOffset >= 0
              ? "bg-lime-500/10 border-lime-500/30 text-lime-400"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          }`}
          data-testid="il-mitigation-total-badge"
        >
          Portfolio fee offset {totals.netOffset >= 0 ? "covered" : "short"}
        </span>
      </header>

      <p className="mb-5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[11px] text-sky-300">
        M_offset = (Fees_collected / |IL|) × 100
      </p>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Total Fees</p>
          <p className="text-base font-mono font-bold text-lime-400 mt-1">
            {formatUsd(totals.feesCollected)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Total IL</p>
          <p className="text-base font-mono font-bold text-red-400 mt-1">
            {totals.ilMagnitude > 0
              ? `-$${totals.ilMagnitude.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "$0.00"}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Net Offset</p>
          <p
            className={`text-base font-mono font-bold mt-1 ${
              totals.netOffset >= 0 ? "text-lime-400" : "text-red-400"
            }`}
          >
            {formatUsd(totals.netOffset)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {positions.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-6">
            No active liquidity positions.
          </p>
        ) : (
          positions.map((position) => <PositionRow key={position.id} position={position} />)
        )}
      </div>
    </section>
  );
}

export default ILMitigationScoreWidget;
