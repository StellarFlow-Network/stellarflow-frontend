"use client";

import React from "react";
import { Shimmer } from "./Shimmer";

interface SkeletonTableProps {
  /**
   * Number of skeleton rows to render
   */
  rows?: number;
  /**
   * Variant of the table skeleton
   * - pool: Matches PoolTable layout (4 columns: pair, tvl, volume, apy)
   * - transaction: Matches TransactionHistoryTable layout (6 columns)
   * - corridor: Matches CorridorSpreadTable layout
   * - relayer: Matches RelayerStatusTable layout
   */
  variant?: "pool" | "transaction" | "corridor" | "relayer";
  /**
   * Show search bar in header
   */
  showSearch?: boolean;
  /**
   * Custom className for wrapper
   */
  className?: string;
}

/**
 * SkeletonTable - Animated loading skeleton for table components
 * 
 * Matches exact dimensions and column structure of PoolTable, TransactionHistoryTable,
 * and other table components to eliminate layout shift during loading.
 * Uses 48px row height matching the original PoolTable ROW_HEIGHT constant.
 * 
 * @example
 * ```tsx
 * // Replace PoolTable during loading
 * {isLoading ? (
 *   <SkeletonTable variant="pool" rows={8} showSearch />
 * ) : (
 *   <PoolTable pools={pools} />
 * )}
 * ```
 */
export const SkeletonTable = React.memo(function SkeletonTable({
  rows = 8,
  variant = "pool",
  showSearch = true,
  className = "",
}: SkeletonTableProps) {
  switch (variant) {
    case "pool":
      return <PoolTableSkeleton rows={rows} showSearch={showSearch} className={className} />;
    case "transaction":
      return <TransactionTableSkeleton rows={rows} className={className} />;
    case "corridor":
      return <CorridorTableSkeleton rows={rows} className={className} />;
    case "relayer":
      return <RelayerTableSkeleton rows={rows} className={className} />;
    default:
      return <PoolTableSkeleton rows={rows} showSearch={showSearch} className={className} />;
  }
});

/**
 * PoolTableSkeleton - Matches PoolTable layout exactly
 * Container: bg-neutral-900 border border-neutral-800 rounded-xl p-5
 * Columns: Asset Pair | TVL | 24h Volume | APY
 * Row height: 48px (matching ROW_HEIGHT constant)
 */
function PoolTableSkeleton({
  rows,
  showSearch,
  className,
}: {
  rows: number;
  showSearch: boolean;
  className: string;
}) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header - matches PoolTable header with title and search */}
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-6 w-48 rounded-md" />
        {showSearch && (
          <div className="w-64">
            <Shimmer className="h-10 w-full rounded-lg" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-left border-collapse">
          {/* Table Header - sticky top-0 z-10 bg-neutral-900 */}
          <thead className="sticky top-0 z-10 bg-neutral-900">
            <tr className="border-b border-neutral-800">
              <th className="py-3 px-4">
                <Shimmer className="h-3 w-24 rounded-md" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-16 rounded-md ml-auto" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-20 rounded-md ml-auto" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-12 rounded-md ml-auto" />
              </th>
            </tr>
          </thead>

          {/* Table Body - matching 48px row height */}
          <tbody className="divide-y divide-neutral-800/50">
            {Array.from({ length: rows }).map((_, index) => (
              <tr
                key={`pool-row-skeleton-${index}`}
                className="border-b border-neutral-800/50 hover:bg-neutral-800/30"
                style={{ height: "48px" }}
              >
                {/* Asset Pair */}
                <td className="px-4 py-3">
                  <Shimmer className="h-4 w-24 rounded-md" />
                </td>
                {/* TVL */}
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-20 rounded-md ml-auto" />
                </td>
                {/* 24h Volume */}
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-20 rounded-md ml-auto" />
                </td>
                {/* APY */}
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-16 rounded-md ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="mt-3">
        <Shimmer className="h-3 w-32 rounded-md" />
      </div>
    </div>
  );
}

/**
 * TransactionTableSkeleton - Matches TransactionHistoryTable layout
 * Columns: Date | Type | Sent | Received | Fee | TxHash
 */
function TransactionTableSkeleton({ rows, className }: { rows: number; className: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161b22] shadow-sm ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header with title and filters */}
      <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-gray-800 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-5 w-40 rounded" />
          <Shimmer className="h-4 w-72 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Shimmer className="h-9 w-28 rounded-md" />
          <Shimmer className="h-9 w-28 rounded-md" />
          <Shimmer className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Table Header - 6 columns grid */}
      <div className="grid grid-cols-[110px_100px_1fr_1fr_90px_1fr] border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0d1117]">
        <div className="px-6 py-3">
          <Shimmer className="h-3 w-12 rounded" />
        </div>
        <div className="px-6 py-3">
          <Shimmer className="h-3 w-10 rounded" />
        </div>
        <div className="px-6 py-3">
          <Shimmer className="h-3 w-12 rounded" />
        </div>
        <div className="px-6 py-3">
          <Shimmer className="h-3 w-16 rounded" />
        </div>
        <div className="px-6 py-3">
          <Shimmer className="h-3 w-8 rounded" />
        </div>
        <div className="px-6 py-3 text-right">
          <Shimmer className="h-3 w-14 rounded ml-auto" />
        </div>
      </div>

      {/* Table Body - matching row structure */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`tx-skeleton-${index}`}
            className="grid grid-cols-[110px_100px_1fr_1fr_90px_1fr] items-center px-0 py-4"
          >
            <div className="px-6">
              <Shimmer className="h-4 w-20 rounded" />
            </div>
            <div className="px-6">
              <Shimmer className="h-4 w-14 rounded" />
            </div>
            <div className="px-6">
              <Shimmer className="h-4 w-24 rounded" />
            </div>
            <div className="px-6">
              <Shimmer className="h-4 w-24 rounded" />
            </div>
            <div className="px-6">
              <Shimmer className="h-4 w-12 rounded" />
            </div>
            <div className="px-6 flex justify-end">
              <Shimmer className="h-4 w-28 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CorridorTableSkeleton - Matches CorridorSpreadTable layout
 * Columns: Corridor | Provider | Spread | Volume | Liquidity
 */
function CorridorTableSkeleton({ rows, className }: { rows: number; className: string }) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-6 w-44 rounded-md" />
        <Shimmer className="h-8 w-24 rounded-full" />
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-900">
            <tr className="border-b border-neutral-800">
              <th className="py-3 px-4">
                <Shimmer className="h-3 w-20 rounded-md" />
              </th>
              <th className="py-3 px-4">
                <Shimmer className="h-3 w-16 rounded-md" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-14 rounded-md ml-auto" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-16 rounded-md ml-auto" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-18 rounded-md ml-auto" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {Array.from({ length: rows }).map((_, index) => (
              <tr
                key={`corridor-row-skeleton-${index}`}
                className="border-b border-neutral-800/50"
                style={{ height: "48px" }}
              >
                <td className="px-4 py-3">
                  <Shimmer className="h-4 w-28 rounded-md" />
                </td>
                <td className="px-4 py-3">
                  <Shimmer className="h-4 w-20 rounded-md" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-16 rounded-md ml-auto" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-20 rounded-md ml-auto" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-20 rounded-md ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * RelayerTableSkeleton - Matches RelayerStatusTable layout
 * Columns: Relayer | Status | Uptime | Requests | Latency
 */
function RelayerTableSkeleton({ rows, className }: { rows: number; className: string }) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header */}
      <div className="mb-4">
        <Shimmer className="h-6 w-36 rounded-md" />
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-900">
            <tr className="border-b border-neutral-800">
              <th className="py-3 px-4">
                <Shimmer className="h-3 w-16 rounded-md" />
              </th>
              <th className="py-3 px-4">
                <Shimmer className="h-3 w-14 rounded-md" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-14 rounded-md ml-auto" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-16 rounded-md ml-auto" />
              </th>
              <th className="py-3 px-4 text-right">
                <Shimmer className="h-3 w-14 rounded-md ml-auto" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {Array.from({ length: rows }).map((_, index) => (
              <tr
                key={`relayer-row-skeleton-${index}`}
                className="border-b border-neutral-800/50"
                style={{ height: "48px" }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shimmer className="w-6 h-6 rounded-full" />
                    <Shimmer className="h-4 w-24 rounded-md" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Shimmer className="h-6 w-16 rounded-full" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-12 rounded-md ml-auto" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-16 rounded-md ml-auto" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Shimmer className="h-4 w-14 rounded-md ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
