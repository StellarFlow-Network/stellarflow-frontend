"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { PriceData } from "@/types";
import { useErrorTimeout } from "./useErrorTimeout";
import { usePageVisibility } from "./usePageVisibility";
import { useRAFInterval } from "./useRAFInterval";
import type { AssetSymbol } from "@/config/assetSymbols";
import { WebSocketManager } from "@/utils/WebSocketManager";

interface SocketMessage {
  type: "price_update" | "delta_update";
  assetId?: string;
  data: PriceData | Partial<PriceData>;
  timestamp: number;
}

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
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { error, setError } = useErrorTimeout({ timeoutMs: errorTimeoutMs });

  // Local tracking of subscribed assets for this component lifecycle context
  const subscribedAssetsRef = useRef<Set<string>>(new Set(assetIds));
  const isVisible = usePageVisibility();

  // Batch pending WS message payloads; flushed by the RAF interval below so
  // we never write state more than once per animation frame.
  const pendingUpdatesRef = useRef<(PriceData | Partial<PriceData>)[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pageVisibleRef = useRef(true);
  const manuallyDisconnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(options.maxReconnectAttempts ?? 5);
  const reconnectIntervalRef = useRef(options.reconnectInterval ?? 3000);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // `connect` has an empty dependency array because every value it needs is
  // accessed through a ref.  This breaks the cycle where a WS message would
  // update `lastUpdate` -> recreate `connect` -> effect fires -> socket torn down.
  const connect = useCallback(function doConnect() {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    pageVisibleRef.current = true;
    manuallyDisconnectedRef.current = false;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);

        if (subscribedAssetsRef.current.size > 0) {
          wsRef.current?.send(
            JSON.stringify({
              type: "subscribe",
              assetIds: Array.from(subscribedAssetsRef.current),
            }),
          );
        }
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        if (!pageVisibleRef.current) return;

        try {
          const message: SocketMessage = JSON.parse(event.data as string);

          if (
            message.type === "price_update" ||
            message.type === "delta_update"
          ) {
            // Add to pending updates instead of updating state directly
            pendingUpdatesRef.current.push(message.data);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      wsRef.current.onclose = (event: CloseEvent) => {
        setIsConnected(false);

        // Flush any remaining pending updates
        flushPendingUpdates();

        // Use ref for reconnect counter — avoids stale closure.
        if (
          !event.wasClean &&
          !manuallyDisconnectedRef.current &&
          pageVisibleRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttemptsRef.current
        ) {
          reconnectAttemptsRef.current += 1;
          setReconnectAttempts(reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (subscribedAssetsRef.current.size > 0) {
              doConnect();
            }
          }, reconnectIntervalRef.current);
        }
      };

      wsRef.current.onerror = () => {
        setError("WebSocket connection error");
      };
    } catch (err) {
      setError("Failed to establish WebSocket connection");
      console.error("Connection error:", err);
    }
  }, [flushPendingUpdates, setError]);

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (subscribedAssetsRef.current.size > 0) {
      wsManager.unsubscribeFromAssets(Array.from(subscribedAssetsRef.current));
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
    manuallyDisconnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Set new reconnect timeout and track it
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
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

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.subscribeToAssets(Array.from(subscribedAssetsRef.current));
    }

    return () => {
      flushPendingUpdates();
    };
  }, [flushPendingUpdates]);

  // Freeze message processing when the page is hidden; resume when visible.
  useEffect(() => {
    pageVisibleRef.current = isVisible;

    if (isVisible) {
      if (
        !manuallyDisconnectedRef.current &&
        subscribedAssetsRef.current.size > 0
      ) {
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        connect();
      }
    } else {
      if (wsRef.current) {
        manuallyDisconnectedRef.current = true;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
    }
  }, [isVisible, connect]);

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
    reconnectAttempts,
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
