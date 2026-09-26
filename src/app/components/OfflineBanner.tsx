"use client";

import { ArrowRight, WifiOff } from "lucide-react";

import { useOfflineDraftQueue } from "@/app/hooks/useOfflineDraftQueue";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

/**
 * Offline connectivity banner.
 *
 * As well as pausing live data while the connection is down, it surfaces how
 * many transaction drafts are queued locally (#995) and links into the draft
 * management drawer so the user can review or delete them offline.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { pendingCount, openDrawer } = useOfflineDraftQueue();

  if (isOnline) return null;

  return (
    <div
      className="sticky top-0 z-50 flex min-h-10 w-full items-center justify-center gap-2 border-b border-amber-300/40 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      <WifiOff aria-hidden="true" size={16} />
      <span>You are offline. Live network data is paused until connection is restored.</span>

      {pendingCount > 0 ? (
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs font-semibold">
            {pendingCount} offline draft{pendingCount === 1 ? "" : "s"} queued
          </span>
          <button
            type="button"
            onClick={openDrawer}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 text-xs font-semibold transition-colors hover:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
          >
            Review drafts
            <ArrowRight aria-hidden="true" size={12} />
          </button>
        </span>
      ) : null}
    </div>
  );
}
