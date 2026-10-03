'use client';

import { useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from '@tanstack/react-table';
import { columns } from './columns';
import type { ProposalVote } from '@/types/voting';

interface ProposalVotingGridProps {
  data: ProposalVote[];
  proposalId: string;
}

type ProposalVotingGridState = {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  pagination: PaginationState;
};

type StateUpdater<T> = T | ((previous: T) => T);

function resolveStateUpdate<T>(updater: StateUpdater<T>, previous: T): T {
  return typeof updater === 'function'
    ? (updater as (previous: T) => T)(previous)
    : updater;
}

/**
 * Heavy, interactive proposal voting history grid.
 * This component is client-side only and deferred from initial hydration.
 */
export function ProposalVotingGrid({ data, proposalId }: ProposalVotingGridProps) {
  const [tableState, setTableState] = useState<ProposalVotingGridState>({
    sorting: [],
    columnFilters: [],
    globalFilter: '',
    pagination: {
      pageIndex: 0,
      pageSize: 10,
    },
  });

  const updateTableState = useCallback(
    <K extends keyof ProposalVotingGridState>(
      key: K,
      updater: StateUpdater<ProposalVotingGridState[K]>
    ) => {
      setTableState((previous) => {
        const nextValue = resolveStateUpdate(updater, previous[key]);

        if (Object.is(nextValue, previous[key])) {
          return previous;
        }

        return {
          ...previous,
          [key]: nextValue,
        };
      });
    },
    []
  );

  const handleSortingChange = useCallback(
    (updater: StateUpdater<SortingState>) => updateTableState('sorting', updater),
    [updateTableState]
  );

  const handlePaginationChange = useCallback(
    (updater: StateUpdater<PaginationState>) => updateTableState('pagination', updater),
    [updateTableState]
  );

  const handleColumnFiltersChange = useCallback((updater: StateUpdater<ColumnFiltersState>) => {
    setTableState((previous) => {
      const nextColumnFilters = resolveStateUpdate(updater, previous.columnFilters);
      const nextPagination =
        previous.pagination.pageIndex === 0
          ? previous.pagination
          : { ...previous.pagination, pageIndex: 0 };

      if (
        Object.is(nextColumnFilters, previous.columnFilters) &&
        Object.is(nextPagination, previous.pagination)
      ) {
        return previous;
      }

      return {
        ...previous,
        columnFilters: nextColumnFilters,
        pagination: nextPagination,
      };
    });
  }, []);

  const handleGlobalFilterInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextGlobalFilter = event.target.value;

      setTableState((previous) => {
        const nextPagination =
          previous.pagination.pageIndex === 0
            ? previous.pagination
            : { ...previous.pagination, pageIndex: 0 };

        if (
          previous.globalFilter === nextGlobalFilter &&
          Object.is(nextPagination, previous.pagination)
        ) {
          return previous;
        }

        return {
          ...previous,
          globalFilter: nextGlobalFilter,
          pagination: nextPagination,
        };
      });
    },
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: tableState,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: handlePaginationChange,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
  });

  const exportToCSV = useCallback(() => {
    const headers = columns.map((col) => col.header as string).join(',');
    const rows = data
      .map((vote) =>
        [
          vote.voter,
          vote.voteType,
          vote.votingPower,
          vote.timestamp,
          vote.transactionHash,
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${proposalId}-votes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, proposalId]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search voters, hashes..."
          value={tableState.globalFilter}
          onChange={handleGlobalFilterInputChange}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 sm:w-72"
        />
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span className="ml-1">
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? ''}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
