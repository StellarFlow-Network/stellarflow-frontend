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
// Internal hook — manages all WebSocket state in one place.
// ---------------------------------------------------------------------------

function useSocketState(options: UseSocketOptions): UseSocketReturn {
  const {
    assetIds = [],
    errorTimeoutMs = 5000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<PriceData | null>(null);
  const { error, setError } = useErrorTimeout({ timeoutMs: errorTimeoutMs });
  
  // Local tracking of subscribed assets for this component lifecycle context
  const subscribedAssetsRef = useRef<Set<string>>(new Set(assetIds));
  const isVisible = usePageVisibility();
  const pendingUpdatesRef = useRef<(PriceData | Partial<PriceData>)[]>([]);

  const wsManager = WebSocketManager.getInstance();

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
  // update `lastUpdate` → recreate `connect` → effect fires → socket torn down.
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

      wsRef.current.onerror = (event: Event) => {
        setError("WebSocket connection error");
        console.error("WebSocket error:", event);
      };
    } catch (err) {
      setError("Failed to establish WebSocket connection");
      console.error("Connection error:", err);
    }
  }, [flushPendingUpdates, setError]);

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;

    const handleStatusChange = (status: boolean) => {
      setIsConnected(status);
    };

    wsManager.subscribeToMessages(handleIncomingData);
    wsManager.subscribeToStatus(handleStatusChange);

    // Initial asset registrations
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.subscribeToAssets(Array.from(subscribedAssetsRef.current));
    }

    setIsConnected(false);
  }, [flushPendingUpdates]);

  const reconnect = useCallback(() => {
    disconnect();
    manuallyDisconnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Set new reconnect timeout and track it
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (subscribedAssetsRef.current.size > 0) {
        connect();
      }
    }, 100);
  }, [disconnect, connect]);

  const subscribeToAsset = useCallback((assetId: string) => {
    if (!subscribedAssetsRef.current.has(assetId)) {
      subscribedAssetsRef.current.add(assetId);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "subscribe", assetIds: [assetId] }),
        );
      } else if (!wsRef.current) {
        connect();
      }
    }
  }, [connect]);

  const unsubscribeFromAsset = useCallback((assetId: string) => {
    if (subscribedAssetsRef.current.has(assetId)) {
      subscribedAssetsRef.current.delete(assetId);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "unsubscribe", assetIds: [assetId] }),
        );
      }

      if (subscribedAssetsRef.current.size === 0) {
        disconnect();
      }
    }
  }, [disconnect]);

  // Both `connect` and `disconnect` are now stable (empty dep arrays), so this
  // effect only runs once on mount and once on unmount — never on data ticks.
  useEffect(() => {
    if (subscribedAssetsRef.current.size > 0) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Dedicated cleanup guard to ensure refs are released on unmount even if the
  // effect above runs in strict-mode double-invocation.
  useEffect(() => {
    return () => {

      // Flush any remaining pending updates
      flushPendingUpdates();

  const disconnect = useCallback(() => {
    // Manual local disconnection can simply clear local contextual tracking assets
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.unsubscribeFromAssets(Array.from(subscribedAssetsRef.current));
    }
    setIsConnected(false);
  }, [wsManager]);

    if (!manuallyDisconnectedRef.current) {
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      if (subscribedAssetsRef.current.size > 0) {
        connect();
      }
    }
  }, [isVisible, connect]);

  // Master layout clock batching matches performance guidelines
  useRAFInterval(
    flushPendingUpdates,
    350,
    isConnected
  );

  return {
    isConnected,
    lastUpdate,
    error,
    reconnectAttempts: 0, // Handled automatically at network class layer now
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
    [selector, state.isConnected, state.lastUpdate, state.error, state.subscribeToAsset, state.unsubscribeFromAsset, state.disconnect, state.reconnect],
  );
}