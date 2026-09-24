import React from 'react';
import type { ValidatorStatus } from '@/types/validators';

interface ValidatorHeartbeatCellProps {
  uptime: number;
  status: ValidatorStatus;
}

function uptimeColorClass(uptime: number): string {
  if (uptime > 95) return 'text-emerald-400';
  if (uptime > 80) return 'text-amber-500';
  return 'text-red-500';
}

/**
 * Heartbeat uptime cell with layout/paint containment so active-node pulse
 * animations do not trigger document-wide style reviews.
 */
export const ValidatorHeartbeatCell = React.memo(function ValidatorHeartbeatCell({
  uptime,
  status,
}: ValidatorHeartbeatCellProps) {
  const isActive = status === 'active';

  return (
    <td className="py-4 px-4 text-right validator-heartbeat-cell">
      <div className="flex items-center justify-end gap-2">
        {isActive && (
          <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
            <span className="absolute h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse gpu-layer opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400 gpu-layer" />
          </span>
        )}
        <span className={`font-bold numeric-value ${uptimeColorClass(uptime)}`}>
          {uptime.toFixed(2)}%
        </span>
      </div>
    </td>
  );
});

ValidatorHeartbeatCell.displayName = 'ValidatorHeartbeatCell';
