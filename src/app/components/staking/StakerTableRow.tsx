import React, { useMemo } from 'react';
import { shortenAddress } from '@/utils/addressUtils';
import {
  getHealthBarColor,
  STAKER_SLASHING_NO_EVENTS,
  STAKER_SLASHING_WITH_EVENTS,
} from '@/lib/classNameVariants';
import { Icon, ICON_IDS } from '@/components/icons';

export interface StakerTableRecord {
  id: string;
  nodeName: string;
  operatorAddress: string;
  stakedAmountXLM: number;
  accruedRewardsXLM: number;
  totalSlashingEvents: number;
  healthFactor: number;
}

function stakerRowPropsAreEqual(
  prev: { node: StakerTableRecord },
  next: { node: StakerTableRecord },
): boolean {
  const a = prev.node;
  const b = next.node;
  return (
    a.id === b.id &&
    a.nodeName === b.nodeName &&
    a.operatorAddress === b.operatorAddress &&
    a.stakedAmountXLM === b.stakedAmountXLM &&
    a.accruedRewardsXLM === b.accruedRewardsXLM &&
    a.totalSlashingEvents === b.totalSlashingEvents &&
    a.healthFactor === b.healthFactor
  );
}

export const StakerTableRow = React.memo(
  function StakerTableRow({ node }: { node: StakerTableRecord }) {
    const shortenedAddress = useMemo(
      () => shortenAddress(node.operatorAddress),
      [node.operatorAddress],
    );
    const stakedLabel = useMemo(
      () => `${node.stakedAmountXLM.toLocaleString()} XLM`,
      [node.stakedAmountXLM],
    );
    const rewardsLabel = useMemo(
      () => `+${node.accruedRewardsXLM.toLocaleString()} XLM`,
      [node.accruedRewardsXLM],
    );
    const healthBarColor = useMemo(
      () => getHealthBarColor(node.healthFactor),
      [node.healthFactor],
    );
    const slashingBadgeClass =
      node.totalSlashingEvents === 0 ? STAKER_SLASHING_NO_EVENTS : STAKER_SLASHING_WITH_EVENTS;

    return (
      <tr className="hover:bg-[#1c2128] transition-colors group">
        <td className="px-6 py-4">
          <div className="font-medium text-gray-200">{node.nodeName}</div>
          <div className="text-xs text-gray-500 font-mono">{shortenedAddress}</div>
        </td>
        <td className="px-6 py-4 text-sm font-mono text-gray-300">{stakedLabel}</td>
        <td className="px-6 py-4 text-sm font-mono text-emerald-400">{rewardsLabel}</td>
        <td className="px-6 py-4 node-status-cell">
          <div className="flex items-center gap-2 metric-indicator">
            <div className="w-16 bg-gray-700 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full dynamic-scale-x ${healthBarColor}`}
                style={{ '--scale-x': node.healthFactor / 100 } as React.CSSProperties}
              />
            </div>
            <span className="text-xs font-semibold numeric-value">{node.healthFactor}%</span>
          </div>
        </td>
        <td className="px-6 py-4 node-status-cell">
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono font-bold high-frequency-badge ${slashingBadgeClass}`}
          >
            {node.totalSlashingEvents} slash events
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          <button className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs font-medium">
            <span>Manage Node</span>
            <Icon id={ICON_IDS.arrowUpRight} size={12} />
          </button>
        </td>
      </tr>
    );
  },
  stakerRowPropsAreEqual,
);

StakerTableRow.displayName = 'StakerTableRow';
