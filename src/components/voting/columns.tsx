import { createColumnHelper } from '@tanstack/react-table';
import type { ProposalVote } from '@/types/voting';

const columnHelper = createColumnHelper<ProposalVote>();

/**
 * Hydration-safe date cell renderer.
 * Formats date using toLocaleDateString() which is locale-dependent.
 * Since this component is only rendered client-side via ssr: false,
 * locale formatting is safe and consistent.
 */
function DateCell({ timestamp }: { timestamp: string }) {
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return timestamp;
  }
}

/**
 * Hydration-safe voting power renderer.
 * Uses toLocaleString() for number formatting which is locale-dependent.
 * Safe on client-side only component.
 */
function VotingPowerCell({ power }: { power: number }) {
  return power.toLocaleString();
}

export const columns = [
  columnHelper.accessor('voter', {
    header: 'Voter',
    cell: (info) => (
      <span className="font-mono text-xs">{info.getValue().slice(0, 12)}...{info.getValue().slice(-4)}</span>
    ),
  }),
  columnHelper.accessor('voteType', {
    header: 'Vote',
    cell: (info) => {
      const value = info.getValue();
      const color =
        value === 'For'
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : value === 'Against'
          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
          {value}
        </span>
      );
    },
  }),
  columnHelper.accessor('votingPower', {
    header: 'Voting Power',
    cell: (info) => <VotingPowerCell power={info.getValue()} />,
  }),
  columnHelper.accessor('timestamp', {
    header: 'Date',
    cell: (info) => <DateCell timestamp={info.getValue()} />,
  }),
  columnHelper.accessor('transactionHash', {
    header: 'Tx Hash',
    cell: (info) => (
      <a
        href={`https://stellar.expert/explorer/public/tx/${info.getValue()}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400"
      >
        {info.getValue().slice(0, 8)}...
      </a>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {info.getValue()}
      </span>
    ),
  }),
];