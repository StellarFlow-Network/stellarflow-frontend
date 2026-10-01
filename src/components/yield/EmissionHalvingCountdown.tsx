"use client";

/**
 * EmissionHalvingCountdown
 *
 * Countdown meter for the next scheduled halving of protocol reward-token
 * emissions. The remaining time is derived from ledger heights rather than a
 * wall-clock schedule, so it stays accurate across network hiccups:
 *
 *   remainingSeconds = blocksRemaining * avgBlockTimeSeconds
 *
 * Stellar closes a ledger roughly every 5 seconds, which is the default
 * `avgBlockTimeSeconds` used to project the halving height into real time.
 *
 * Tokenomics model — emissions halve every `halvingIntervalBlocks` ledgers:
 *
 *   epoch      = floor(blockHeight / halvingIntervalBlocks)
 *   rate(epoch) = initialEmissionRatePerYear / 2 ^ epoch
 *
 * All maths lives in exported pure helpers so the tokenomics model can be
 * unit-tested without mounting the component.
 */

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Flame, Info, TrendingDown, Zap } from "lucide-react";
import { DeFiTooltip } from "@/components/ui/DeFiTooltip";
import { useMounted } from "@/app/hooks/useMounted";

/** Stellar target ledger close time, in seconds. */
export const DEFAULT_AVG_BLOCK_TIME_SECONDS = 5;

/**
 * Ledgers per halving epoch. At ~5s per ledger this is 6,307,200 ledgers,
 * i.e. one 365-day year of emissions between halvings.
 */
export const DEFAULT_HALVING_INTERVAL_BLOCKS = 6_307_200;

/** Genesis annual emission before any halving has occurred. */
export const DEFAULT_INITIAL_EMISSION_RATE_PER_YEAR = 21_000_000;

/**
 * Beyond 2^52 a JS number can no longer represent an integer fraction of a
 * token, so emission is treated as fully decayed rather than denormal noise.
 */
const MAX_SAFE_EMISSION_EXPONENT = 52;

export interface HalvingMilestone {
  /** Halving epoch number; 1 is the first halving. */
  epoch: number;
  /** Ledger height at which this halving lands. */
  blockHeight: number;
  /** Emission rate per year in effect immediately after the halving. */
  emissionRatePerYear: number;
}

export interface EmissionHalvingCountdownProps {
  /** Latest observed ledger height. Drives the whole meter. */
  currentBlockHeight: number;
  /**
   * Epoch ms at which `currentBlockHeight` was sampled. When supplied, the
   * meter projects forward from this anchor so the countdown stays smooth
   * between parent polls. Defaults to the time the height was first seen.
   */
  blockHeightObservedAt?: number;
  /** Mean ledger close time used to project heights into wall-clock time. */
  avgBlockTimeSeconds?: number;
  /** Ledger distance between halvings. */
  halvingIntervalBlocks?: number;
  /** Annual emission at epoch 0. */
  initialEmissionRatePerYear?: number;
  /** Ticker for the reward token, e.g. "DOR". */
  rewardSymbol?: string;
  /**
   * Share of the farm's current APY funded by token emissions, 0-100.
   * The remainder is protocol fees and is unaffected by halvings.
   */
  emissionApySharePercent?: number;
  /** Number of upcoming halvings to surface as milestone badges. */
  milestoneCount?: number;
  className?: string;
}

/** Zero-padded 2-digit value, used by the duration formatter. */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** "12d 04:33:21" — days only appear once the remaining time exceeds a day. */
export function formatRemainingDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

/** Which halving epoch a ledger height falls in. */
export function getHalvingEpoch(
  blockHeight: number,
  halvingIntervalBlocks: number = DEFAULT_HALVING_INTERVAL_BLOCKS,
): number {
  if (!Number.isFinite(blockHeight) || blockHeight < 0) return 0;
  return Math.floor(blockHeight / halvingIntervalBlocks);
}

/**
 * Annual emission rate for an epoch. Halves with every epoch boundary and
 * clamps to 0 once the value would fall below representable precision.
 */
export function getEmissionRatePerYear(
  epoch: number,
  initialEmissionRatePerYear: number = DEFAULT_INITIAL_EMISSION_RATE_PER_YEAR,
): number {
  if (epoch < 0 || epoch >= MAX_SAFE_EMISSION_EXPONENT) return 0;
  return initialEmissionRatePerYear / 2 ** epoch;
}

/** Ledger height at which the given halving epoch begins. */
export function getHalvingBlockHeight(
  epoch: number,
  halvingIntervalBlocks: number = DEFAULT_HALVING_INTERVAL_BLOCKS,
): number {
  return epoch * halvingIntervalBlocks;
}

/** Upcoming halving epochs after the current one, oldest first. */
export function getUpcomingHalvings(
  currentEpoch: number,
  count: number,
  halvingIntervalBlocks: number = DEFAULT_HALVING_INTERVAL_BLOCKS,
  initialEmissionRatePerYear: number = DEFAULT_INITIAL_EMISSION_RATE_PER_YEAR,
): HalvingMilestone[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const epoch = currentEpoch + index + 1;
    return {
      epoch,
      blockHeight: getHalvingBlockHeight(epoch, halvingIntervalBlocks),
      emissionRatePerYear: getEmissionRatePerYear(epoch, initialEmissionRatePerYear),
    };
  });
}

/** Format a rate for display, trimming trailing zeros on sub-unit values. */
function formatRate(perYear: number): string {
  return perYear.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const EmissionHalvingCountdown = ({
  currentBlockHeight,
  blockHeightObservedAt,
  avgBlockTimeSeconds = DEFAULT_AVG_BLOCK_TIME_SECONDS,
  halvingIntervalBlocks = DEFAULT_HALVING_INTERVAL_BLOCKS,
  initialEmissionRatePerYear = DEFAULT_INITIAL_EMISSION_RATE_PER_YEAR,
  rewardSymbol = "DOR",
  emissionApySharePercent = 60,
  milestoneCount = 3,
  className = "",
}: EmissionHalvingCountdownProps) => {
  // Re-renders once per second so the projected height — and therefore the
  // countdown — advances in real time even if the parent never re-polls.
  const [now, setNow] = useState<number | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const safeBlockTime =
    Number.isFinite(avgBlockTimeSeconds) && avgBlockTimeSeconds > 0
      ? avgBlockTimeSeconds
      : DEFAULT_AVG_BLOCK_TIME_SECONDS;

  // Anchor the observed height to a wall-clock instant. Falls back to the
  // first render so the countdown never sits at a stale offset, and re-anchors
  // whenever the parent hands us a fresh height.
  const anchorRef = useRef({ height: currentBlockHeight, at: Date.now() });
  if (anchorRef.current.height !== currentBlockHeight) {
    anchorRef.current = { height: currentBlockHeight, at: Date.now() };
  }
  const anchor = blockHeightObservedAt ?? anchorRef.current.at;

  // Ledger height projected to the current instant, so the meter keeps
  // counting down between ledger polls. Kept fractional so the timer ticks
  // every second; whole-ledger values below are floored off it.
  const projectedBlockHeight = useMemo(() => {
    if (now === null) return currentBlockHeight;
    const elapsedSeconds = Math.max(0, (now - anchor) / 1000);
    return currentBlockHeight + elapsedSeconds / safeBlockTime;
  }, [now, currentBlockHeight, anchor, safeBlockTime]);

  const effectiveBlockHeight = Math.floor(projectedBlockHeight);

  const schedule = useMemo(() => {
    const safeInterval =
      Number.isFinite(halvingIntervalBlocks) && halvingIntervalBlocks > 0
        ? halvingIntervalBlocks
        : DEFAULT_HALVING_INTERVAL_BLOCKS;

    const epoch = getHalvingEpoch(effectiveBlockHeight, safeInterval);
    const nextEpoch = epoch + 1;

    const currentRate = getEmissionRatePerYear(epoch, initialEmissionRatePerYear);
    const nextRate = getEmissionRatePerYear(nextEpoch, initialEmissionRatePerYear);

    const currentEpochStart = getHalvingBlockHeight(epoch, safeInterval);
    const nextBlockHeight = getHalvingBlockHeight(nextEpoch, safeInterval);

    // Time is projected from the fractional height so the countdown moves in
    // step with the wall clock, while blocks/progress stay whole-ledger exact.
    const remainingSeconds = Math.max(
      0,
      (nextBlockHeight - projectedBlockHeight) * safeBlockTime,
    );
    const blocksIntoEpoch = Math.max(0, effectiveBlockHeight - currentEpochStart);
    const progress =
      safeInterval > 0 ? Math.min(1, Math.max(0, blocksIntoEpoch / safeInterval)) : 1;

    return {
      epoch,
      nextEpoch,
      currentRate,
      nextRate,
      nextBlockHeight,
      remainingSeconds,
      progress,
      milestones: getUpcomingHalvings(
        epoch,
        milestoneCount,
        safeInterval,
        initialEmissionRatePerYear,
      ),
    };
  }, [
    projectedBlockHeight,
    effectiveBlockHeight,
    halvingIntervalBlocks,
    initialEmissionRatePerYear,
    safeBlockTime,
    milestoneCount,
  ]);

  // APY impact: only the emission-funded slice of yield halves. Fee yield
  // persists, so the post-halving APY floors at the non-emission portion.
  const apyImpact = useMemo(() => {
    const share = Math.min(100, Math.max(0, emissionApySharePercent));
    return { share };
  }, [emissionApySharePercent]);

  const currentRateDisplay = mounted ? formatRate(schedule.currentRate) : "—";
  const nextRateDisplay = mounted ? formatRate(schedule.nextRate) : "—";
  const rateDropPercent =
    schedule.currentRate > 0 ? (1 - schedule.nextRate / schedule.currentRate) * 100 : 0;

  const progressPercent = Math.round(schedule.progress * 100);

  return (
    <section
      className={`space-y-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 ${className}`}
      aria-label="Reward emission halving countdown"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-amber-400" aria-hidden="true" />
            <h2 className="text-xl font-bold text-white">Emission Halving</h2>
            <DeFiTooltip
              showIcon
              position="bottom"
              title="Emission Halving"
              shortDefinition={`Reward token emissions halve every ${formatRate(
                halvingIntervalBlocks,
              )} ledgers, cutting the ${rewardSymbol} reward rate by half.`}
              detailedExplanation={`Each halving permanently cuts ${rewardSymbol} emissions to 50% of the previous epoch. Because emissions fund a share of farm yield, the emission-driven portion of your APY halves while the protocol-fee portion is untouched. Total APY therefore falls by less than half — existing positions keep earning fees, but the ${rewardSymbol} tail drops. The halving is enforced on-chain at a fixed block height, so it cannot be delayed.`}
            >
              <span className="sr-only">What is an emission halving?</span>
            </DeFiTooltip>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {rewardSymbol} reward emissions reset at ledger{" "}
            <span className="font-mono text-slate-300">
              {mounted ? schedule.nextBlockHeight.toLocaleString("en-US") : "—"}
            </span>
            .
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
          <Zap size={12} aria-hidden="true" />
          Epoch {schedule.epoch} &rarr; {schedule.nextEpoch}
        </span>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Time to next halving</p>
        <p
          className="mt-1 font-mono text-3xl font-bold tabular-nums text-white"
          role="timer"
          aria-live="polite"
        >
          {mounted ? formatRemainingDuration(schedule.remainingSeconds) : "--d --:--:--"}
        </p>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={mounted ? progressPercent : undefined}
          aria-label="Progress through current emission epoch"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-700 ease-out"
            style={{ width: `${progressPercent}%`, filter: "drop-shadow(0 0 6px rgba(245,158,11,0.55))" }}
          />
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {mounted ? `${progressPercent}%` : "—"} through epoch {schedule.epoch} &middot;{" "}
          {blocksRemainingLabel(mounted, schedule.nextBlockHeight - effectiveBlockHeight)} blocks
          remaining
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <dt className="text-xs text-slate-400">Current emission</dt>
          <dd className="mt-1 text-lg font-bold text-emerald-400">
            {currentRateDisplay} {rewardSymbol}/yr
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <dt className="text-xs text-slate-400">After halving</dt>
          <dd className="mt-1 text-lg font-bold text-amber-400">
            {nextRateDisplay} {rewardSymbol}/yr
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            Yield impact
            <DeFiTooltip
              showIcon
              position="top"
              title="Yield Impact"
              shortDefinition={`Emissions fund ${apyImpact.share}% of current farm APY; the rest is protocol fees.`}
              detailedExplanation={`Halving cuts the emission-funded ${apyImpact.share}% of APY in half. Protocol fee yield is unaffected, so a farm at 100% APY would settle near 50% + the fee share rather than dropping to zero.`}
            >
              <span className="sr-only">How halvings affect yield APY</span>
            </DeFiTooltip>
          </dt>
          <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold text-slate-200">
            <TrendingDown size={16} className="text-rose-400" aria-hidden="true" />
            {apyImpact.share}% &rarr; {apyImpact.share / 2}% of APY
          </dd>
          <dd className="mt-0.5 text-xs text-slate-500">
            {rewardSymbol} rate &minus;{rateDropPercent.toFixed(0)}%
          </dd>
        </div>
      </dl>

      {schedule.milestones.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
            <Info size={14} className="text-slate-500" aria-hidden="true" />
            Upcoming halvings
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {schedule.milestones.map((milestone, index) => (
              <li key={milestone.epoch}>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    index === 0
                      ? "animate-pulse border-amber-300/60 bg-amber-400/15 text-amber-200"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                  }`}
                  style={
                    index === 0
                      ? { boxShadow: "0 0 14px rgba(245,158,11,0.45)" }
                      : undefined
                  }
                >
                  <Flame size={12} aria-hidden="true" />
                  {index === 0 ? "Next" : `H-${index + 1}`}
                  <span className="font-mono font-normal opacity-80">
                    {index === 0 && mounted
                      ? formatRemainingDuration(
                          (milestone.blockHeight - projectedBlockHeight) * safeBlockTime,
                        )
                      : `#${milestone.blockHeight.toLocaleString("en-US")}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

function blocksRemainingLabel(mounted: boolean, blocks: number): string {
  if (!mounted) return "—";
  return Math.max(0, Math.round(blocks)).toLocaleString("en-US");
}

export default memo(EmissionHalvingCountdown);
