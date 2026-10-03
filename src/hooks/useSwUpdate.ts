"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  applySwUpdate,
  getSwUpdateState,
  initSwUpdateListener,
  subscribeToSwUpdates,
  type SwUpdateState,
} from "@/services/swUpdate";

/**
 * React hook that wires the SW auto-update guard into component state.
 *
 * - Initialises the global SW update listener on mount.
 * - Exposes `updateAvailable` (boolean) for banner rendering.
 * - Provides `applyUpdate` (sends SKIP_WAITING → hard reload) and
 *   `dismissUpdate` (clears the flag so the banner can be closed).
 *
 * @example
 * ```tsx
 * const { updateAvailable, applyUpdate, dismissUpdate } = useSwUpdate();
 * if (updateAvailable) <UpdateBanner onUpdate={applyUpdate} onDismiss={dismissUpdate} />;
 * ```
 */
export function useSwUpdate() {
  const state: SwUpdateState = useSyncExternalStore(
    subscribeToSwUpdates,
    getSwUpdateState,
    getSwUpdateState,
  );

  useEffect(() => {
    const cleanup = initSwUpdateListener();
    return cleanup;
  }, []);

  const applyUpdate = useCallback(() => {
    void applySwUpdate();
  }, []);

  return {
    updateAvailable: state.updateAvailable,
    status: state.status,
    registration: state.registration,
    applyUpdate,
  };
}
