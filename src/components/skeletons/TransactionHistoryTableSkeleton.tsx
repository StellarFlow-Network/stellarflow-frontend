import React from "react";

export function TransactionHistoryTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-gray-800 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800 mb-1" />
          <div className="h-4 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-28 animate-pulse rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-[#0d1117]" />
          <div className="h-9 w-28 animate-pulse rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-[#0d1117]" />
          <div className="h-9 w-24 animate-pulse rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-[#161b22]" />
        </div>
      </div>

      <div className="grid grid-cols-[110px_100px_1fr_1fr_90px_1fr] border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0d1117] text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
        <div className="px-6 py-3 font-medium">Date</div>
        <div className="px-6 py-3 font-medium">Type</div>
        <div className="px-6 py-3 font-medium">Sent</div>
        <div className="px-6 py-3 font-medium">Received</div>
        <div className="px-6 py-3 font-medium">Fee</div>
        <div className="px-6 py-3 text-right font-medium">TxHash</div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`tx-skeleton-${index}`}
            className="grid grid-cols-[110px_100px_1fr_1fr_90px_1fr] items-center px-0 py-4 font-mono text-[13px]"
          >
            <div className="px-6">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="px-6">
              <div className="h-4 w-14 animate-pulse rounded bg-gray-200 dark:bg-gray-800 capitalize" />
            </div>
            <div className="px-6">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="px-6">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="px-6">
              <div className="h-4 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="px-6 flex justify-end">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
