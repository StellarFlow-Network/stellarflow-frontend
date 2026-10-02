"use client";

import { useMemo } from "react";
import type {
  DriftSeverity,
  PoolReserveMonitorProps,
} from "./PoolReserveMonitor.types";
import {
  buildReserveRatioBarElement,
  computeReserveRatioProjection,
  describeDrift,
  formatPercent,
  formatReserve,
  formatSignedPercent,
} from "./PoolReserveMonitor.helpers";

const DRIFT_BADGE_CLASS: Record<DriftSeverity, string> = {
  balanced: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  severe: "border-red-500/40 bg-red-500/10 text-red-400",
};

/**
 * `PoolReserveMonitor`
 *
 * Real-time reserve-balance widget for pool detail views. Renders the exact
 * underlying token reserves, a smoothly animated ratio bar, a drift highlight
 * against the ideal 50/50 target, and an `Arbitrage Swap` CTA that only
 * appears when the pool price deviates from the supplied market spot price by
 * more than the configured threshold.
 *
 * The component is presentational: reserve balances and (optionally) the
 * market spot price arrive as props, so it re-renders — with the bar
 * transitioning between widths — whenever a ledger commit changes them.
 *
 * @example
 * ```tsx
 * <PoolReserveMonitor
 *   assetA="XLM"
 *   assetB="USDC"
 *   reserveA={42_500_000}
 *   reserveB={5_100_000}
 *   spotPrice={0.12}
 *   onArbitrageSwap={() => router.push("/swap")}
 * />
 * ```
 */
export function PoolReserveMonitor({
  assetA,
  assetB,
  reserveA,
  reserveB,
  spotPrice,
  idealShare,
  arbitrageThreshold,
  onArbitrageSwap,
  className = "",
  ariaLabel,
}: PoolReserveMonitorProps) {
  const projection = useMemo(
    () =>
      computeReserveRatioProjection({
        reserveA,
        reserveB,
        spotPrice,
        idealShare,
        arbitrageThreshold,
      }),
    [arbitrageThreshold, idealShare, reserveA, reserveB, spotPrice],
  );

  const severity = describeDrift(projection.driftPercent);
  const label = ariaLabel ?? `${assetA} / ${assetB} reserve monitor`;
  const barLabel = `${assetA} / ${assetB} reserve ratio: ${formatPercent(
    projection.shareA * 100,
  )} ${assetA}, ${formatPercent(projection.shareB * 100)} ${assetB}`;

  if (projection.totalReserve <= 0) {
    return (
      <section
        role="status"
        aria-label={label}
        className={`rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 ${className}`}
      >
        <h3 className="text-sm font-semibold text-neutral-200">
          Reserve balance
        </h3>
        <p className="mt-2 text-xs text-neutral-400">
          No reserve balances reported for this pool yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label={label}
      className={`rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 ${className}`}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-200">
          Reserve balance
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${DRIFT_BADGE_CLASS[severity]}`}
        >
          {severity === "balanced"
            ? "50/50 balanced"
            : `${formatSignedPercent(projection.driftPercent)} drift`}
        </span>
      </header>

      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-2 rounded-lg bg-neutral-900/70 px-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wide text-neutral-400">
            {assetA}
          </dt>
          <dd className="font-mono text-sm text-neutral-100">
            {formatReserve(reserveA)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 rounded-lg bg-neutral-900/70 px-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wide text-neutral-400">
            {assetB}
          </dt>
          <dd className="font-mono text-sm text-neutral-100">
            {formatReserve(reserveB)}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        {buildReserveRatioBarElement({
          shareA: projection.shareA,
          shareB: projection.shareB,
          label: barLabel,
          barClassName:
            "relative flex h-3.5 w-full overflow-hidden rounded-full bg-neutral-800",
          segmentAClassName:
            "h-full bg-lime-400 transition-[width] duration-500 ease-out will-change-[width] motion-reduce:transition-none",
          segmentBClassName:
            "h-full bg-sky-400 transition-[width] duration-500 ease-out will-change-[width] motion-reduce:transition-none",
          markerClassName:
            "absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-amber-400/80",
        })}
      </div>

      <p className="mt-2 text-[11px] text-neutral-400">
        {projection.valueWeighted
          ? `Value-weighted split using a ${formatReserve(
              spotPrice ?? 0,
            )} ${assetB} spot price for 1 ${assetA}.`
          : "Unit split — supply a market spot price to weight the bar by value."}
      </p>

      {projection.priceDeviationPercent !== null ? (
        <p className="mt-1 font-mono text-[11px] text-neutral-400">
          Pool {formatReserve(projection.poolPrice)} {assetB}/{assetA} · market{" "}
          {formatReserve(spotPrice ?? 0)} {assetB} ·{" "}
          {formatSignedPercent(projection.priceDeviationPercent)} vs market
        </p>
      ) : null}

      {projection.arbitrageAvailable ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
          <p className="text-[11px] text-red-200">
            Pool ratio is{" "}
            {formatSignedPercent(projection.priceDeviationPercent ?? 0)} away
            from the market spot price.
          </p>
          <button
            type="button"
            onClick={onArbitrageSwap}
            disabled={!onArbitrageSwap}
            className="shrink-0 rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Arbitrage Swap
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default PoolReserveMonitor;
