import React from 'react';
import {
  RELAYER_STATUS_BADGE_VARIANTS,
  RELAYER_STATUS_DOT_VARIANTS,
} from '@/lib/classNameVariants';

export interface Relayer {
  id: string;
  name: string;
  status: 'Online' | 'Offline' | 'Syncing';
  latency: number; // in ms
}

export interface RelayerStatusTableProps {
  relayers?: Relayer[];
}

// ---------------------------------------------------------------------------
// StatusBadge — memoised with a custom comparator so it only re-renders when
// the `status` field itself changes (not on every parent render cycle).
// ---------------------------------------------------------------------------
const StatusBadge = React.memo(
  function StatusBadge({ status }: { status: Relayer['status'] }) {
    const isOnline = status === 'Online';
    
    return (
      <span
        style={{ contain: 'layout' }}
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${RELAYER_STATUS_BADGE_VARIANTS[status]}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${RELAYER_STATUS_DOT_VARIANTS[status]} ${isOnline ? 'animate-status-pulse gpu-layer' : ''}`}
        />
        {status}
      </span>
    );
  },
  (prev, next) => prev.status === next.status,
);

StatusBadge.displayName = 'StatusBadge';

// ---------------------------------------------------------------------------
// RelayerRow — memoised per-row so a single relayer metric update only causes
// that row to re-render, shielding the rest of the list from evaluation ticks.
// ---------------------------------------------------------------------------
const RelayerRow = React.memo(
  function RelayerRow({ relayer }: { relayer: Relayer }) {
    return (
      <tr className="transition-colors hover:bg-white/[0.02]">
        <td className="p-4 font-medium text-white">{relayer.name}</td>
        <td className="p-4">
          <StatusBadge status={relayer.status} />
        </td>
        <td className="p-4 text-right font-mono text-white/70">
          {relayer.latency} ms
        </td>
      </tr>
    );
  },
  (prev: { relayer: Relayer }, next: { relayer: Relayer }) =>
    prev.relayer.id === next.relayer.id &&
    prev.relayer.status === next.relayer.status &&
    prev.relayer.latency === next.relayer.latency &&
    prev.relayer.name === next.relayer.name,
);

RelayerRow.displayName = 'RelayerRow';

// ---------------------------------------------------------------------------
// RelayerStatusTable — memoised at the container level so a parent re-render
// (e.g. triggered by an unrelated socket tick) is short-circuited here unless
// the `relayers` array reference changes.
// ---------------------------------------------------------------------------
function RelayerStatusTable({ relayers = [] }: RelayerStatusTableProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#141414]">
      <table className="w-full table-fixed text-left text-sm text-white/80">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-white/50">
            <th className="w-1/3 p-4 font-medium">Relayer Name</th>
            <th className="w-1/3 p-4 font-medium">Status</th>
            <th className="w-1/3 p-4 font-medium text-right">Latency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {relayers.map((relayer) => (
            <RelayerRow key={relayer.id} relayer={relayer} />
          ))}
          {relayers.length === 0 && (
            <tr>
              <td colSpan={3} className="p-8 text-center text-white/40">
                No relayers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(RelayerStatusTable);
