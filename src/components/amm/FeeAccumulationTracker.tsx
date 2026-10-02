"use client";

/**
 * FeeAccumulationTracker
 *
 * Live ticker for real-time trading-fee accumulation on a single AMM pool.
 * Listens to `trade_execution` messages on the shared WebSocket feed, keeps a
 * rolling 24-hour window of collected fees, and renders:
 *
 *   - an animated cumulative 24h counter,
 *   - a reconciling LP / protocol fee split,
 *   - a brief green glow whenever an individual fill spikes well above the
 *     recent trade-size average.
 *
 * Two properties are load-bearing and worth stating up front, because the
 * naive implementation gets both wrong:
 *
 * 1. **The split must reconcile.** `lpFee` and `protocolFee` are derived from
 *    the *rounded* total rather than rounded independently, so the three
 *    printed figures sum exactly. Rounding each share on its own lets the
 *    displayed pair drift a unit away from the displayed total (e.g. two
 *    0.125 shares round to 0.13 + 0.13 against a total of 0.25).
 *
 * 2. **The counter must not pop.** Digits render with tabular figures and the
 *    box is pre-sized in `ch` units, so a rising total never reflows its
 *    neighbours mid-tween.
 *
 * `initialTotalFees` / `initialLpFees` seed the rolling window once at mount,
 * standing in for the REST snapshot of fees collected before the socket
 * connected. Later changes to those props are ignored by design.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AmmTradeEvent } from "@/types";
import { useAmmTrades } from "@/app/hooks/useAmmTrades";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Length of the rolling accumulation window. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** How often the window is re-swept, so fees age out even while trading halts. */
const SWEEP_INTERVAL_MS = 30_000;

/** How often the screen-reader live region is refreshed, in ms. */
const ANNOUNCE_INTERVAL_MS = 5_000;

/** Duration of the green spike glow. */
const SPIKE_GLOW_MS = 700;

/** Per-frame smoothing factor for the counter tween. */
const TWEEN_EASING = 0.18;

/** Trailing trade-size samples used as the spike baseline. */
const SPIKE_SAMPLE_WINDOW = 20;

/** Minimum samples before spike detection is armed. */
const SPIKE_MIN_SAMPLES = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FeeAccumulationTrackerProps {
  /** Pool to track, matching `LiquidityPool.id` (e.g. "xlm-usdc"). */
  poolId: string;
  /** Human-readable pair label shown in the header. */
  pair?: string;
  /** Asset the fees are denominated in. */
  feeAsset?: string;
  /** Starting 24h total, in `feeAsset` units, from the pool snapshot. */
  initialTotalFees?: number;
  /** Starting 24h LP portion, in `feeAsset` units. */
  initialLpFees?: number;
  /** Multiple of the rolling mean trade fee that counts as a spike. */
  spikeMultiplier?: number;
  /** Decimal places for the rendered figures. */
  precision?: number;
  /** Additional class names for the wrapper. */
  className?: string;
}

/** One fill's fee contribution inside the rolling window. */
interface Contribution {
  at: number;
  total: number;
  lp: number;
}

interface Split {
  totalUnits: number;
  lpUnits: number;
  protocolUnits: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

const formatterCache = new Map<number, Intl.NumberFormat>();

function getFormatter(precision: number): Intl.NumberFormat {
  let formatter = formatterCache.get(precision);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    formatterCache.set(precision, formatter);
  }
  return formatter;
}

/**
 * Formats an integer count of display units (already scaled by 10^precision).
 * Dividing an integer by a power of ten is exact for every magnitude a fee
 * total can realistically reach, and `Intl` re-rounds to `precision` digits, so
 * the printed text matches the integer the split was derived from.
 */
function formatUnits(units: number, precision: number): string {
  return getFormatter(precision).format(units / 10 ** precision);
}

function toUnits(value: number, precision: number): number {
  return Math.round(value * 10 ** precision);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reduced motion
// ─────────────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return prefersReduced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated counter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eases a displayed integer toward `targetUnits`, returning the animated value
 * rounded to whole display units. State commits only when that rounded value
 * actually changes, so a tween costs one render per digit crossed rather than
 * one per animation frame.
 *
 * Snaps instead of animating when the user prefers reduced motion.
 */
function useTweenedUnits(targetUnits: number, animate: boolean): number {
  const [displayed, setDisplayed] = useState(targetUnits);
  const displayedRef = useRef(targetUnits);
  const targetRef = useRef(targetUnits);
  const frameRef = useRef<number | null>(null);

  // Mirror the target into a ref so the rAF loop always reads the newest value
  // without the loop being torn down and restarted on every incoming trade.
  useEffect(() => {
    targetRef.current = targetUnits;
  }, [targetUnits]);

  useEffect(() => {
    if (!animate) {
      displayedRef.current = targetUnits;
      setDisplayed(targetUnits);
      return;
    }

    if (typeof requestAnimationFrame === "undefined") return;

    const step = () => {
      const current = displayedRef.current;
      const target = targetRef.current;
      const next = Math.round(current + (target - current) * TWEEN_EASING);

      if (next === current || next === target) {
        displayedRef.current = target;
        setDisplayed(target);
        frameRef.current = null;
        return;
      }

      displayedRef.current = next;
      setDisplayed(next);
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [targetUnits, animate]);

  return displayed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FeeAccumulationTracker({
  poolId,
  pair,
  feeAsset = "USD",
  initialTotalFees = 0,
  initialLpFees = 0,
  spikeMultiplier = 2.5,
  precision = 2,
  className = "",
}: FeeAccumulationTrackerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const seedTotal = Number.isFinite(initialTotalFees) ? initialTotalFees : 0;
  const seedLp = Number.isFinite(initialLpFees) ? initialLpFees : 0;

  // ── Rolling window (hot path — mutated in place, never re-rendered) ───────
  // The seed is timestamped now so the snapshot baseline ages out on the same
  // schedule as live fills rather than lingering indefinitely.
  const contributionsRef = useRef<Contribution[]>(
    seedTotal > 0 || seedLp > 0
      ? [{ at: Date.now(), total: seedTotal, lp: seedLp }]
      : [],
  );
  const aggregateRef = useRef({ total: seedTotal, lp: seedLp });
  const spikeSamplesRef = useRef<number[]>([]);
  const [committed, setCommitted] = useState({ total: seedTotal, lp: seedLp });

  // ── rAF-coalesced commit ─────────────────────────────────────────────────
  // A burst of N trades inside one frame produces exactly one setState.
  const flushRef = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (flushRef.current !== null) return;
    flushRef.current = requestAnimationFrame(() => {
      flushRef.current = null;
      const { total, lp } = aggregateRef.current;
      setCommitted((prev) =>
        prev.total === total && prev.lp === lp ? prev : { total, lp },
      );
    });
  }, []);

  // Drop contributions that have fallen out of the 24h window. Sums decrement
  // incrementally, so this stays O(expired) rather than O(window).
  const prune = useCallback((now: number) => {
    const contributions = contributionsRef.current;
    const aggregate = aggregateRef.current;
    while (
      contributions.length > 0 &&
      contributions[0].at <= now - WINDOW_MS
    ) {
      const expired = contributions.shift()!;
      aggregate.total -= expired.total;
      aggregate.lp -= expired.lp;
    }
  }, []);

  // ── Spike glow ───────────────────────────────────────────────────────────
  const [glowToken, setGlowToken] = useState(0);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerGlow = useCallback(() => {
    setGlowToken((token) => token + 1);
    if (glowTimerRef.current !== null) clearTimeout(glowTimerRef.current);
    glowTimerRef.current = setTimeout(
      () => setGlowToken(0),
      prefersReducedMotion ? 0 : SPIKE_GLOW_MS,
    );
  }, [prefersReducedMotion]);

  // ── Trade intake ─────────────────────────────────────────────────────────
  const handleTrade = useCallback(
    (trade: AmmTradeEvent) => {
      const total = Number(trade.feeAmount);
      if (!Number.isFinite(total) || total <= 0) return;

      // The feed is authoritative for the split, but clamp LP to the total so
      // a malformed frame can never produce a negative protocol remainder.
      const lp = Math.min(Math.max(Number(trade.lpFee) || 0, 0), total);

      // Spike check against the trailing trade-size baseline, evaluated before
      // this sample joins so a single outlier cannot dilute its own threshold.
      const samples = spikeSamplesRef.current;
      if (samples.length >= SPIKE_MIN_SAMPLES) {
        const mean =
          samples.reduce((sum, fee) => sum + fee, 0) / samples.length;
        if (mean > 0 && total > mean * spikeMultiplier) triggerGlow();
      }
      samples.push(total);
      if (samples.length > SPIKE_SAMPLE_WINDOW) samples.shift();

      const now = Date.now();
      contributionsRef.current.push({ at: now, total, lp });
      const aggregate = aggregateRef.current;
      aggregate.total += total;
      aggregate.lp += lp;

      prune(now);
      flush();
    },
    [prune, flush, spikeMultiplier, triggerGlow],
  );

  const { isConnected } = useAmmTrades({ onTrade: handleTrade, poolId });

  // Keep the window ageing on time even while the pool is idle.
  useEffect(() => {
    const timer = setInterval(() => {
      prune(Date.now());
      flush();
    }, SWEEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [prune, flush]);

  // Release the pending frame and glow timer on unmount.
  useEffect(
    () => () => {
      if (flushRef.current !== null) cancelAnimationFrame(flushRef.current);
      if (glowTimerRef.current !== null) clearTimeout(glowTimerRef.current);
    },
    [],
  );

  // ── Animated total ───────────────────────────────────────────────────────
  const totalUnitsTarget = toUnits(Math.max(committed.total, 0), precision);
  const totalUnits = useTweenedUnits(totalUnitsTarget, !prefersReducedMotion);

  // ── Reconciling LP / protocol split ──────────────────────────────────────
  // Share of collected fees owed to LPs; 0 for an empty window so the split bar
  // never divides by zero.
  const lpRatio =
    committed.total > 0
      ? Math.min(1, Math.max(0, committed.lp / committed.total))
      : 0;

  // Both shares are derived from the *rounded* total, and the protocol figure
  // absorbs the rounding residual. That makes `lp + protocol === total` hold
  // exactly at display precision, which rounding each share independently
  // cannot guarantee.
  const split: Split = useMemo(() => {
    const lpUnits = Math.round(totalUnits * lpRatio);
    return {
      totalUnits,
      lpUnits,
      protocolUnits: totalUnits - lpUnits,
    };
  }, [totalUnits, lpRatio]);

  const totalText = formatUnits(split.totalUnits, precision);
  const lpText = formatUnits(split.lpUnits, precision);
  const protocolText = formatUnits(split.protocolUnits, precision);

  // Reserve box width from the wider of the rendered value and the value being
  // tweened toward — the tween only ever passes through values between the two,
  // so the container can never need to resize mid-animation.
  const targetText = formatUnits(totalUnitsTarget, precision);
  const reservedWidth = useMemo(
    () => Math.max(totalText.length, targetText.length),
    [totalText, targetText],
  );

  // ── Screen-reader channel ────────────────────────────────────────────────
  // The digits change far too fast to announce directly, so the whole visual
  // card is hidden from assistive tech and a single throttled live region
  // carries the summary instead. The interval reads a ref rather than
  // re-subscribing on every tick, which would make it announce per-trade.
  const summaryRef = useRef({ totalText, lpText, protocolText, feeAsset });
  useEffect(() => {
    summaryRef.current = { totalText, lpText, protocolText, feeAsset };
  });

  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!isConnected) {
      setAnnouncement("");
      return;
    }
    const publish = () => {
      const current = summaryRef.current;
      setAnnouncement(
        `24 hour fees collected: ${current.totalText} ${current.feeAsset}. ` +
          `Liquidity providers ${current.lpText}, protocol ${current.protocolText}.`,
      );
    };
    publish();
    const timer = setInterval(publish, ANNOUNCE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isConnected]);

  const glowActive = glowToken > 0 && !prefersReducedMotion;

  const containerClasses = useMemo(
    () =>
      [
        "relative isolate overflow-hidden rounded-2xl border bg-neutral-900/80 p-4",
        "font-sans transition-shadow duration-500",
        glowActive
          ? "border-emerald-400/60 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_28px_rgba(52,211,153,0.30)]"
          : "border-neutral-800",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [glowActive, className],
  );

  return (
    <div
      className={containerClasses}
      data-testid="fee-accumulation-tracker"
      data-spiking={glowActive ? "true" : "false"}
    >
      {/* Spike glow overlay. Keyed on the token so back-to-back spikes restart
          the animation instead of being swallowed by the one already running. */}
      {glowActive ? (
        <span
          key={glowToken}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-emerald-400/10 motion-safe:animate-[fee-spike-glow_700ms_ease-out_1]"
        />
      ) : null}

      <div aria-hidden="true">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
              24h fees collected
            </p>
            {pair ? (
              <p className="truncate text-sm font-semibold text-neutral-200">
                {pair}
              </p>
            ) : null}
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-neutral-400">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`}
            />
            {isConnected ? "Live" : "Connecting"}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-3xl font-bold tabular-nums text-neutral-50"
            style={{ minWidth: `${reservedWidth}ch` }}
          >
            {totalText}
          </span>
          <span className="font-mono text-sm text-neutral-400">{feeAsset}</span>
        </div>

        {/* LP / protocol split bar */}
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <span
            className="h-full bg-emerald-400 transition-[width] duration-500 ease-out"
            style={{ width: `${(lpRatio * 100).toFixed(2)}%` }}
          />
          <span className="h-full flex-1 bg-sky-500/70" />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              LP share
            </dt>
            <dd className="mt-0.5 flex items-baseline gap-1">
              <span className="font-mono text-base font-semibold tabular-nums text-emerald-300">
                {lpText}
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                {(lpRatio * 100).toFixed(1)}%
              </span>
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Protocol
            </dt>
            <dd className="mt-0.5 flex items-baseline gap-1">
              <span className="font-mono text-base font-semibold tabular-nums text-sky-300">
                {protocolText}
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                {((1 - lpRatio) * 100).toFixed(1)}%
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

export default FeeAccumulationTracker;
