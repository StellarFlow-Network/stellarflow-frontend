"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";

import { useOfflineDraftQueue } from "@/app/hooks/useOfflineDraftQueue";
import { describeDraftParams, formatDraftLabel } from "@/lib/OfflineTransactionQueue";

const PREVIEW_LIMIT = 3;

/**
 * "Connection restored" draft submission prompt (#995).
 *
 * Opens automatically when connectivity is restored (or when a previous offline
 * session's drafts are restored on load) and there is at least one submittable
 * draft left in IndexedDB. The user reviews what will be sent and chooses to
 * submit the whole queue, open the management drawer, or postpone.
 */
export function OfflineDraftSyncModal() {
  const {
    drafts,
    counts,
    promptOpen,
    isOnline,
    submitting,
    dismissPrompt,
    openDrawer,
    submitAllDrafts,
  } = useOfflineDraftQueue();
  const [outcome, setOutcome] = useState<string | null>(null);
  const wasPrompted = useRef(false);

  const prompted = promptOpen && isOnline && counts.pending > 0;
  // Keep the dialog mounted while the submission result is being shown, even
  // though the queue is already empty and the prompt flag has been cleared.
  const visible = prompted || outcome !== null;

  // Reset any previous submission result when a *new* prompt opens. (This must
  // not depend on `prompted` alone: submitting successfully closes the prompt,
  // which would otherwise wipe the result message in the same render.)
  useEffect(() => {
    if (promptOpen && !wasPrompted.current) setOutcome(null);
    wasPrompted.current = promptOpen;
  }, [promptOpen]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOutcome(null);
        dismissPrompt();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, dismissPrompt]);

  const handleSubmitAll = useCallback(async () => {
    const summary = await submitAllDrafts();

    if (summary.submittedCount > 0 && summary.failedCount === 0 && summary.skippedCount === 0) {
      setOutcome(
        `Submitted ${summary.submittedCount} offline draft${summary.submittedCount === 1 ? "" : "s"}.`,
      );
      return;
    }

    if (summary.submittedCount > 0) {
      setOutcome(
        `Submitted ${summary.submittedCount} draft${summary.submittedCount === 1 ? "" : "s"}; ${
          summary.failedCount + summary.skippedCount
        } still queued.`,
      );
      return;
    }

    setOutcome(
      summary.failed[0]?.error ??
        summary.skipped[0]?.error ??
        "Nothing could be submitted yet.",
    );
  }, [submitAllDrafts]);

  const handleReview = useCallback(() => {
    setOutcome(null);
    dismissPrompt();
    openDrawer();
  }, [dismissPrompt, openDrawer]);

  const handleClose = useCallback(() => {
    setOutcome(null);
    dismissPrompt();
  }, [dismissPrompt]);

  const preview = drafts
    .filter((draft) => draft.status === "pending")
    .slice(0, PREVIEW_LIMIT);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="offline-draft-prompt"
          className="fixed inset-0 z-[85] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-draft-prompt-title"
            className="relative w-full max-w-lg rounded-2xl border border-[#1b2a3b] bg-[#0a0f1e] p-6 text-white shadow-2xl"
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label="Dismiss offline draft prompt"
              className="absolute right-4 top-4 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#39ff14]/10">
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-[#39ff14]" />
              </span>

              <div className="min-w-0 pr-8">
                <h2
                  id="offline-draft-prompt-title"
                  className="text-base font-semibold"
                >
                  {outcome ? "Offline drafts updated" : "Connection restored"}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  {outcome ??
                    `You have ${counts.pending} offline transaction draft${
                      counts.pending === 1 ? "" : "s"
                    } waiting to be submitted.`}
                </p>
              </div>
            </div>

            {outcome === null && preview.length > 0 ? (
              <ul className="mt-4 space-y-2 rounded-xl border border-[#1b2a3b] bg-[#0d1526] p-3">
                {preview.map((draft) => (
                  <li key={draft.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-medium text-zinc-200">
                      {formatDraftLabel(draft)}
                    </span>
                    <span className="truncate font-mono text-[11px] text-zinc-500">
                      {describeDraftParams(draft, 2)}
                    </span>
                  </li>
                ))}
                {counts.pending > preview.length ? (
                  <li className="text-[11px] text-zinc-500">
                    +{counts.pending - preview.length} more
                  </li>
                ) : null}
              </ul>
            ) : null}

            {outcome === null ? (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  Later
                </button>

                <button
                  type="button"
                  onClick={handleReview}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#39ff14]/30 bg-[#39ff14]/5 px-4 py-2 text-sm font-semibold text-[#39ff14] transition-colors hover:bg-[#39ff14]/10"
                >
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  Review drafts
                </button>

                <button
                  type="button"
                  onClick={() => void handleSubmitAll()}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#39ff14] px-4 py-2 text-sm font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  )}
                  Submit all now
                </button>
              </div>
            ) : (
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReview}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  Open queue
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg bg-[#39ff14] px-4 py-2 text-sm font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90"
                >
                  Done
                </button>
              </div>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
