import React, { useMemo } from 'react';
import { shortenAddress } from '@/utils/addressUtils';
import { RELAYERS_PAGE_STATUS_VARIANTS } from '@/lib/classNameVariants';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';

export interface RelayerManagementRecord {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'lagging' | 'offline';
  uptime: string;
  latency: number;
  successRate: number;
}

const StatusBadge = React.memo(
  function StatusBadge({ status }: { status: RelayerManagementRecord['status'] }) {
    return (
      <span
        style={{ contain: 'layout', willChange: 'opacity, transform' }}
        className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter ${RELAYERS_PAGE_STATUS_VARIANTS[status]}`}
      >
        ● {status}
      </span>
    );
  },
  (prev, next) => prev.status === next.status,
);

StatusBadge.displayName = 'RelayerManagementStatusBadge';

function relayerRowPropsAreEqual(
  prev: { relayer: RelayerManagementRecord },
  next: { relayer: RelayerManagementRecord },
): boolean {
  const a = prev.relayer;
  const b = next.relayer;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.address === b.address &&
    a.status === b.status &&
    a.uptime === b.uptime &&
    a.latency === b.latency &&
    a.successRate === b.successRate
  );
}

export const RelayerManagementRow = React.memo(
  function RelayerManagementRow({ relayer }: { relayer: RelayerManagementRecord }) {
    const shortenedAddress = useMemo(
      () => shortenAddress(relayer.address),
      [relayer.address],
    );

    return (
      <tr className="hover:bg-[#1c2128] transition-colors group">
        <td className="px-6 py-4">
          <div className="font-medium text-blue-400">{relayer.name}</div>
          <div className="text-xs text-gray-500 font-mono">{shortenedAddress}</div>
        </td>
        <td className="px-6 py-4 node-status-cell">
          <StatusBadge status={relayer.status} />
        </td>
        <td className="px-6 py-4 text-sm node-status-cell numeric-value">{relayer.uptime}</td>
        <td className="px-6 py-4 text-sm font-mono node-status-cell numeric-value">
          {relayer.latency}ms
        </td>
        <td className="px-6 py-4 metric-indicator">
          <div className="w-24 bg-gray-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full dynamic-scale-x"
              style={{
                width: '100%',
                transform: `scaleX(${relayer.successRate / 100})`,
                transformOrigin: 'left',
                willChange: 'transform',
              }}
            />
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block numeric-value">
            {relayer.successRate}% confirmed
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          <button className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400">
            <Icon id={ICON_IDS.moreVertical} size={18} />
          </button>
        </td>
      </tr>
    );
  },
  relayerRowPropsAreEqual,
);

RelayerManagementRow.displayName = 'RelayerManagementRow';
