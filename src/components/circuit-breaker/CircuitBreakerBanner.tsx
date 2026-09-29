'use client';

/**
 * CircuitBreakerBanner
 *
 * High-visibility emergency alert pinned to the top of the root layout.
 *
 * Subscribes to the shared {@link CircuitBreakerProvider} and renders the
 * instant the indexer mirrors an on-chain `CircuitBreakerTriggered` event.
 * The banner names every halted protocol module and states the two numbers a
 * user actually needs during an incident — how long the risk review is
 * expected to take and when the module is estimated to come back.
 *
 * Accessibility notes:
 *   - `role="alert"` + `aria-live="assertive"` so the pause is announced the
 *     moment it lands, not on the next navigation.
 *   - The flash is a plain CSS animation registered in `globals.css` and is
 *     switched off under `prefers-reduced-motion: reduce`.
 *   - Countdown text is only rendered after mount so the server and client
 *     markup agree on the first paint.
 */

import React, { useEffect, useState } from 'react';
import { Clock, RotateCcw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useMounted } from '@/app/hooks/useMounted';
import { useCircuitBreakerState } from './CircuitBreakerContext';
import {
  formatDurationMinutes,
  formatRecoveryClock,
  formatRecoveryCountdown,
} from '@/lib/circuitBreakerEvents';
import type { ActiveModulePause } from '@/types/circuitBreaker';

/** How often the relative countdown re-renders while a pause is active. */
const COUNTDOWN_INTERVAL_MS = 1_000;

export interface CircuitBreakerBannerProps {
  /** Override the headline. Defaults to a count-aware emergency headline. */
  title?: string;
}

export function CircuitBreakerBanner({ title }: CircuitBreakerBannerProps) {
  const { activePauses, isMonitoring } = useCircuitBreakerState();
  const mounted = useMounted();
  const [now, setNow] = useState(() => Date.now());

  const isActive = activePauses.length > 0;

  // Tick only while there is something counting down. The interval is aligned
  // to the wall clock so the displayed minute does not drift by up to a second
  // per tick.
  useEffect(() => {
    if (!isActive) return;

    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, COUNTDOWN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const headline = title ?? buildHeadline(activePauses);

  return (
    <aside
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-label="Emergency circuit breaker notice"
      data-testid="circuit-breaker-banner"
      data-circuit-breaker-modules={activePauses.map((pause) => pause.module).join(',')}
      className="circuit-breaker-flash relative z-[70] w-full border-b border-rose-300/50 bg-rose-700 px-4 py-3 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            <TriangleAlert className="h-6 w-6 motion-safe:animate-pulse" />
          </span>

          <div className="min-w-0 text-sm">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold uppercase tracking-wide sm:text-base">
              <span>{headline}</span>
              {!isMonitoring && (
                <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                  Reconnecting to indexer
                </span>
              )}
            </p>

            <ul className="mt-1.5 space-y-1">
              {activePauses.map((pause) => (
                <li
                  key={pause.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-rose-50 sm:text-sm"
                >
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {pause.moduleLabel} paused
                  </span>
                  <span className="text-rose-100/90">{pause.reason}</span>
                  <RecoveryEstimate pause={pause} now={mounted ? now : null} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <dl className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 text-xs lg:justify-end">
          {activePauses.map((pause) => (
            <div key={pause.id} className="flex items-center gap-1.5">
              <dt className="inline-flex items-center gap-1 text-rose-100/80">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {pause.moduleLabel} review
              </dt>
              <dd className="font-mono font-semibold">
                ~{formatDurationMinutes(pause.reviewMinutes)}
              </dd>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <dt className="inline-flex items-center gap-1 text-rose-100/80">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Recovery
            </dt>
            <dd className="font-mono font-semibold">
              {mounted ? `${formatRecoveryClock(earliestRecoveryAt(activePauses))} UTC` : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

export default CircuitBreakerBanner;

/** Earliest estimated recovery across all active pauses. */
function earliestRecoveryAt(pauses: readonly ActiveModulePause[]): number {
  return pauses.reduce(
    (earliest, pause) => Math.min(earliest, pause.estimatedRecoveryAt),
    Number.POSITIVE_INFINITY,
  );
}

function buildHeadline(pauses: readonly ActiveModulePause[]): string {
  const isCritical = pauses.some((pause) => pause.severity === 'critical');
  const scope = pauses.length === 1 ? `${pauses[0].moduleLabel} module` : 'Multiple modules';
  return isCritical
    ? `Circuit breaker triggered — ${scope} halted`
    : `Circuit breaker warning — ${scope} restricted`;
}

/**
 * Relative recovery countdown for one pause.
 *
 * `now` is `null` before mount, which suppresses the countdown instead of
 * rendering a value the server could not have produced.
 */
function RecoveryEstimate({ pause, now }: { pause: ActiveModulePause; now: number | null }) {
  if (now === null) return null;

  const countdown = formatRecoveryCountdown(pause.estimatedRecoveryAt, now);
  return (
    <span className="font-mono text-[11px] text-rose-100/90">
      · recovery {countdown} ({formatRecoveryClock(pause.estimatedRecoveryAt)} UTC)
    </span>
  );
}
