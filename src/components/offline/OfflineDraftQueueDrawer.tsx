"use client";

import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Loader2, RefreshCw, Trash2, X } from "lucide-react";

import { useOfflineDraftQueue } from "@/app/hooks/useOfflineDraftQueue";
import {
  describeDraftParams,
  formatDraftAge,
  formatDraftKindLabel,
  formatDraftLabel,
  isDraftRetryable,
} from "@/lib/OfflineTransactionQueue";

/**
 * Draft queue management drawer (#995).
 *
 * Lists every draft persisted in IndexedDB with its composed parameters, age
 * and attempt count, and lets the user submit or delete individual drafts, or
 * flush the whole queue at once.
 */
export function OfflineDraftQueueDrawer() {
  const {
    drafts,
    drawerOpen,
    submitting,
    busy,
    error,
    closeDrawer,
    deleteDraft,
    clearDrafts,
    submitDraft,
    submitAllDrafts,
  } = useOfflineDraftQueue();

  useEffect(() => {
    if (!drawerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, closeDrawer]);

  const handleClearAll = useCallback(() => {
    void clearDrafts();
  }, [clearDrafts]);

  const handleSubmitAll = useCallback(() => {
    void submitAllDrafts();
  }, [submitAllDrafts]);

  const retryableCount = drafts.filter((draft) => isDraftRetryable(draft)).length;

  return (
    <AnimatePresence>
      {drawerOpen ? (
        <motion.div
          key="offline-draft-drawer"
          className="fixed inset-0 z-[80] flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Offline transaction drafts"
            className="relative flex h-full w-full max-w-md flex-col border-l border-[#1b2a3b] bg-[#0a0f1e] text-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-[#1b2a3b] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">
                  Offline drafts
                  {drafts.length > 0 ? (
                    <span className="ml-2 rounded-full bg-[#39ff14]/10 px-2 py-0.5 text-xs font-medium text-[#39ff14]">
                      {drafts.length}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Stored in IndexedDB and kept until you submit or delete them.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close offline draft drawer"
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error ? (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
                >
                  {error}
                </p>
              ) : null}

              {drafts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Clock aria-hidden="true" className="mb-3 h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-400">No offline drafts queued.</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Drafts composed while you are offline will appear here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {drafts.map((draft) => {
                    const retryable = isDraftRetryable(draft);
                    return (
                      <li
                        key={draft.id}
                        className="rounded-xl border border-[#1b2a3b] bg-[#0d1526] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-[#39ff14]/30 bg-[#39ff14]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#39ff14]">
                                {formatDraftKindLabel(draft.kind)}
                              </span>
                              {draft.status === "failed" ? (
                                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                                  Failed
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 truncate text-sm font-medium text-white">
                              {formatDraftLabel(draft)}
                            </p>
                          </div>

                          <span className="shrink-0 text-[11px] text-zinc-500">
                            {formatDraftAge(Date.now() - draft.createdAt)}
                          </span>
                        </div>

                        <p className="mt-2 truncate font-mono text-[11px] text-zinc-400">
                          {describeDraftParams(draft)}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-500">
                            {draft.network} ·{" "}
                            {draft.attempts === 0
                              ? "not attempted"
                              : `${draft.attempts} attempt${draft.attempts === 1 ? "" : "s"}`}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void submitDraft(draft.id)}
                              disabled={submitting || !retryable}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#39ff14]/30 bg-[#39ff14]/5 px-2.5 py-1.5 text-xs font-semibold text-[#39ff14] transition-colors hover:bg-[#39ff14]/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {submitting ? (
                                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                              )}
                              Submit
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteDraft(draft.id)}
                              aria-label={`Delete offline draft ${formatDraftLabel(draft)}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-rose-500/40 hover:text-rose-300"
                            >
                              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>

                        {draft.lastError ? (
                          <p className="mt-2 text-[11px] text-amber-300/90">
                            Last error: {draft.lastError}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-[#1b2a3b] px-5 py-4">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={busy || drafts.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Clear all
              </button>

              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={submitting || retryableCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#39ff14] px-3 py-2 text-xs font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                Submit all ({retryableCount})
              </button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
