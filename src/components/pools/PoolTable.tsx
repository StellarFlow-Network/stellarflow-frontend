"use client";

import React, { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/app/hooks/useDebounce";
import { Search } from "lucide-react";

export interface Pool {
  id: string;
  pair: string;
  tvl: number;
  volume24h: number;
  apy: number;
}

const MOCK_POOLS: Pool[] = [
  { id: "pool-1", pair: "USD / NGN", tvl: 4250000, volume24h: 1850000, apy: 12.4 },
  { id: "pool-2", pair: "XLM / KES", tvl: 1850000, volume24h: 920000, apy: 8.7 },
  { id: "pool-3", pair: "NGN / GHS", tvl: 920000, volume24h: 340000, apy: 5.2 },
  { id: "pool-4", pair: "USD / BRL", tvl: 3100000, volume24h: 1420000, apy: 15.1 },
  { id: "pool-5", pair: "EUR / XLM", tvl: 2750000, volume24h: 880000, apy: 9.3 },
  { id: "pool-6", pair: "GBP / NGN", tvl: 1650000, volume24h: 520000, apy: 7.8 },
  { id: "pool-7", pair: "USD / GHS", tvl: 890000, volume24h: 210000, apy: 6.1 },
  { id: "pool-8", pair: "XLM / NGN", tvl: 5400000, volume24h: 2300000, apy: 18.5 },
  { id: "pool-9", pair: "KES / GHS", tvl: 320000, volume24h: 95000, apy: 4.3 },
  { id: "pool-10", pair: "USD / XLM", tvl: 7800000, volume24h: 3100000, apy: 22.0 },
  { id: "pool-11", pair: "NGN / BRL", tvl: 1100000, volume24h: 420000, apy: 10.2 },
  { id: "pool-12", pair: "EUR / NGN", tvl: 2200000, volume24h: 760000, apy: 11.6 },
  { id: "pool-13", pair: "USD / KES", tvl: 1950000, volume24h: 680000, apy: 8.1 },
  { id: "pool-14", pair: "GBP / XLM", tvl: 670000, volume24h: 180000, apy: 3.9 },
  { id: "pool-15", pair: "BRL / GHS", tvl: 440000, volume24h: 120000, apy: 5.8 },
];

const ROW_HEIGHT = 48;

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatApy(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === null) {
    return <span className="text-neutral-600 ml-1">↕</span>;
  }
  return (
    <span className="text-lime-400 ml-1">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

const PoolRow = React.memo(
  function PoolRow({ pool }: { pool: Pool }) {
    return (
      <tr className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
        <td className="px-4 py-3 font-bold text-neutral-200 font-mono text-sm">
          {pool.pair}
        </td>
        <td className="px-4 py-3 text-right font-mono text-neutral-300 text-sm">
          {formatNumber(pool.tvl)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-neutral-300 text-sm">
          {formatNumber(pool.volume24h)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-lime-400 text-sm font-bold">
          {formatApy(pool.apy)}
        </td>
      </tr>
    );
  },
  (prev, next) => prev.pool.id === next.pool.id && prev.pool.tvl === next.pool.tvl && prev.pool.volume24h === next.pool.volume24h && prev.pool.apy === next.pool.apy,
);

PoolRow.displayName = "PoolRow";

export default function PoolTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Pool;
    direction: "asc" | "desc";
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredPools = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_POOLS;
    return MOCK_POOLS.filter((pool) =>
      pool.pair.toLowerCase().includes(q),
    );
  }, [debouncedSearch]);

  const sortedPools = useMemo(() => {
    if (!sortConfig) return filteredPools;
    const { key, direction } = sortConfig;
    return [...filteredPools].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredPools, sortConfig]);

  const handleSort = (key: keyof Pool) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return null;
      }
      return { key, direction: "asc" };
    });
  };

  const rowVirtualizer = useVirtualizer({
    count: sortedPools.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalHeight - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-200">
          Active Liquidity Pools
        </h2>
        <div className="relative w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            size={16}
          />
          <input
            type="text"
            placeholder="Filter by asset ticker…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg py-2 pl-9 pr-4 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-lime-500 transition-colors"
            aria-label="Filter pools by asset ticker"
          />
        </div>
      </div>

      <div ref={scrollRef} className="overflow-auto max-h-[600px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-900">
            <tr className="border-b border-neutral-800 text-xs text-neutral-400 uppercase font-mono tracking-wider">
              <th
                className="py-3 px-4 cursor-pointer select-none"
                onClick={() => handleSort("pair")}
              >
                Asset Pair <SortIcon direction={sortConfig?.key === "pair" ? sortConfig.direction : null} />
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer select-none"
                onClick={() => handleSort("tvl")}
              >
                TVL <SortIcon direction={sortConfig?.key === "tvl" ? sortConfig.direction : null} />
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer select-none"
                onClick={() => handleSort("volume24h")}
              >
                24h Volume <SortIcon direction={sortConfig?.key === "volume24h" ? sortConfig.direction : null} />
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer select-none"
                onClick={() => handleSort("apy")}
              >
                APY <SortIcon direction={sortConfig?.key === "apy" ? sortConfig.direction : null} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {paddingTop > 0 && (
              <tr>
                <td colSpan={4} style={{ height: paddingTop }} />
              </tr>
            )}
            {virtualRows.map((vRow) => {
              const pool = sortedPools[vRow.index];
              return <PoolRow key={pool.id} pool={pool} />;
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={4} style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500 font-mono">
        {sortedPools.length} pool{sortedPools.length !== 1 ? "s" : ""}
        {debouncedSearch && ` (filtered from ${MOCK_POOLS.length})`}
      </div>
    </div>
  );
}