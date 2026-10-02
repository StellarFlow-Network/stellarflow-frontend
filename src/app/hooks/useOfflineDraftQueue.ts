"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  offlineDraftStore,
  type OfflineDraftInput,
  type OfflineDraftKind,
  type OfflineDraftQueueState,
  type OfflineDraftSubmitHandler,
  type OfflineDraftSyncResult,
  type OfflineDraftSyncSummary,
  type OfflineTransactionDraft,
} from "@/lib/OfflineTransactionQueue";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

export interface UseOfflineDraftQueueResult extends OfflineDraftQueueState {
  /** Live connectivity, from the shared `online`/`offline` listeners. */
  isOnline: boolean;
  /** Drafts that can still be submitted (excludes expired/failed). */
  pendingCount: number;
  saveDraft(input: OfflineDraftInput): Promise<OfflineTransactionDraft>;
  saveDraftIfOffline(
    input: OfflineDraftInput,
    options?: { force?: boolean },
  ): Promise<OfflineTransactionDraft | null>;
  deleteDraft(id: string): Promise<void>;
  clearDrafts(): Promise<void>;
  submitDraft(id: string): Promise<OfflineDraftSyncResult>;
  submitAllDrafts(): Promise<OfflineDraftSyncSummary>;
  registerSubmitHandler(
    kind: OfflineDraftKind | "*",
    handler: OfflineDraftSubmitHandler,
  ): () => void;
  openDrawer(): void;
  closeDrawer(): void;
  openPrompt(): void;
  dismissPrompt(): void;
  acknowledgeSavedBanner(): void;
}

/**
 * React binding for the offline transaction draft queue (#995).
 *
 * - Restores persisted drafts from IndexedDB on first mount.
 * - Re-arms and opens the "connection restored" prompt when connectivity comes
 *   back (or when the app loads online with drafts left over from a previous
 *   offline session), unless the user already dismissed it.
 * - Exposes every queue action so compose flows can call
 *   `saveDraftIfOffline(...)` and the drawer/prompt can manage the queue.
 */
export function useOfflineDraftQueue(): UseOfflineDraftQueueResult {
  const state = useSyncExternalStore(
    offlineDraftStore.subscribe,
    offlineDraftStore.getSnapshot,
    offlineDraftStore.getServerSnapshot,
  );
  const isOnline = useOnlineStatus();

  // Restore anything persisted while the user was previously offline.
  useEffect(() => {
    void offlineDraftStore.hydrate();
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;

    if (!isOnline) {
      // Re-arm the prompt so the next reconnection asks again.
      if (state.promptDismissed || state.promptOpen) {
        offlineDraftStore.resetPromptDismissal();
      }
      return;
    }

    if (state.counts.pending === 0) {
      if (state.promptOpen) offlineDraftStore.closePrompt();
      return;
    }

    if (state.promptOpen || state.promptDismissed) return;

    // Connection is back (or a previous session's drafts were just restored)
    // and there is something to submit: prompt the user.
    offlineDraftStore.openPrompt();
  }, [
    state.hydrated,
    state.counts.pending,
    state.promptOpen,
    state.promptDismissed,
    isOnline,
  ]);

  const saveDraft = useCallback(
    (input: OfflineDraftInput) => offlineDraftStore.saveDraft(input),
    [],
  );

  const saveDraftIfOffline = useCallback(
    (input: OfflineDraftInput, options?: { force?: boolean }) =>
      offlineDraftStore.saveDraftIfOffline(input, options),
    [],
  );

  const deleteDraft = useCallback(
    (id: string) => offlineDraftStore.deleteDraft(id),
    [],
  );

  const clearDrafts = useCallback(() => offlineDraftStore.clearDrafts(), []);

  const submitDraft = useCallback(
    (id: string) => offlineDraftStore.submitDraft(id),
    [],
  );

  const submitAllDrafts = useCallback(
    () => offlineDraftStore.submitAllDrafts(),
    [],
  );

  const registerSubmitHandler = useCallback(
    (kind: OfflineDraftKind | "*", handler: OfflineDraftSubmitHandler) =>
      offlineDraftStore.registerSubmitHandler(kind, handler),
    [],
  );

  const openDrawer = useCallback(() => offlineDraftStore.openDrawer(), []);
  const closeDrawer = useCallback(() => offlineDraftStore.closeDrawer(), []);
  const openPrompt = useCallback(() => offlineDraftStore.openPrompt(), []);
  const dismissPrompt = useCallback(
    () => offlineDraftStore.dismissPrompt(),
    [],
  );
  const acknowledgeSavedBanner = useCallback(
    () => offlineDraftStore.acknowledgeSavedBanner(),
    [],
  );

  return {
    ...state,
    isOnline,
    pendingCount: state.counts.pending,
    saveDraft,
    saveDraftIfOffline,
    deleteDraft,
    clearDrafts,
    submitDraft,
    submitAllDrafts,
    registerSubmitHandler,
    openDrawer,
    closeDrawer,
    openPrompt,
    dismissPrompt,
    acknowledgeSavedBanner,
  };
}
