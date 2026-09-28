import * as React from "react";
import type { CSSProperties, ReactElement } from "react";
import type {
  DriftSeverity,
  ReserveRatioProjection,
  ReserveRatioProjectionInput,
} from "./PoolReserveMonitor.types";

/** Ideal value split for a balanced constant-product pool. */
export const DEFAULT_IDEAL_SHARE = 0.5;

/** Default deviation (1%) that unlocks the arbitrage CTA. */
export const DEFAULT_ARBITRAGE_THRESHOLD = 0.01;

/** Drift magnitude (percent) at which the badge leaves the "balanced" state. */
export const DRIFT_WARNING_PERCENT = 2;

/** Drift magnitude (percent) at which the badge is flagged as "severe". */
export const DRIFT_SEVERE_PERCENT = 5;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_IDEAL_SHARE;
  return Math.min(1, Math.max(0, value));
}

function clampShare(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return fallback;
  return value;
}

/**
 * Coerces a reserve balance (which may arrive as a precise decimal string)
 * into a finite, non-negative number. Anything unparseable or negative
 * collapses to `0`.
 */
export function toFiniteReserve(value: number | string): number {
  const numeric = typeof value === "string" ? Number(value.trim()) : value;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

/**
 * Formats a reserve balance for display. Precise caller-supplied strings are
 * preserved verbatim so long on-chain values are never rounded; plain numbers
 * are grouped with a bounded number of fraction digits.
 */
export function formatReserve(value: number | string): string {
  if (typeof value === "string") return value;
  return toFiniteReserve(value).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

/** Pool-implied price of 1 unit of asset A in asset B (`reserveB / reserveA`). */
export function computePoolPrice(
  reserveA: number | string,
  reserveB: number | string,
): number {
  const a = toFiniteReserve(reserveA);
  if (a <= 0) return 0;
  return toFiniteReserve(reserveB) / a;
}

/**
 * Signed deviation of the pool price from the market spot price, in percent.
 * Returns `null` when no usable market price is available.
 */
export function computePriceDeviationPercent(
  poolPrice: number,
  spotPrice?: number,
): number | null {
  if (spotPrice === undefined || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    return null;
  }
  if (!Number.isFinite(poolPrice)) return null;
  return ((poolPrice - spotPrice) / spotPrice) * 100;
}

/**
 * True when the absolute market deviation reaches the arbitrage threshold
 * (expressed as a fraction, e.g. `0.01` for 1%).
 */
export function shouldSuggestArbitrage(
  deviationPercent: number | null,
  threshold: number = DEFAULT_ARBITRAGE_THRESHOLD,
): boolean {
  if (deviationPercent === null || !Number.isFinite(deviationPercent)) {
    return false;
  }
  const safeThreshold =
    Number.isFinite(threshold) && threshold >= 0
      ? threshold
      : DEFAULT_ARBITRAGE_THRESHOLD;
  return Math.abs(deviationPercent) >= safeThreshold * 100;
}

/** Classifies a drift percentage into the badge severity buckets. */
export function describeDrift(driftPercent: number): DriftSeverity {
  const magnitude = Math.abs(driftPercent);
  if (!Number.isFinite(magnitude) || magnitude < DRIFT_WARNING_PERCENT) {
    return "balanced";
  }
  return magnitude >= DRIFT_SEVERE_PERCENT ? "severe" : "moderate";
}

/** Formats a percentage with a fixed number of fraction digits. */
export function formatPercent(value: number, digits = 2): string {
  const numeric = Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(digits)}%`;
}

/** Formats a percentage with an explicit leading sign for non-negative values. */
export function formatSignedPercent(value: number, digits = 2): string {
  const numeric = Number.isFinite(value) ? value : 0;
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(digits)}%`;
}

/**
 * Applies the raw reserve inputs to the derived view model. Pure: the same
 * inputs always produce the same projection, which makes the monitor a thin
 * render layer over this function.
 */
export function computeReserveRatioProjection(
  input: ReserveRatioProjectionInput,
): ReserveRatioProjection {
  const reserveA = toFiniteReserve(input.reserveA);
  const reserveB = toFiniteReserve(input.reserveB);
  const totalReserve = reserveA + reserveB;

  // Pool price is `reserveB / reserveA` (quote per base).
  const poolPrice = reserveA > 0 ? reserveB / reserveA : 0;

  const hasSpotPrice =
    input.spotPrice !== undefined &&
    Number.isFinite(input.spotPrice) &&
    (input.spotPrice ?? 0) > 0;

  const valueA = hasSpotPrice ? reserveA * (input.spotPrice as number) : reserveA;
  const valueB = reserveB;
  const totalValue = valueA + valueB;

  const shareA = clamp01(
    totalValue > 0 ? valueA / totalValue : DEFAULT_IDEAL_SHARE,
  );
  const shareB = clamp01(1 - shareA);

  const idealShare = clampShare(
    input.idealShare ?? DEFAULT_IDEAL_SHARE,
    DEFAULT_IDEAL_SHARE,
  );
  const driftPercent = (shareA - idealShare) * 100;

  const priceDeviationPercent = computePriceDeviationPercent(
    poolPrice,
    input.spotPrice,
  );

  return {
    reserveA,
    reserveB,
    totalReserve,
    poolPrice,
    valueA,
    valueB,
    shareA,
    shareB,
    driftPercent,
    priceDeviationPercent,
    arbitrageAvailable: shouldSuggestArbitrage(
      priceDeviationPercent,
      input.arbitrageThreshold,
    ),
    valueWeighted: hasSpotPrice,
  };
}

export interface ReserveRatioBarView {
  /** Share of the bar occupied by asset A (0–1). */
  shareA: number;
  /** Share of the bar occupied by asset B (0–1). */
  shareB: number;
  /** Accessible description announced for the whole bar. */
  label: string;
  barClassName?: string;
  segmentAClassName?: string;
  segmentBClassName?: string;
  markerClassName?: string;
}

/**
 * Builds the two-segment reserve-ratio bar as a React element.
 *
 * Kept as a plain `createElement` builder (rather than JSX) so the markup can
 * be rendered and asserted in the `node:test` suite without a JSX transform.
 */
export function buildReserveRatioBarElement(
  view: ReserveRatioBarView,
): ReactElement {
  const percentA = clamp01(view.shareA) * 100;
  const percentB = clamp01(view.shareB) * 100;
  const segmentStyle = (percent: number): CSSProperties => ({
    width: `${percent}%`,
  });

  return React.createElement(
    "div",
    {
      className: view.barClassName,
      role: "img",
      "aria-label": view.label,
    },
    React.createElement("div", {
      className: view.segmentAClassName,
      style: segmentStyle(percentA),
      "aria-hidden": true,
    }),
    React.createElement("div", {
      className: view.segmentBClassName,
      style: segmentStyle(percentB),
      "aria-hidden": true,
    }),
    React.createElement("span", {
      className: view.markerClassName,
      style: { left: "50%" },
      "aria-hidden": true,
    }),
  );
}
