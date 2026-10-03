import React from 'react';
import { Shimmer } from './Shimmer';
import {
  VALIDATOR_TABLE_HEADER_HEIGHT_PX,
  VALIDATOR_TABLE_ROW_COUNT,
  VALIDATOR_TABLE_ROW_HEIGHT_PX,
} from '@/types/validators';

interface ValidatorListSkeletonProps {
  rowCount?: number;
}

const COLUMN_WIDTHS = [
  'w-[18%]',
  'w-[16%]',
  'w-[13%]',
  'w-[14%]',
  'w-[13%]',
  'w-[14%]',
  'w-[12%]',
] as const;

/**
 * Pixel-matched table skeleton for the validator audit matrix. Uses table-fixed
 * column widths and rigid row heights so the tbody footprint is identical to
 * the hydrated table.
 */
export const ValidatorListSkeleton = React.memo(function ValidatorListSkeleton({
  rowCount = VALIDATOR_TABLE_ROW_COUNT,
}: ValidatorListSkeletonProps) {
  const tableMinHeight =
    VALIDATOR_TABLE_HEADER_HEIGHT_PX + rowCount * VALIDATOR_TABLE_ROW_HEIGHT_PX;

  return (
    <div
      className="overflow-x-auto"
      style={{ contain: 'layout paint', minHeight: tableMinHeight }}
      aria-busy="true"
      aria-label="Loading validator list"
    >
      <table className="w-full table-fixed text-left border-collapse">
        <thead>
          <tr
            className="border-b border-neutral-800 text-xs text-neutral-400 uppercase font-mono tracking-wider"
            style={{ height: VALIDATOR_TABLE_HEADER_HEIGHT_PX }}
          >
            <th className={`py-3 px-4 ${COLUMN_WIDTHS[0]}`}>Validator Identity</th>
            <th className={`py-3 px-4 ${COLUMN_WIDTHS[1]}`}>Stellar Account Handle</th>
            <th className={`py-3 px-4 text-right ${COLUMN_WIDTHS[2]}`}>Heartbeat Uptime</th>
            <th className={`py-3 px-4 text-right ${COLUMN_WIDTHS[3]}`}>Missed Checkpoints</th>
            <th className={`py-3 px-4 text-right ${COLUMN_WIDTHS[4]}`}>Slashing History</th>
            <th className={`py-3 px-4 text-right ${COLUMN_WIDTHS[5]}`}>Active Security Bond</th>
            <th className={`py-3 px-4 text-center ${COLUMN_WIDTHS[6]}`}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/50 text-sm font-mono">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              style={{ contain: 'layout paint', height: VALIDATOR_TABLE_ROW_HEIGHT_PX }}
            >
              <td className="py-4 px-4">
                <Shimmer className="h-5 w-36 max-w-full rounded-md" />
              </td>
              <td className="py-4 px-4">
                <Shimmer className="h-3.5 w-20 max-w-full rounded-md" />
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex justify-end">
                  <Shimmer className="h-5 w-16 rounded-md" />
                </div>
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex justify-end">
                  <Shimmer className="h-5 w-8 rounded-md" />
                </div>
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex justify-end">
                  <Shimmer className="h-5 w-6 rounded-md" />
                </div>
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex justify-end">
                  <Shimmer className="h-5 w-24 rounded-md" />
                </div>
              </td>
              <td className="py-4 px-4 text-center">
                <div className="flex justify-center">
                  <Shimmer className="h-6 w-16 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
