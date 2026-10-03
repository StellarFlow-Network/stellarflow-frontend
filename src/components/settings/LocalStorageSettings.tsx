"use client";

/**
 * LocalStorageSettings.tsx
 *
 * User settings surface for local browser storage: shows how much of the
 * origin's quota is in use and exposes the manual "Clear Local Data Cache"
 * action backed by `clearLocalDataCache()`.
 *
 * The action is deliberately narrower than a `localStorage.clear()`. It drops
 * re-derivable cache and transaction history only, so the user never loses
 * their wallet session, address book, custom tokens, or theme by trying to free
 * up disk space. What it removes is listed back to the user, and what it kept is
 * reported, so the button is never a black box.
 *
 * Usage
 * ─────
 * ```tsx
 * <LocalStorageSettings />
 * ```
 */

import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useOptionalToast } from "@/components/ui/ToastQueue";
import {
  MAX_STORAGE_QUOTA_BYTES,
  clearLocalDataCache,
  getLastSanitizerReport,
  getOriginQuotaBytes,
  getStorageFootprint,
  type SanitizerReport,
  type StorageFootprint,
} from "@/utils/storageSanitizer";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Clamped 0–100 so the meter cannot overflow its track. */
function toPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

/** One-line summary of the last automatic cleanup pass, if one has run. */
function describeLastRun(report: SanitizerReport | null): string {
  if (!report || report.skipped) {
    return "Automatic cleanup has not run yet in this session.";
  }

  const removed = report.transactionsRemoved;
  const evicted = report.evictedKeys.length;
  const parts: string[] = [];

  if (removed > 0) {
    parts.push(`${removed} expired ${removed === 1 ? "record" : "records"}`);
  }
  if (evicted > 0) {
    parts.push(`${evicted} stale ${evicted === 1 ? "entry" : "entries"}`);
  }

  const summary =
    parts.length > 0
      ? `removed ${parts.join(" and ")}`
      : "found nothing to clean up";

  return `Last automatic cleanup ${summary}.`;
}

export function LocalStorageSettings() {
  const toast = useOptionalToast();
  const [footprint, setFootprint] = useState<StorageFootprint | null>(null);
  const [originQuotaBytes, setOriginQuotaBytes] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<SanitizerReport | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const refresh = useCallback(() => {
    setFootprint(getStorageFootprint());
    setLastRun(getLastSanitizerReport());
  }, []);

  useEffect(() => {
    refresh();
    let cancelled = false;
    void getOriginQuotaBytes().then((quota) => {
      if (!cancelled) setOriginQuotaBytes(quota);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleClear = useCallback(() => {
    if (isClearing) return;

    setIsClearing(true);
    try {
      const result = clearLocalDataCache();
      refresh();

      const cleared = result.clearedKeys.length;
      const summary =
        cleared === 0
          ? "No cached data to clear."
          : `Cleared ${cleared} cached ${cleared === 1 ? "entry" : "entries"} and freed ${formatBytes(result.bytesFreed)}.`;

      toast?.addToast({
        title: "Local data cache cleared",
        description: summary,
        status: "confirmed",
      });
    } finally {
      setIsClearing(false);
      setConfirming(false);
    }
  }, [isClearing, refresh, toast]);

  const usedBytes = footprint?.totalBytes ?? 0;
  const ceilingBytes = originQuotaBytes ?? MAX_STORAGE_QUOTA_BYTES;
  const usedPercent = toPercent(
    footprint && ceilingBytes > 0 ? (usedBytes / ceilingBytes) * 100 : null,
  );
  const isEmpty = (footprint?.entries.length ?? 0) === 0;

  return (
    <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Icon id={ICON_IDS.database} size={20} className="text-blue-400" />
        Local Data Cache
      </h2>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-gray-500 uppercase font-bold">Storage used</span>
            <span className="text-gray-300 font-mono">
              {formatBytes(usedBytes)}
              <span className="text-gray-500">
                {" "}
                / {formatBytes(ceilingBytes)}
              </span>
            </span>
          </div>

          <div
            className="h-2 w-full rounded-full bg-[#0d1117] border border-gray-800 overflow-hidden"
            role="progressbar"
            aria-label="Local storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPercent)}
          >
            <div
              className={`h-full transition-all ${
                usedPercent >= 90
                  ? "bg-red-500"
                  : usedPercent >= 70
                    ? "bg-yellow-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>

          <p className="text-xs text-gray-500">
            {footprint === null
              ? "Reading local storage…"
              : isEmpty
                ? "No local data stored yet."
                : `${footprint.entries.length} ${footprint.entries.length === 1 ? "entry" : "entries"}, ${formatBytes(footprint.evictableBytes)} of it reclaimable cache.`}
          </p>

          <p className="text-xs text-gray-600">
            {describeLastRun(lastRun)}
          </p>
        </div>

        {confirming ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-3">
            <p className="text-xs text-amber-200">
              This removes cached balances, query cache, and local transaction
              history. Your wallet session, address book, and preferences are
              kept.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={isClearing}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                {isClearing ? "Clearing…" : "Yes, clear cache"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isClearing}
                className="border border-gray-700 hover:border-gray-600 text-gray-300 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isEmpty}
            className="flex items-center gap-2 border border-gray-700 hover:border-gray-600 text-gray-200 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            <Icon id={ICON_IDS.rotateCcw} size={14} />
            Clear Local Data Cache
          </button>
        )}
      </div>
    </section>
  );
}

export default LocalStorageSettings;
