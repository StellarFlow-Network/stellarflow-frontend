"use client";

import React, { useCallback, useEffect, useState } from "react";

/** Market spread above which the banner warns, in percent (#1152). */
export const SPREAD_ALERT_THRESHOLD_PCT = 1.5;

/**
 * Share of the pool's depth a single trade may take before the pool counts
 * as thin for that trade. 2% of depth already moves a constant-product price
 * by roughly 4%.
 */
export const DEPTH_ALERT_RATIO = 0.02;

/** sessionStorage key for "dismissed for this session". */
export const VOLATILITY_DISMISS_KEY = "stellarflow:volatility-alert-dismissed";

export interface VolatilityInput {
  /** Current bid/ask spread of the market, in percent. */
  spreadPct?: number;
  /** Trade size, in the input token. */
  tradeAmount?: number;
  /** Pool liquidity on the input side, in the input token. */
  poolDepth?: number;
  spreadThresholdPct?: number;
  depthAlertRatio?: number;
}

export interface VolatilityAssessment {
  /** Spread is above the threshold. */
  highVolatility: boolean;
  /** The trade is large relative to the pool. */
  lowLiquidity: boolean;
  /** Either condition holds. */
  shouldAlert: boolean;
  /** Trade size as a share of pool depth, in percent, or null if unknown. */
  depthUsagePct: number | null;
  /**
   * Estimated constant-product price impact of the trade, in percent, or null
   * if depth is unknown: amount / (depth + amount).
   */
  estimatedImpactPct: number | null;
}

const isPositive = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Decides whether the swap view should warn, and why. Pure, for testing. */
export function assessVolatility({
  spreadPct,
  tradeAmount,
  poolDepth,
  spreadThresholdPct = SPREAD_ALERT_THRESHOLD_PCT,
  depthAlertRatio = DEPTH_ALERT_RATIO,
}: VolatilityInput): VolatilityAssessment {
  const highVolatility = typeof spreadPct === "number" && Number.isFinite(spreadPct) && spreadPct > spreadThresholdPct;

  let depthUsagePct: number | null = null;
  let estimatedImpactPct: number | null = null;
  let lowLiquidity = false;

  if (isPositive(tradeAmount) && typeof poolDepth === "number" && Number.isFinite(poolDepth)) {
    if (poolDepth <= 0) {
      // An empty pool cannot fill any trade.
      lowLiquidity = true;
      estimatedImpactPct = 100;
    } else {
      depthUsagePct = (tradeAmount / poolDepth) * 100;
      estimatedImpactPct = (tradeAmount / (poolDepth + tradeAmount)) * 100;
      lowLiquidity = tradeAmount / poolDepth > depthAlertRatio;
    }
  }

  return {
    highVolatility,
    lowLiquidity,
    shouldAlert: highVolatility || lowLiquidity,
    depthUsagePct,
    estimatedImpactPct,
  };
}

function readDismissed(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(VOLATILITY_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export interface VolatilityAlertBannerProps extends VolatilityInput {
  /** Where to send the user for other routes or deeper pools. */
  alternativeRoutesHref?: string;
  alternativeRoutesLabel?: string;
  className?: string;
}

/**
 * Yellow warning on the swap view during high volatility or thin liquidity (#1152).
 *
 * Shows when the market spread is above 1.5% or the trade takes too large a
 * share of the pool, with a link to other routes or deeper pools. Dismissing
 * it hides it for the rest of the browser session.
 */
export function VolatilityAlertBanner({
  alternativeRoutesHref = "/pools",
  alternativeRoutesLabel = "Compare routes and deeper pools",
  className = "",
  ...input
}: VolatilityAlertBannerProps) {
  // Start hidden-as-dismissed on the server and read sessionStorage after
  // mount, so server and client render the same markup.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (readDismissed()) setDismissed(true);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(VOLATILITY_DISMISS_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode); the in-memory flag still hides it.
    }
  }, []);

  const assessment = assessVolatility(input);
  if (!assessment.shouldAlert || dismissed) return null;

  const threshold = input.spreadThresholdPct ?? SPREAD_ALERT_THRESHOLD_PCT;
  const reasons: string[] = [];
  if (assessment.highVolatility && typeof input.spreadPct === "number") {
    reasons.push(
      `The market spread is ${input.spreadPct.toFixed(2)}%, above the ${threshold}% volatility threshold.`,
    );
  }
  if (assessment.lowLiquidity) {
    reasons.push(
      assessment.depthUsagePct === null
        ? "This pool has no liquidity for this trade."
        : `This trade uses ${assessment.depthUsagePct.toFixed(1)}% of the pool's depth (about ${assessment.estimatedImpactPct?.toFixed(2)}% price impact).`,
    );
  }

  return (
    <div
      role="alert"
      data-testid="volatility-alert"
      className={`flex items-start gap-3 rounded-xl border border-yellow-400/50 bg-yellow-400/15 p-3 text-sm text-yellow-100 ${className}`}
    >
      <span aria-hidden="true" className="mt-0.5 font-bold text-yellow-300">
        !
      </span>
      <div className="flex-1 space-y-1">
        <p className="font-semibold text-yellow-200">
          {assessment.highVolatility && assessment.lowLiquidity
            ? "High volatility and thin liquidity"
            : assessment.highVolatility
              ? "High market volatility"
              : "Thin pool liquidity"}
        </p>
        {reasons.map((reason) => (
          <p key={reason}>{reason}</p>
        ))}
        <a
          href={alternativeRoutesHref}
          className="inline-block font-medium text-yellow-300 underline underline-offset-2 hover:text-yellow-100"
        >
          {alternativeRoutesLabel}
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss volatility alert for this session"
        className="rounded-md px-2 py-0.5 text-yellow-200 hover:bg-yellow-400/20 focus:outline-none focus:ring-2 focus:ring-yellow-300"
      >
        Dismiss
      </button>
    </div>
  );
}

export default VolatilityAlertBanner;
