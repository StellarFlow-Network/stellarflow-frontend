"use client";

import React, { useMemo, useState, useRef, useId, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VolumeAnomalyAlertProps {
  /** 15-minute trading volume for the pool (in USD or base asset units) */
  currentVolume15m: number;
  /** 7-day rolling average volume over the same 15-minute window */
  rollingAvgVolume7d: number;
  /** Normalised volatility score, e.g. 0–100 */
  volatilityScore: number;
  /** Additional class names for the wrapper span */
  className?: string;
  /** Tooltip position relative to the badge */
  tooltipPosition?: "top" | "bottom" | "left" | "right";
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The anomaly threshold: current 15-minute volume must be **strictly greater
 * than** 300 % of the 7-day rolling average to trigger the badge.
 */
const ANOMALY_THRESHOLD_MULTIPLIER = 3; // 300 %

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives the volume spike magnitude as a whole-number percentage string.
 * e.g. 3.45 × baseline → "345%"
 */
function calcSpikePct(current: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.round((current / baseline) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip position class maps — mirrors DeFiTooltip pattern
// ─────────────────────────────────────────────────────────────────────────────

const TOOLTIP_POSITION_CLASSES: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const TOOLTIP_ARROW_CLASSES: Record<string, string> = {
  top: "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-neutral-800 border-x-transparent border-b-transparent",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-neutral-800 border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-neutral-800 border-y-transparent border-r-transparent",
  right:
    "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-neutral-800 border-y-transparent border-l-transparent",
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `VolumeAnomalyAlert`
 *
 * Renders a pulsing 🔥 fire badge when a pool's 15-minute trading volume
 * strictly exceeds 300 % of its 7-day rolling average.  Hovering or focusing
 * the badge reveals a tooltip with the spike magnitude and volatility score.
 *
 * Renders nothing when the anomaly condition is not met.
 *
 * @example
 * ```tsx
 * <VolumeAnomalyAlert
 *   currentVolume15m={4_500_000}
 *   rollingAvgVolume7d={1_200_000}
 *   volatilityScore={78}
 * />
 * ```
 */
export const VolumeAnomalyAlert = React.memo(
  function VolumeAnomalyAlert({
    currentVolume15m,
    rollingAvgVolume7d,
    volatilityScore,
    className = "",
    tooltipPosition = "top",
  }: VolumeAnomalyAlertProps) {
    // ── Anomaly detection ──────────────────────────────────────────────────
    const { isAnomaly, spikePct } = useMemo(() => {
      const baseline = rollingAvgVolume7d;
      // Strictly greater than 300 % of the 7-day rolling average
      const anomaly =
        baseline > 0 &&
        currentVolume15m > ANOMALY_THRESHOLD_MULTIPLIER * baseline;
      return {
        isAnomaly: anomaly,
        spikePct: calcSpikePct(currentVolume15m, baseline),
      };
    }, [currentVolume15m, rollingAvgVolume7d]);

    // ── Tooltip state ──────────────────────────────────────────────────────
    const [isOpen, setIsOpen] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tooltipId = useId();

    const clearTimer = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };

    const handleOpen = () => {
      clearTimer();
      setIsOpen(true);
    };

    const handleClose = () => {
      clearTimer();
      closeTimerRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    // Dismiss on Escape
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen]);

    // Cleanup timer on unmount
    useEffect(() => () => clearTimer(), []);

    // ── Guard: render nothing when no anomaly ──────────────────────────────
    if (!isAnomaly) return null;

    const positionCls =
      TOOLTIP_POSITION_CLASSES[tooltipPosition] ??
      TOOLTIP_POSITION_CLASSES.top;
    const arrowCls =
      TOOLTIP_ARROW_CLASSES[tooltipPosition] ?? TOOLTIP_ARROW_CLASSES.top;

    return (
      <span className={`relative inline-flex items-center ${className}`}>
        {/* ── Trigger button ── */}
        <button
          ref={triggerRef}
          type="button"
          className={[
            // Pulsing fire badge
            "inline-flex items-center justify-center",
            "w-7 h-7 rounded-full",
            "bg-orange-500/20 border border-orange-500/60",
            "text-base leading-none select-none",
            // Tailwind animate-pulse for the pulsing glow effect
            "animate-pulse",
            "cursor-default",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-900",
            "transition-colors hover:bg-orange-500/30",
          ].join(" ")}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          onFocus={handleOpen}
          onBlur={handleClose}
          onClick={() => setIsOpen((v) => !v)}
          aria-label={`Volume anomaly detected: ${spikePct}% volume spike`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-describedby={isOpen ? tooltipId : undefined}
        >
          🔥
        </button>

        {/* ── Tooltip overlay ── */}
        {isOpen && (
          <div
            id={tooltipId}
            role="dialog"
            aria-label="Volume anomaly details"
            className={[
              "absolute z-50 w-56 p-3 rounded-xl shadow-2xl",
              "bg-neutral-900 border border-orange-500/40 text-neutral-100",
              "text-xs",
              positionCls,
            ].join(" ")}
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2 mb-2">
              <span className="text-base leading-none" aria-hidden="true">
                🔥
              </span>
              <span className="font-semibold text-orange-400 text-sm">
                Volume Anomaly
              </span>
            </div>

            {/* Spike magnitude */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Spike Magnitude</span>
                <span className="font-bold text-orange-300 font-mono">
                  {spikePct}% Volume Spike
                </span>
              </div>

              {/* Volatility score */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Volatility Score</span>
                <span
                  className={[
                    "font-bold font-mono",
                    volatilityScore >= 75
                      ? "text-red-400"
                      : volatilityScore >= 50
                        ? "text-amber-400"
                        : "text-lime-400",
                  ].join(" ")}
                >
                  {volatilityScore.toFixed(1)}
                </span>
              </div>

              {/* Warning callout */}
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-orange-950/40 border border-orange-800/50 text-orange-300 text-[11px]">
                <AlertTriangle
                  className="w-3 h-3 shrink-0 mt-0.5 text-orange-400"
                  aria-hidden="true"
                />
                <span>
                  15 m volume is&nbsp;
                  <strong className="text-orange-200">{spikePct}%</strong>
                  &nbsp;of the 7-day rolling average — well above the 300%
                  alert threshold.
                </span>
              </div>
            </div>

            {/* Pointer arrow */}
            <div
              className={`absolute w-0 h-0 border-4 ${arrowCls}`}
              aria-hidden="true"
            />
          </div>
        )}
      </span>
    );
  },
);

VolumeAnomalyAlert.displayName = "VolumeAnomalyAlert";

export default VolumeAnomalyAlert;
