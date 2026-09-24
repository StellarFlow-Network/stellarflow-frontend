"use client";

import React from "react";
import { Shimmer } from "./Shimmer";

interface SkeletonCardProps {
  /**
   * Number of skeleton cards to render
   */
  count?: number;
  /**
   * Variant of the card skeleton
   * - vault: Matches VaultCard layout with APY chart and stats
   * - pool: Matches PoolPnLCard layout with performance metrics
   * - farm: Matches FarmCard layout with staking information
   * - stats: Generic stats card with icon, value, and label
   */
  variant?: "vault" | "pool" | "farm" | "stats";
  /**
   * Custom className for wrapper
   */
  className?: string;
}

/**
 * SkeletonCard - Animated loading skeleton for card components
 * 
 * Matches exact dimensions of VaultCard, PoolPnLCard, FarmCard, and generic stat cards
 * to eliminate layout shift during loading. Uses Shimmer component for smooth
 * linear gradient animation.
 * 
 * @example
 * ```tsx
 * // Replace VaultCard during loading
 * {isLoading ? (
 *   <SkeletonCard variant="vault" count={3} />
 * ) : (
 *   vaults.map(vault => <VaultCard key={vault.id} vault={vault} />)
 * )}
 * ```
 */
export const SkeletonCard = React.memo(function SkeletonCard({
  count = 1,
  variant = "vault",
  className = "",
}: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        switch (variant) {
          case "vault":
            return <VaultSkeletonCard key={`vault-skeleton-${index}`} className={className} />;
          case "pool":
            return <PoolSkeletonCard key={`pool-skeleton-${index}`} className={className} />;
          case "farm":
            return <FarmSkeletonCard key={`farm-skeleton-${index}`} className={className} />;
          case "stats":
            return <StatsSkeletonCard key={`stats-skeleton-${index}`} className={className} />;
          default:
            return <VaultSkeletonCard key={`vault-skeleton-${index}`} className={className} />;
        }
      })}
    </>
  );
});

/**
 * VaultSkeletonCard - Matches VaultCard layout exactly
 * Dimensions: rounded-2xl, border-gray-800, bg-gray-900, p-6
 */
function VaultSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Vault Header - matches original with icon + title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Icon placeholder - 48x48 circle */}
          <Shimmer className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            {/* Title */}
            <Shimmer className="h-5 w-40 rounded-md" />
            {/* Subtitle */}
            <Shimmer className="h-4 w-48 rounded-md" />
          </div>
        </div>
        {/* APY Badge */}
        <Shimmer className="h-10 w-24 rounded-lg" />
      </div>

      {/* APY Chart Area - matches chart container height */}
      <div className="mb-6">
        <Shimmer className="h-[200px] w-full rounded-xl" />
      </div>

      {/* Stats Grid - 2x2 grid matching original layout */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Shimmer className="h-3 w-24 rounded-md" />
          <Shimmer className="h-6 w-32 rounded-md" />
        </div>
        <div className="space-y-2">
          <Shimmer className="h-3 w-28 rounded-md" />
          <Shimmer className="h-6 w-36 rounded-md" />
        </div>
        <div className="space-y-2">
          <Shimmer className="h-3 w-32 rounded-md" />
          <Shimmer className="h-6 w-28 rounded-md" />
        </div>
        <div className="space-y-2">
          <Shimmer className="h-3 w-24 rounded-md" />
          <Shimmer className="h-6 w-32 rounded-md" />
        </div>
      </div>

      {/* User Balance Section */}
      <div className="border-t border-gray-800 pt-6 mb-6 space-y-4">
        <div className="flex justify-between items-center">
          <Shimmer className="h-4 w-28 rounded-md" />
          <Shimmer className="h-5 w-24 rounded-md" />
        </div>
        <div className="flex justify-between items-center">
          <Shimmer className="h-4 w-32 rounded-md" />
          <Shimmer className="h-5 w-28 rounded-md" />
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="mb-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
        <div className="flex items-center justify-between">
          <Shimmer className="h-4 w-36 rounded-md" />
          <Shimmer className="h-6 w-20 rounded-md" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Shimmer className="h-11 flex-1 rounded-lg" />
        <Shimmer className="h-11 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * PoolSkeletonCard - Matches PoolPnLCard layout
 */
function PoolSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`w-full rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header with pool pair */}
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-6 w-32 rounded-md" />
        <Shimmer className="h-8 w-20 rounded-full" />
      </div>

      {/* Performance metrics - 3 columns */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="space-y-2">
          <Shimmer className="h-3 w-16 rounded-md" />
          <Shimmer className="h-5 w-20 rounded-md" />
        </div>
        <div className="space-y-2">
          <Shimmer className="h-3 w-16 rounded-md" />
          <Shimmer className="h-5 w-20 rounded-md" />
        </div>
        <div className="space-y-2">
          <Shimmer className="h-3 w-16 rounded-md" />
          <Shimmer className="h-5 w-20 rounded-md" />
        </div>
      </div>

      {/* Mini chart or trend indicator */}
      <Shimmer className="h-[100px] w-full rounded-lg mb-4" />

      {/* Action button */}
      <Shimmer className="h-10 w-full rounded-lg" />
    </div>
  );
}

/**
 * FarmSkeletonCard - Matches FarmCard layout
 */
function FarmSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`w-full rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      {/* Header with token pair icons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <Shimmer className="w-8 h-8 rounded-full border-2 border-gray-900" />
            <Shimmer className="w-8 h-8 rounded-full border-2 border-gray-900" />
          </div>
          <Shimmer className="h-5 w-24 rounded-md" />
        </div>
        <Shimmer className="h-6 w-16 rounded-full" />
      </div>

      {/* APY highlight */}
      <div className="mb-4 p-3 rounded-lg bg-gray-800/50">
        <div className="flex items-center justify-between">
          <Shimmer className="h-4 w-20 rounded-md" />
          <Shimmer className="h-7 w-24 rounded-md" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-1">
          <Shimmer className="h-3 w-16 rounded-md" />
          <Shimmer className="h-5 w-20 rounded-md" />
        </div>
        <div className="space-y-1">
          <Shimmer className="h-3 w-20 rounded-md" />
          <Shimmer className="h-5 w-24 rounded-md" />
        </div>
      </div>

      {/* User staking info */}
      <div className="border-t border-gray-800 pt-4 mb-4 space-y-2">
        <div className="flex justify-between">
          <Shimmer className="h-4 w-24 rounded-md" />
          <Shimmer className="h-4 w-20 rounded-md" />
        </div>
        <div className="flex justify-between">
          <Shimmer className="h-4 w-28 rounded-md" />
          <Shimmer className="h-4 w-16 rounded-md" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Shimmer className="h-10 flex-1 rounded-lg" />
        <Shimmer className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * StatsSkeletonCard - Generic stats card skeleton
 */
function StatsSkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`w-full rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-lg ${className}`}
      style={{ contain: "layout paint" }}
    >
      <div className="flex items-start justify-between mb-3">
        {/* Icon */}
        <Shimmer className="w-10 h-10 rounded-lg" />
        {/* Trend badge */}
        <Shimmer className="h-6 w-16 rounded-full" />
      </div>

      {/* Label */}
      <Shimmer className="h-4 w-28 rounded-md mb-2" />

      {/* Value */}
      <Shimmer className="h-8 w-36 rounded-md mb-2" />

      {/* Change indicator */}
      <div className="flex items-center gap-2">
        <Shimmer className="h-4 w-20 rounded-md" />
        <Shimmer className="h-3 w-24 rounded-md" />
      </div>
    </div>
  );
}
