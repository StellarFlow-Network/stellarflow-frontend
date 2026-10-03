"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw, Database, Clock } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflinePage() {
  const { isOnline, lastOfflineTime } = useOnlineStatus();
  const [retrying, setRetrying] = useState(false);
  const [showCachedData, setShowCachedData] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  // Check for cached data on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lastUpdate = localStorage.getItem('stellarflow-last-update');
      setLastUpdateTime(lastUpdate);

      // Check if we have any cached data
      const hasCachedTokens = localStorage.getItem('stellarflow-tokens');
      const hasCachedPools = localStorage.getItem('stellarflow-pools');
      setShowCachedData(!!(hasCachedTokens || hasCachedPools));
    }
  }, []);

  const handleRetry = async () => {
    setRetrying(true);

    // Force a network check
    try {
      await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Network is still unavailable
    }

    setTimeout(() => setRetrying(false), 2000);
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Unknown";

    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Auto-redirect when online
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && !retrying) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#39ff14]/10 animate-pulse">
            <Wifi className="h-8 w-8 text-[#39ff14]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">
            You&rsquo;re back online!
          </h1>
          <p className="mb-6 text-zinc-400">
            Connection restored. Redirecting you to the dashboard...
          </p>
          <div className="mb-4 h-1 w-32 mx-auto overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-[#39ff14] animate-[loading_2s_ease-in-out_infinite]" />
          </div>
          <a
            href="/"
            className="inline-block rounded-lg bg-[#39ff14] px-6 py-2.5 text-sm font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90"
          >
            Go to Dashboard Now
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] p-6">
      <div className="w-full max-w-md text-center">
        {/* Offline Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 bg-red-950/20">
          <WifiOff className="h-10 w-10 text-red-400 animate-pulse" />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-white">
          You&rsquo;re offline
        </h1>
        <p className="mb-8 text-zinc-400">
          No internet connection detected. Some features may be limited, but you can still view cached data.
        </p>

        {/* Network Status Card */}
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-950/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-zinc-300">Network Status</span>
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" />
              <span className="text-red-400 font-medium">Offline</span>
            </span>
          </div>

          {lastOfflineTime && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
              <Clock className="h-3 w-3" />
              <span>Connection lost {formatTimeAgo(lastOfflineTime?.toISOString())}</span>
            </div>
          )}

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-full origin-left animate-pulse rounded-full bg-gradient-to-r from-red-500/40 to-red-600/60" />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Auto-reconnecting every 5 seconds...
          </p>
        </div>

        {/* Cached Data Availability */}
        {showCachedData && (
          <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Cached Data Available</span>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              You can view previously loaded token balances and pool data.
            </p>
            {lastUpdateTime && (
              <p className="text-xs text-zinc-500">
                Last updated: {formatTimeAgo(lastUpdateTime)}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full rounded-lg border border-[#39ff14]/30 bg-[#39ff14]/5 px-6 py-2.5 text-sm font-semibold text-[#39ff14] transition-colors hover:bg-[#39ff14]/10 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? "Checking Connection..." : "Retry Connection"}
          </button>

          <a
            href="/"
            className="block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800/70"
          >
            View Cached Dashboard
          </a>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">While offline, you can:</h3>
          <ul className="text-xs text-zinc-500 space-y-1 text-left">
            <li>• View cached token balances</li>
            <li>• Browse previously loaded pool data</li>
            <li>• Access your transaction history</li>
            <li>• Review portfolio analytics</li>
          </ul>
        </div>
      </div>

    </main>
  );
}
