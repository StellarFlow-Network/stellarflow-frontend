"use client";

import { useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * True only for an offline-to-online transition. The first observation (no
 * previous value) never counts, so mounting while online does not trigger a
 * re-sync.
 */
export function isReconnect(previous: boolean | undefined, current: boolean): boolean {
  return previous === false && current === true;
}

/** Collaborators re-synced on reconnect. Structural so tests can pass fakes. */
export interface ResyncTargets {
  queryClient?: { invalidateQueries: () => Promise<unknown> | unknown };
  socket?: { reconnect: () => void };
}

/**
 * Re-synchronises application state after connectivity returns (#1146):
 * marks every TanStack Query entry stale so active queries refetch, and
 * replaces the shared WebSocket, which may have gone half-open during the
 * outage. Each step is isolated so one failing does not skip the other.
 */
export async function resyncAppState({ queryClient, socket }: ResyncTargets): Promise<void> {
  try {
    socket?.reconnect();
  } catch (err) {
    console.error("WebSocket reconnect after coming online failed", err);
  }
  try {
    await queryClient?.invalidateQueries();
  } catch (err) {
    console.error("Query invalidation after coming online failed", err);
  }
}

/**
 * Calls `onReconnect` once each time the browser goes from offline to online.
 * The latest callback is always used, so callers do not need to memoise it.
 */
export function useReconnectResync(onReconnect: () => void): void {
  const { isOnline } = useOnlineStatus();
  const previous = useRef<boolean | undefined>(undefined);
  const callback = useRef(onReconnect);
  callback.current = onReconnect;

  useEffect(() => {
    if (isReconnect(previous.current, isOnline)) {
      callback.current();
    }
    previous.current = isOnline;
  }, [isOnline]);
}
