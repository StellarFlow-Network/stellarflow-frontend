"use client";

/**
 * RateLockCountdown — Issue #718
 *
 * Small "Rate guaranteed for Ns" countdown that resets whenever a fresh FX
 * snapshot arrives (keyed off `anchorTimestamp`). Purely presentational —
 * the timer counts down locally between polls rather than re-fetching.
 */

import { useEffect, useState } from "react";

export interface RateLockCountdownProps {
  /** ISO timestamp the current rate snapshot was generated. */
  anchorTimestamp: string;
  /** Seconds the rate is guaranteed for from `anchorTimestamp`. */
  lockSeconds: number;
  className?: string;
}

export default function RateLockCountdown({
  anchorTimestamp,
  lockSeconds,
  className = "",
}: RateLockCountdownProps) {
  // Ticks once a second purely to force a re-render; the actual remaining
  // time is derived fresh from props on every render below, so a new
  // `anchorTimestamp` is picked up immediately without a separate effect.
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = computeRemaining(anchorTimestamp, lockSeconds);
  const expiring = remaining <= 10;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-mono ${
        expiring ? "text-amber-400" : "text-neutral-400"
      } ${className}`}
      role="timer"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${expiring ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
      {remaining > 0
        ? `Rate guaranteed for ${remaining}s`
        : "Refreshing rate…"}
    </span>
  );
}

function computeRemaining(anchorTimestamp: string, lockSeconds: number): number {
  const anchorMs = new Date(anchorTimestamp).getTime();
  if (Number.isNaN(anchorMs)) return lockSeconds;
  const elapsedSeconds = (Date.now() - anchorMs) / 1000;
  return Math.max(0, Math.round(lockSeconds - elapsedSeconds));
}
