"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookmarkPlus, X } from "lucide-react";

import { useOfflineDraftQueue } from "@/app/hooks/useOfflineDraftQueue";

const AUTO_DISMISS_MS = 8000;

/**
 * "Offline Draft Saved" notification banner (#995).
 *
 * Rendered globally by {@link OfflineDraftSyncRoot}. It appears whenever the
 * queue stores a new draft while the browser is offline and auto-dismisses
 * after {@link AUTO_DISMISS_MS}, with a "Review drafts" shortcut into the queue
 * management drawer.
 */
export function OfflineDraftBanner() {
  const {
    lastSavedDraftId,
    lastSavedAt,
    pendingCount,
    openDrawer,
    acknowledgeSavedBanner,
  } = useOfflineDraftQueue();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastSavedDraftId || lastSavedAt === null) return;

    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      acknowledgeSavedBanner();
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [lastSavedDraftId, lastSavedAt, acknowledgeSavedBanner]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    acknowledgeSavedBanner();
  }, [acknowledgeSavedBanner]);

  const handleReview = useCallback(() => {
    setVisible(false);
    acknowledgeSavedBanner();
    openDrawer();
  }, [acknowledgeSavedBanner, openDrawer]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-14 z-[70] flex justify-center px-4"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-amber-400/40 bg-[#0a0f1e]/95 p-4 text-sm text-white shadow-2xl backdrop-blur-md">
        <BookmarkPlus
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
        />

        <div className="min-w-0 flex-1">
          <p className="font-semibold">Offline Draft Saved</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Your transaction parameters are stored on this device. We&rsquo;ll
            prompt you to submit {pendingCount === 1 ? "it" : "them"} when
            you&rsquo;re back online.
          </p>

          <button
            type="button"
            onClick={handleReview}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#39ff14] px-3 py-1.5 text-xs font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90"
          >
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            Review drafts
          </button>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss offline draft notification"
          className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
