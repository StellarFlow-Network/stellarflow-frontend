"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PriceData } from "@/types";
import { useErrorTimeout } from "./useErrorTimeout";
import { usePageVisibility } from "./usePageVisibility";
import { useRAFInterval } from "./useRAFInterval";
import type { AssetSymbol } from "@/config/assetSymbols";
import { WebSocketManager } from "@/utils/WebSocketManager";

export interface UseSocketOptions {
  assetIds?: AssetSymbol[];
  enableDeltaUpdates?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  errorTimeoutMs?: number;
}

export interface UseSocketReturn {
  isConnected: boolean;
  lastUpdate: PriceData | null;
  error: string | null;
  reconnectAttempts: number;
  subscribeToAsset: (assetId: string) => void;
  unsubscribeFromAsset: (assetId: string) => void;
  disconnect: () => void;
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Internal hook — delegates all transport concerns to WebSocketManager so
// that this hook only manages per-consumer state (lastUpdate, isConnected).
// ---------------------------------------------------------------------------

function useSocketState(options: UseSocketOptions): UseSocketReturn {
  const { assetIds = [], errorTimeoutMs = 5000 } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<PriceData | null>(null);
  const { error, setError } = useErrorTimeout({ timeoutMs: errorTimeoutMs });

  // Track which assets this consumer instance has subscribed to so that
  // cleanup on unmount is scoped to only those assets.
  const subscribedAssetsRef = useRef<Set<string>>(new Set(assetIds));
  const isVisible = usePageVisibility();

  // Batch pending WS message payloads; flushed by the RAF interval below so
  // we never write state more than once per animation frame.
  const pendingUpdatesRef = useRef<(PriceData | Partial<PriceData>)[]>([]);

  // Stable singleton transport layer — all consumers share one WS connection.
  const wsManager = WebSocketManager.getInstance();

  // ------------------------------------------------------------------
  // flushPendingUpdates — collapses all buffered ticks into one setState.
  // Stable identity (empty dep-array) so the RAF interval never restarts.
  // ------------------------------------------------------------------
  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return;

    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current.length = 0;

    setLastUpdate((prev: PriceData | null) => {
      let current = prev;
      for (const update of updates) {
        current = current
          ? { ...current, ...(update as PriceData) }
          : (update as PriceData);
      }
      return current;
    });
  }, []);

  // ------------------------------------------------------------------
  // disconnect — unregisters this consumer's listeners and asset subs.
  // ------------------------------------------------------------------
  const disconnect = useCallback(() => {
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.unsubscribeFromAssets(
        Array.from(subscribedAssetsRef.current),
      );
    }
    setIsConnected(false);
  }, [wsManager]);

  // ------------------------------------------------------------------
  // subscribeToAsset / unsubscribeFromAsset — delegate to the manager.
  // ------------------------------------------------------------------
  const subscribeToAsset = useCallback(
    (assetId: string) => {
      if (!subscribedAssetsRef.current.has(assetId)) {
        subscribedAssetsRef.current.add(assetId);
        wsManager.subscribeToAssets([assetId]);
      }
    },
    [wsManager],
  );

  const unsubscribeFromAsset = useCallback(
    (assetId: string) => {
      if (subscribedAssetsRef.current.has(assetId)) {
        subscribedAssetsRef.current.delete(assetId);
        wsManager.unsubscribeFromAssets([assetId]);
      }
    },
    [wsManager],
  );

  // ------------------------------------------------------------------
  // reconnect — tears down and re-connects via the manager.
  // ------------------------------------------------------------------
  const reconnect = useCallback(() => {
    disconnect();
    // Re-establish after a microtask so disconnect's cleanup completes first.
    setTimeout(() => {
      wsManager.connect();
      if (subscribedAssetsRef.current.size > 0) {
        wsManager.subscribeToAssets(
          Array.from(subscribedAssetsRef.current),
        );
      }
    }, 100);
  }, [disconnect, wsManager]);

  // ------------------------------------------------------------------
  // Mount effect — register listeners and initial asset subscriptions.
  // Runs once; all callbacks are stable so this never tears down on ticks.
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleIncomingData = (data: PriceData | Partial<PriceData>) => {
      if (!isVisible) return;
      pendingUpdatesRef.current.push(data);
    };

    const handleStatusChange = (status: boolean) => {
      setIsConnected(status);
      if (!status) {
        setError("WebSocket disconnected");
      } else {
        setError(null);
      }
    };

    wsManager.subscribeToMessages(handleIncomingData);
    wsManager.subscribeToStatus(handleStatusChange);

    // Ensure the singleton connection is open.
    wsManager.connect();

    // Register assets for this consumer instance.
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.subscribeToAssets(Array.from(subscribedAssetsRef.current));
    }

    return () => {
      // Deregister listeners on unmount — flush any buffered ticks first.
      flushPendingUpdates();
      wsManager.unsubscribeFromMessages(handleIncomingData);
      wsManager.unsubscribeFromStatus(handleStatusChange);

      if (subscribedAssetsRef.current.size > 0) {
        wsManager.unsubscribeFromAssets(
          Array.from(subscribedAssetsRef.current),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `isVisible` is intentionally excluded: page-visibility pausing is handled
    // inside handleIncomingData, not by tearing down and restarting the effect.
  }, [wsManager, flushPendingUpdates, setError]);

  // Pause data delivery while the page is hidden — no state needed, handled
  // inside the message callback via the closure over `isVisible`.

  // Master layout clock — flush buffered price ticks at most once per frame
  // while the socket is connected, keeping all state writes off the critical
  // user-interaction lane.
  useRAFInterval(flushPendingUpdates, 350, isConnected);

  return {
    isConnected,
    lastUpdate,
    error,
    reconnectAttempts: 0, // Handled automatically at the WebSocketManager layer
    subscribeToAsset,
    unsubscribeFromAsset,
    disconnect,
    reconnect,
  };
}

// ---------------------------------------------------------------------------
// Public API — selector-based `useSocket`.
// ---------------------------------------------------------------------------

/**
 * Subscribe to WebSocket state with an optional selector to pick only the
 * properties your component needs. When the selector is provided, the hook
 * returns only the selected value, memoised so child components wrapped in
 * `React.memo` are not re-rendered by unrelated state changes.
 *
 * @example
 * // Re-renders only when `isConnected` changes.
 * const isConnected = useSocket(options, (s) => s.isConnected)
 *
 * @example
 * // Re-renders on every tick (same as calling without a selector).
 * const full = useSocket(options)
 */
export function useSocket<Selected = UseSocketReturn>(
  options?: UseSocketOptions,
  selector?: (state: UseSocketReturn) => Selected,
): Selected {
  const state = useSocketState(options ?? {});

  return useMemo(
    () => (selector ? selector(state) : (state as unknown as Selected)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selector,
      state.isConnected,
      state.lastUpdate,
      state.error,
      state.subscribeToAsset,
      state.unsubscribeFromAsset,
      state.disconnect,
      state.reconnect,
    ],
  );
}