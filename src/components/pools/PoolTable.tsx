"use client";

import React, { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/app/hooks/useDebounce";
import { Search, Flame } from "lucide-react";
import { VolumeAnomalyAlert } from "@/components/amm/VolumeAnomalyAlert";

export interface Pool {
  id: string;
  pair: string;
  address: string;
  tvl: number;
  volume24h: number;
  apy: number;
  /**
   * 15-minute trading volume used by the volume anomaly detector.
   * Optional — pools without this field are never flagged as anomalous.
   */
  currentVolume15m?: number;
  /**
   * 7-day rolling average of the 15-minute volume window.
   * Optional — pools without this field are never flagged as anomalous.
   */
  rollingAvgVolume7d?: number;
  /**
   * Normalised volatility score (0–100) for the pool.
   * Optional — defaults to 0 when not provided.
   */
  volatilityScore?: number;
}

const MOCK_POOLS: Pool[] = [
  { id: "pool-1",  pair: "USD / NGN", tvl: 4_250_000, volume24h: 1_850_000, apy: 12.4, currentVolume15m: 620_000, rollingAvgVolume7d: 185_000, volatilityScore: 82 },
  { id: "pool-2",  pair: "XLM / KES", tvl: 1_850_000, volume24h:   920_000, apy:  8.7, currentVolume15m:  62_000, rollingAvgVolume7d:  92_000, volatilityScore: 34 },
  { id: "pool-3",  pair: "NGN / GHS", tvl:   920_000, volume24h:   340_000, apy:  5.2, currentVolume15m:  18_000, rollingAvgVolume7d:  34_000, volatilityScore: 21 },
  { id: "pool-4",  pair: "USD / BRL", tvl: 3_100_000, volume24h: 1_420_000, apy: 15.1, currentVolume15m: 520_000, rollingAvgVolume7d: 142_000, volatilityScore: 76 },
  { id: "pool-5",  pair: "EUR / XLM", tvl: 2_750_000, volume24h:   880_000, apy:  9.3, currentVolume15m:  45_000, rollingAvgVolume7d:  88_000, volatilityScore: 28 },
  { id: "pool-6",  pair: "GBP / NGN", tvl: 1_650_000, volume24h:   520_000, apy:  7.8, currentVolume15m:  22_000, rollingAvgVolume7d:  52_000, volatilityScore: 18 },
  { id: "pool-7",  pair: "USD / GHS", tvl:   890_000, volume24h:   210_000, apy:  6.1, currentVolume15m:  75_000, rollingAvgVolume7d:  21_000, volatilityScore: 91 },
  { id: "pool-8",  pair: "XLM / NGN", tvl: 5_400_000, volume24h: 2_300_000, apy: 18.5, currentVolume15m:  78_000, rollingAvgVolume7d: 230_000, volatilityScore: 45 },
  { id: "pool-9",  pair: "KES / GHS", tvl:   320_000, volume24h:    95_000, apy:  4.3, currentVolume15m:   4_000, rollingAvgVolume7d:   9_500, volatilityScore: 12 },
  { id: "pool-10", pair: "USD / XLM", tvl: 7_800_000, volume24h: 3_100_000, apy: 22.0, currentVolume15m: 340_000, rollingAvgVolume7d:  92_000, volatilityScore: 68 },
  { id: "pool-11", pair: "NGN / BRL", tvl: 1_100_000, volume24h:   420_000, apy: 10.2, currentVolume15m:  15_000, rollingAvgVolume7d:  42_000, volatilityScore: 22 },
  { id: "pool-12", pair: "EUR / NGN", tvl: 2_200_000, volume24h:   760_000, apy: 11.6, currentVolume15m: 290_000, rollingAvgVolume7d:  76_000, volatilityScore: 88 },
  { id: "pool-13", pair: "USD / KES", tvl: 1_950_000, volume24h:   680_000, apy:  8.1, currentVolume15m:  32_000, rollingAvgVolume7d:  68_000, volatilityScore: 30 },
  { id: "pool-14", pair: "GBP / XLM", tvl:   670_000, volume24h:   180_000, apy:  3.9, currentVolume15m:   7_000, rollingAvgVolume7d:  18_000, volatilityScore: 11 },
  { id: "pool-15", pair: "BRL / GHS", tvl:   440_000, volume24h:   120_000, apy:  5.8, currentVolume15m:   5_000, rollingAvgVolume7d:  12_000, volatilityScore: 14 },
];

const ROW_HEIGHT = 48;

// ─────────────────────────────────────────────────────────────────────────────
// Volume anomaly helper — pure function, easy to test in isolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns `true` when `currentVolume15m` is **strictly greater than** 300 %
 * of `rollingAvgVolume7d`.  Pools missing either field are never anomalous.
 */
export function isVolumeAnomalous(pool: Pool): boolean {
  const { currentVolume15m, rollingAvgVolume7d } = pool;
  if (
    currentVolume15m === undefined ||
    rollingAvgVolume7d === undefined ||
    rollingAvgVolume7d <= 0
  ) {
    return false;
  }
  return currentVolume15m > 3 * rollingAvgVolume7d;
}

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
          <span className="inline-flex items-center gap-2">
            {pool.pair}
            <VolumeAnomalyAlert
              currentVolume15m={pool.currentVolume15m ?? 0}
              rollingAvgVolume7d={pool.rollingAvgVolume7d ?? 0}
              volatilityScore={pool.volatilityScore ?? 0}
              tooltipPosition="right"
            />
          </span>
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
  (prev, next) =>
    prev.pool.id === next.pool.id &&
    prev.pool.tvl === next.pool.tvl &&
    prev.pool.volume24h === next.pool.volume24h &&
    prev.pool.apy === next.pool.apy &&
    prev.pool.currentVolume15m === next.pool.currentVolume15m &&
    prev.pool.rollingAvgVolume7d === next.pool.rollingAvgVolume7d &&
    prev.pool.volatilityScore === next.pool.volatilityScore,
);

PoolRow.displayName = "PoolRow";

export default function PoolTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Pool;
    direction: "asc" | "desc";
  } | null>(null);
  // Trending filter — when true, show only anomalous pools (volume > 300% of 7d avg)
  const [showTrendingOnly, setShowTrendingOnly] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Step 1 — search filter (unchanged)
  const searchFilteredPools = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_POOLS;
    return MOCK_POOLS.filter((pool) =>
      pool.pair.toLowerCase().includes(q),
    );
  }, [debouncedSearch]);

  // Step 2 — trending / anomaly filter (layered on top of search)
  const filteredPools = useMemo(() => {
    if (!showTrendingOnly) return searchFilteredPools;
    return searchFilteredPools.filter(isVolumeAnomalous);
  }, [searchFilteredPools, showTrendingOnly]);

  // Step 3 — sort (unchanged logic, now applied to combined filter result)
  const sortedPools = useMemo(() => {
    if (!sortConfig) return filteredPools;
    const { key, direction } = sortConfig;
    return [...filteredPools].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal === undefined || bVal === undefined) return 0;
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
        <div className="flex items-center gap-3">
          {/* ── Trending / anomaly filter toggle ── */}
          <button
            type="button"
            onClick={() => setShowTrendingOnly((v) => !v)}
            aria-pressed={showTrendingOnly}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "text-xs font-semibold border transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-900",
              showTrendingOnly
                ? "bg-orange-500/20 border-orange-500/60 text-orange-300 hover:bg-orange-500/30"
                : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-orange-500/50 hover:text-orange-300",
            ].join(" ")}
          >
            <Flame
              size={13}
              className={showTrendingOnly ? "text-orange-400" : "text-neutral-500"}
              aria-hidden="true"
            />
            Trending
          </button>

          {/* ── Search input ── */}
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
        {showTrendingOnly && (
          <span className="ml-2 text-orange-400">
            🔥 High-activity only
          </span>
        )}
      </div>
    </div>
  );
}
