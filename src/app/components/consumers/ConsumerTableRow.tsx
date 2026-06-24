import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

export interface ConsumerTableRecord {
  id: string;
  projectName: string;
  contractAddress: string;
  shortenedAddress: string;
  tier: 'Enterprise' | 'Developer' | 'Staging';
  status: 'active' | 'expired' | 'paused';
  monthlyRequests: string;
  balanceXLM: number;
}

const CONSUMER_TIER_BADGE_CLASS =
  'px-3 py-1.5 rounded-full text-xs font-medium inline-block';

const CONSUMER_TIER_VARIANTS: Record<ConsumerTableRecord['tier'], string> = {
  Enterprise: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  Developer: 'bg-purple-900/40 text-purple-300 border border-purple-700/50',
  Staging: 'bg-gray-700/40 text-gray-300 border border-gray-600/50',
};

const CONSUMER_STATUS_TEXT_VARIANTS: Record<ConsumerTableRecord['status'], string> = {
  active: 'text-green-400',
  expired: 'text-red-400',
  paused: 'text-yellow-400',
};

const CONSUMER_STATUS_DOT_VARIANTS: Record<ConsumerTableRecord['status'], string> = {
  active: 'bg-green-500',
  expired: 'bg-red-500',
  paused: 'bg-yellow-500',
};

function getBalanceColorClass(balance: number): string {
  if (balance >= 500) return 'text-green-400';
  if (balance >= 200) return 'text-yellow-400';
  return 'text-red-400';
}

function consumerRowPropsAreEqual(
  prev: { consumer: ConsumerTableRecord },
  next: { consumer: ConsumerTableRecord },
): boolean {
  const a = prev.consumer;
  const b = next.consumer;
  return (
    a.id === b.id &&
    a.projectName === b.projectName &&
    a.contractAddress === b.contractAddress &&
    a.shortenedAddress === b.shortenedAddress &&
    a.tier === b.tier &&
    a.status === b.status &&
    a.monthlyRequests === b.monthlyRequests &&
    a.balanceXLM === b.balanceXLM
  );
}

export const ConsumerTableRow = React.memo(
  function ConsumerTableRow({ consumer }: { consumer: ConsumerTableRecord }) {
    const balanceLabel = useMemo(
      () => `${consumer.balanceXLM.toFixed(2)} XLM`,
      [consumer.balanceXLM],
    );
    const balanceColorClass = useMemo(
      () => getBalanceColorClass(consumer.balanceXLM),
      [consumer.balanceXLM],
    );
    const showLowRefillAlert = consumer.balanceXLM < 200;

    return (
      <tr className="hover:bg-[#1c2128] transition-colors group">
        <td className="px-6 py-4">
          <div className="font-medium text-gray-200">{consumer.projectName}</div>
          <div className="text-xs text-gray-500 font-mono">{consumer.shortenedAddress}</div>
        </td>
        <td className="px-6 py-4">
          <span className={`${CONSUMER_TIER_BADGE_CLASS} ${CONSUMER_TIER_VARIANTS[consumer.tier]}`}>
            {consumer.tier}
          </span>
        </td>
        <td className="px-6 py-4">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium ${CONSUMER_STATUS_TEXT_VARIANTS[consumer.status]}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${CONSUMER_STATUS_DOT_VARIANTS[consumer.status]}`}
            />
            <span className="capitalize">{consumer.status}</span>
          </span>
        </td>
        <td className="px-6 py-4 text-sm font-mono text-gray-300">{consumer.monthlyRequests}</td>
        <td className="px-6 py-4">
          <div className={`text-sm font-mono ${balanceColorClass}`}>{balanceLabel}</div>
          {showLowRefillAlert && (
            <span className="text-[10px] text-yellow-600 block leading-none mt-0.5">
              Low Refill Alert
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          <button className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs">
            <span>View Contract</span>
            <ExternalLink size={12} />
          </button>
        </td>
      </tr>
    );
  },
  consumerRowPropsAreEqual,
);

ConsumerTableRow.displayName = 'ConsumerTableRow';
