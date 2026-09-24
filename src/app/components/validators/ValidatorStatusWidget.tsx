import React from 'react';
import type { ValidatorStatus } from '@/types/validators';

interface ValidatorStatusWidgetProps {
  status: ValidatorStatus;
}

const STATUS_VARIANTS: Record<ValidatorStatus, string> = {
  active: 'bg-emerald-950/80 text-emerald-400 border border-emerald-800',
  jailed: 'bg-amber-950/80 text-amber-400 border border-amber-800',
  offline: 'bg-neutral-950 text-neutral-500 border border-neutral-800',
};

/**
 * Status badge for validator audit rows. Active nodes render a pulsing dot
 * inside a paint-contained widget shell.
 */
export const ValidatorStatusWidget = React.memo(function ValidatorStatusWidget({
  status,
}: ValidatorStatusWidgetProps) {
  const isActive = status === 'active';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs uppercase tracking-wider font-sans font-bold dashboard-status-widget ${STATUS_VARIANTS[status]}`}
    >
      {isActive && (
        <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center validator-heartbeat-cell">
          <span className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 animate-status-pulse gpu-layer" />
        </span>
      )}
      {status}
    </span>
  );
});

ValidatorStatusWidget.displayName = 'ValidatorStatusWidget';
