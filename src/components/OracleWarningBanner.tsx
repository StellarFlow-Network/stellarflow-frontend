'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, X } from 'lucide-react';

export interface OracleFeedSource {
  name: string;
  price: number;
  lastUpdate: Date;
  status: 'healthy' | 'stale' | 'offline';
}

export interface OracleHealthMetrics {
  heartbeatAge: number; // Age in seconds since last update
  priceDeviation: number; // Maximum deviation percentage between sources
  sources: OracleFeedSource[];
  consensusPrice: number | null;
  isHealthy: boolean;
}

export interface OracleWarningBannerProps {
  /** Current oracle health metrics */
  metrics: OracleHealthMetrics;
  /** Asset pair being monitored (e.g., "XLM/USD") */
  assetPair: string;
  /** Callback when user dismisses banner temporarily */
  onDismiss?: () => void;
  /** Callback when user requests manual refresh */
  onRefresh?: () => void | Promise<void>;
  /** Link to view detailed oracle feed information */
  oracleFeedUrl?: string;
  /** Maximum allowed heartbeat age in seconds (default: 300 = 5 minutes) */
  maxHeartbeatAge?: number;
  /** Maximum allowed price deviation percentage (default: 3%) */
  maxPriceDeviation?: number;
}

const STALE_THRESHOLD_SECONDS = 300; // 5 minutes
const DIVERGENCE_THRESHOLD_PERCENT = 3; // 3%

/**
 * Determines if the oracle is in a warning state based on health metrics
 */
function shouldShowWarning(
  metrics: OracleHealthMetrics,
  maxHeartbeatAge: number,
  maxPriceDeviation: number
): boolean {
  if (!metrics.isHealthy) return true;
  if (metrics.heartbeatAge > maxHeartbeatAge) return true;
  if (metrics.priceDeviation > maxPriceDeviation) return true;
  return false;
}

/**
 * Formats timestamp age into human-readable string
 */
function formatAgeString(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function OracleWarningBanner({
  metrics,
  assetPair,
  onDismiss,
  onRefresh,
  oracleFeedUrl,
  maxHeartbeatAge = STALE_THRESHOLD_SECONDS,
  maxPriceDeviation = DIVERGENCE_THRESHOLD_PERCENT,
}: OracleWarningBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Reset dismissed state when oracle becomes healthy
  useEffect(() => {
    if (metrics.isHealthy && metrics.heartbeatAge <= maxHeartbeatAge && metrics.priceDeviation <= maxPriceDeviation) {
      setIsDismissed(false);
    }
  }, [metrics, maxHeartbeatAge, maxPriceDeviation]);

  const warningLevel = useMemo(() => {
    if (metrics.heartbeatAge > maxHeartbeatAge * 2 || metrics.priceDeviation > maxPriceDeviation * 2) {
      return 'critical';
    }
    return 'warning';
  }, [metrics, maxHeartbeatAge, maxPriceDeviation]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh oracle data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // Don't show banner if dismissed or if oracle is healthy
  if (isDismissed || !shouldShowWarning(metrics, maxHeartbeatAge, maxPriceDeviation)) {
    return null;
  }

  const bgColor = warningLevel === 'critical'
    ? 'bg-red-600 dark:bg-red-700'
    : 'bg-amber-500 dark:bg-amber-600';

  const textColor = 'text-white';

  return (
    <div className={`sticky top-0 z-50 ${bgColor} shadow-lg`}>
      {/* Main Banner */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Icon & Message */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <AlertTriangle
            size={24}
            className={`flex-shrink-0 ${warningLevel === 'critical' ? 'animate-pulse' : ''}`}
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide">
              Oracle Price Feed {warningLevel === 'critical' ? 'Critical' : 'Warning'}
            </p>
            <p className="text-sm font-medium mt-0.5">
              {metrics.heartbeatAge > maxHeartbeatAge && (
                <>
                  Oracle update is stale ({formatAgeString(metrics.heartbeatAge)}).
                  {' '}
                </>
              )}
              {metrics.priceDeviation > maxPriceDeviation && (
                <>
                  Price sources diverging by {metrics.priceDeviation.toFixed(2)}%.
                  {' '}
                </>
              )}
              {assetPair} trading and borrowing temporarily restricted.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle Details */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className={`px-3 py-1.5 ${textColor} bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors`}
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 ${textColor} bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50`}
              title="Refresh oracle data"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          )}

          {/* View Feed Sources */}
          {oracleFeedUrl && (
            <a
              href={oracleFeedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 ${textColor} bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1`}
            >
              View Feeds
              <ExternalLink size={12} />
            </a>
          )}

          {/* Dismiss */}
          {onDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              className={`p-2 ${textColor} hover:bg-white/20 rounded-lg transition-colors`}
              aria-label="Dismiss warning"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Detailed Oracle Status */}
      {showDetails && (
        <div className="border-t border-white/20 bg-black/10">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3">
              Oracle Feed Sources for {assetPair}
            </p>

            <div className="grid gap-2">
              {metrics.sources.map((source) => {
                const ageSeconds = Math.floor((Date.now() - source.lastUpdate.getTime()) / 1000);
                const isStale = ageSeconds > maxHeartbeatAge;

                return (
                  <div
                    key={source.name}
                    className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {/* Status Indicator */}
                      <div
                        className={`w-2 h-2 rounded-full ${
                          source.status === 'healthy'
                            ? 'bg-emerald-400'
                            : source.status === 'stale'
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                      />
                      <span className="font-semibold">{source.name}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-mono">${source.price.toFixed(4)}</span>
                      <span className={isStale ? 'text-red-200' : 'text-white/70'}>
                        {formatAgeString(ageSeconds)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consensus Price */}
            {metrics.consensusPrice !== null && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold">Consensus Price:</span>
                  <span className="font-mono font-bold text-base">
                    ${metrics.consensusPrice.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1 text-white/70">
                  <span>Max Deviation:</span>
                  <span className={metrics.priceDeviation > maxPriceDeviation ? 'text-red-200 font-semibold' : ''}>
                    {metrics.priceDeviation.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Warning Text */}
            <div className="mt-3 pt-3 border-t border-white/20 text-xs text-white/90">
              <p className="font-semibold">⚠️ Actions Temporarily Disabled:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 ml-2">
                <li>Opening new borrow positions</li>
                <li>Liquidation triggers</li>
                <li>Automatic collateral rebalancing</li>
              </ul>
              <p className="mt-2 text-white/70">
                These restrictions will automatically lift once oracle health is restored.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OracleWarningBanner;
