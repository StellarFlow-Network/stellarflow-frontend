'use client';

/**
 * PausedActionButton
 *
 * Locks down the primary action CTA of a protocol module while that module's
 * circuit breaker is in force.
 *
 * The awkward part of disabling a button for a good reason is that
 * `disabled` removes it from the tab order and stops it emitting pointer or
 * focus events, so the user is left with a dead control and no explanation.
 * This wrapper solves that by:
 *
 *   1. Cloning the caller's single child element to force `disabled` and
 *      `aria-disabled`, so the action genuinely cannot fire.
 *   2. Wrapping it in a focusable, hoverable carrier that owns the
 *      explanation — a native `title` tooltip for pointer users and a styled
 *      popover wired through `aria-describedby` for keyboard and touch.
 *
 * When the module is running normally the child is returned untouched: no
 * wrapper, no clone, no extra nodes on the happy path.
 */

import React, { useCallback, useId, useState, type ReactElement } from 'react';
import { Lock } from 'lucide-react';
import { useMounted } from '@/app/hooks/useMounted';
import { useModulePause } from './CircuitBreakerContext';
import {
  buildPauseTooltip,
  formatDurationMinutes,
  formatRecoveryClock,
  formatRecoveryCountdown,
} from '@/lib/circuitBreakerEvents';
import { CIRCUIT_BREAKER_MODULE_LABELS, type CircuitBreakerModule } from '@/types/circuitBreaker';

export interface PausedActionButtonProps {
  /** Protocol module this action belongs to. */
  module: CircuitBreakerModule;
  /** The CTA to render. Exactly one element — it is cloned when paused. */
  children: ReactElement;
  /** Label shown while paused. Defaults to `"<Module> Paused"`. */
  pausedLabel?: string;
  /** Popover placement relative to the CTA. */
  position?: 'top' | 'bottom';
  /** Layout classes for the carrier. Replaces the `relative block w-full` default. */
  className?: string;
}

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
} as const;

const ARROW_CLASSES = {
  top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-rose-800',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-rose-800',
} as const;

export function PausedActionButton({
  module,
  children,
  pausedLabel,
  position = 'top',
  className = '',
}: PausedActionButtonProps) {
  const pause = useModulePause(module);
  const mounted = useMounted();
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  if (pause === undefined) return children;

  // Wall-clock reads must not run during SSR, otherwise the tooltip copy would
  // disagree with the markup the server produced.
  const now = mounted ? Date.now() : null;
  const tooltip = now === null ? '' : buildPauseTooltip(pause, now);
  const label = pausedLabel ?? `${CIRCUIT_BREAKER_MODULE_LABELS[module]} Paused`;

  const lockedChild = React.cloneElement(children, {
    disabled: true,
    'aria-disabled': true,
    'aria-describedby': tooltipId,
    'data-circuit-breaker-paused': module,
  });

  return (
    <span
      className={`relative ${className || 'block w-full'}`}
      tabIndex={0}
      title={tooltip || undefined}
      aria-describedby={tooltipId}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {lockedChild}

      {isOpen && now !== null && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-72 max-w-[80vw] rounded-xl border border-rose-800/80 bg-slate-900 p-3 text-left text-xs leading-relaxed text-slate-100 shadow-2xl ${POSITION_CLASSES[position]}`}
        >
          <span className="flex items-center gap-1.5 font-semibold text-rose-300">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </span>
          <span className="mt-1.5 block text-slate-300">{pause.reason}</span>
          <span className="mt-2 block border-t border-slate-800 pt-2 font-mono text-[11px] text-slate-400">
            Review ~{formatDurationMinutes(pause.reviewMinutes)} · recovery{' '}
            {formatRecoveryCountdown(pause.estimatedRecoveryAt, now)} (
            {formatRecoveryClock(pause.estimatedRecoveryAt)} UTC)
          </span>
          <span
            className={`absolute h-0 w-0 border-4 border-x-transparent ${ARROW_CLASSES[position]}`}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}

export default PausedActionButton;
