'use client';

/**
 * VaultRiskHeatmap.tsx
 *
 * Risk heatmap component displaying protocol-wide vault debt distributions across
 * health factor tiers for risk managers.
 *
 * Features:
 *   • Color-coded risk distribution bars (Critical, Warning, Safe buckets)
 *   • Health factor buckets: H < 1.1, 1.1-1.3, 1.3-1.5, > 1.5
 *   • Aggregate USD debt values per bucket
 *   • Click-to-filter vault list by risk bucket
 *   • Responsive design with percentage-based widths
 *   • Hover tooltips with detailed stats
 *   • Keyboard-accessible bucket buttons
 *
 * Design principles:
 *   • Color coding matches HealthFactorGauge zone colors for consistency
 *   • Visual proportion reflects actual debt distribution
 *   • Clear visual hierarchy with red/orange/green gradient
 *   • Accessible click targets with proper ARIA labels
 */

import React, { useCallback, useMemo } from 'react';
import { BalanceValue } from '@/context/BalancePrivacyContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HealthFactorBucket = 'critical' | 'warning-high' | 'warning-low' | 'safe';

export interface VaultRiskData {
  id: string;
  name: string;
  healthFactor: number;
  debtUsd: number;
  collateralUsd: number;
}

export interface VaultRiskHeatmapProps {
  /** Array of vault risk data to visualize */
  vaults: VaultRiskData[];
  /** Callback when a bucket is clicked to filter vaults */
  onBucketClick?: (bucket: HealthFactorBucket | null) => void;
  /** Currently selected bucket (null = no filter) */
  selectedBucket?: HealthFactorBucket | null;
  /** Optional custom class name */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface BucketConfig {
  label: string;
  description: string;
  healthFactorRange: string;
  color: string;
  bgColor: string;
  bgColorHover: string;
  textColor: string;
}

const BUCKET_CONFIG: Record<HealthFactorBucket, BucketConfig> = {
  critical: {
    label: 'Critical',
    description: 'H < 1.1',
    healthFactorRange: 'H < 1.1',
    color: '#ef4444',
    bgColor: 'bg-red-500/20',
    bgColorHover: 'bg-red-500/30',
    textColor: 'text-red-400',
  },
  'warning-high': {
    label: 'High Risk',
    description: '1.1 - 1.3',
    healthFactorRange: '1.1 - 1.3',
    color: '#f97316',
    bgColor: 'bg-orange-500/20',
    bgColorHover: 'bg-orange-500/30',
    textColor: 'text-orange-400',
  },
  'warning-low': {
    label: 'Medium Risk',
    description: '1.3 - 1.5',
    healthFactorRange: '1.3 - 1.5',
    color: '#eab308',
    bgColor: 'bg-yellow-500/20',
    bgColorHover: 'bg-yellow-500/30',
    textColor: 'text-yellow-400',
  },
  safe: {
    label: 'Safe',
    description: 'H > 1.5',
    healthFactorRange: 'H > 1.5',
    color: '#10b981',
    bgColor: 'bg-emerald-500/20',
    bgColorHover: 'bg-emerald-500/30',
    textColor: 'text-emerald-400',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getHealthFactorBucket(healthFactor: number): HealthFactorBucket {
  if (healthFactor < 1.1) return 'critical';
  if (healthFactor < 1.3) return 'warning-high';
  if (healthFactor < 1.5) return 'warning-low';
  return 'safe';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket Statistics
// ─────────────────────────────────────────────────────────────────────────────

interface BucketStats {
  bucket: HealthFactorBucket;
  vaultCount: number;
  totalDebtUsd: number;
  percentage: number;
  vaultIds: string[];
}

function calculateBucketStats(vaults: VaultRiskData[]): BucketStats[] {
  const buckets: Record<HealthFactorBucket, BucketStats> = {
    critical: { bucket: 'critical', vaultCount: 0, totalDebtUsd: 0, percentage: 0, vaultIds: [] },
    'warning-high': { bucket: 'warning-high', vaultCount: 0, totalDebtUsd: 0, percentage: 0, vaultIds: [] },
    'warning-low': { bucket: 'warning-low', vaultCount: 0, totalDebtUsd: 0, percentage: 0, vaultIds: [] },
    safe: { bucket: 'safe', vaultCount: 0, totalDebtUsd: 0, percentage: 0, vaultIds: [] },
  };

  const totalDebtUsd = vaults.reduce((sum, vault) => sum + vault.debtUsd, 0);

  for (const vault of vaults) {
    const bucket = getHealthFactorBucket(vault.healthFactor);
    buckets[bucket].vaultCount += 1;
    buckets[bucket].totalDebtUsd += vault.debtUsd;
    buckets[bucket].vaultIds.push(vault.id);
  }

  // Calculate percentages based on debt distribution
  for (const key of Object.keys(buckets) as HealthFactorBucket[]) {
    buckets[key].percentage = totalDebtUsd > 0 ? (buckets[key].totalDebtUsd / totalDebtUsd) * 100 : 0;
  }

  return Object.values(buckets);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket Bar Component
// ─────────────────────────────────────────────────────────────────────────────

interface BucketBarProps {
  stats: BucketStats;
  isSelected: boolean;
  onClick: () => void;
}

const BucketBar = React.memo(function BucketBar({ stats, isSelected, onClick }: BucketBarProps) {
  const config = BUCKET_CONFIG[stats.bucket];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-1 min-w-[80px] p-3 rounded-lg border transition-all duration-200
        ${isSelected ? config.bgColorHover + ' border-current ring-2 ring-offset-2 ring-offset-gray-900' : config.bgColor + ' border-transparent hover:' + config.bgColorHover}
      `}
      style={isSelected ? { borderColor: config.color, ringColor: config.color } : undefined}
      aria-label={`Filter vaults by ${config.label} risk (${stats.vaultCount} vaults, ${stats.percentage.toFixed(1)}% of debt)`}
      aria-pressed={isSelected}
    >
      {/* Health factor range label */}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
        {config.healthFactorRange}
      </div>

      {/* Vault count */}
      <div className="text-lg font-bold text-white mb-1">
        {stats.vaultCount}
      </div>

      {/* Percentage bar */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(stats.percentage, 5)}%`, // Minimum 5% for visibility
            backgroundColor: config.color,
          }}
        />
      </div>

      {/* Debt value */}
      <div className={`text-xs font-mono ${config.textColor}`}>
        <BalanceValue>${stats.totalDebtUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</BalanceValue>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ backgroundColor: config.color }}
          aria-hidden
        />
      )}
    </button>
  );
});

BucketBar.displayName = 'BucketBar';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const VaultRiskHeatmap = React.memo(function VaultRiskHeatmap({
  vaults,
  onBucketClick,
  selectedBucket = null,
  className = '',
}: VaultRiskHeatmapProps) {
  const bucketStats = useMemo(() => calculateBucketStats(vaults), [vaults]);

  const totalDebtUsd = useMemo(() => vaults.reduce((sum, vault) => sum + vault.debtUsd, 0), [vaults]);
  const totalVaults = vaults.length;

  const handleBucketClick = useCallback(
    (bucket: HealthFactorBucket) => {
      if (onBucketClick) {
        // Toggle: if already selected, deselect; otherwise select
        onBucketClick(selectedBucket === bucket ? null : bucket);
      }
    },
    [onBucketClick, selectedBucket]
  );

  const handleClearFilter = useCallback(() => {
    if (onBucketClick) {
      onBucketClick(null);
    }
  }, [onBucketClick]);

  if (vaults.length === 0) {
    return (
      <div className={`rounded-xl border border-gray-800 bg-gray-900/50 p-6 ${className}`}>
        <p className="text-center text-gray-400 text-sm">No vault data available</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900/50 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Vault Risk Distribution</h3>
          <p className="text-xs text-gray-400">
            Protocol-wide debt distribution by health factor tier
          </p>
        </div>
        {selectedBucket && (
          <button
            type="button"
            onClick={handleClearFilter}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Clear filter"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg bg-gray-800/40 p-3 border border-gray-800">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Debt</p>
          <p className="text-base font-bold text-white font-mono">
            <BalanceValue>${totalDebtUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</BalanceValue>
          </p>
        </div>
        <div className="rounded-lg bg-gray-800/40 p-3 border border-gray-800">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Vaults</p>
          <p className="text-base font-bold text-white font-mono">{totalVaults}</p>
        </div>
      </div>

      {/* Risk buckets */}
      <div className="flex gap-2">
        {bucketStats.map((stats) => (
          <BucketBar
            key={stats.bucket}
            stats={stats}
            isSelected={selectedBucket === stats.bucket}
            onClick={() => handleBucketClick(stats.bucket)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />
          Critical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500" aria-hidden />
          High Risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" aria-hidden />
          Medium Risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
          Safe
        </span>
      </div>
    </div>
  );
});

VaultRiskHeatmap.displayName = 'VaultRiskHeatmap';
