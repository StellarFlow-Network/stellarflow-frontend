"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PriceData } from "@/types";
import { useErrorTimeout } from "./useErrorTimeout";
import { usePageVisibility } from "./usePageVisibility";
import { useRAFInterval } from "./useRAFInterval";
import type { AssetSymbol } from "@/config/assetSymbols";

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
  /**
   * Timeout in milliseconds before automatically clearing WebSocket errors.
   * Set to 0 to disable auto-clear. Defaults to 5000ms.
   * @default 5000
   */
  errorTimeoutMs?: number;
}

interface UseSocketReturn {
  isConnected: boolean;
  lastUpdate: PriceData | null;
  error: string | null;
  reconnectAttempts: number;
  subscribeToAsset: (assetId: string) => void;
  unsubscribeFromAsset: (assetId: string) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    assetIds = [],
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    errorTimeoutMs = 5000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<PriceData | null>(null);
  const { error, setError } = useErrorTimeout({ timeoutMs: errorTimeoutMs });
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const subscribedAssetsRef = useRef<Set<string>>(new Set(assetIds));
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const manuallyDisconnectedRef = useRef(false);
  const isVisible = usePageVisibility();
  const pageVisibleRef = useRef(isVisible);
  
  // Batching refs for high-frequency updates
  const pendingUpdatesRef = useRef<(PriceData | Partial<PriceData>)[]>([]);

  // Refs keep options fresh inside callbacks without triggering re-renders or
  // causing `connect` to be recreated on every tick.
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts);
  const reconnectIntervalRef = useRef(reconnectInterval);

  // Sync option refs after render so in-flight callbacks always see the
  // latest values without making `connect` depend on them directly.
  // (Assigning to .current during render is forbidden by the React Compiler.)
  useEffect(() => {
    maxReconnectAttemptsRef.current = maxReconnectAttempts;
    reconnectIntervalRef.current = reconnectInterval;
  }, [maxReconnectAttempts, reconnectInterval]);

  // Flush pending updates to state
  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return;
    
    // Take all pending updates
    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current.length = 0;
    
    // Apply all updates in a single state commit
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

    // Flush any remaining pending updates
    flushPendingUpdates();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
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

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
  }, [flushPendingUpdates]);
  useEffect(() => {
    pageVisibleRef.current = isVisible;

    if (!isVisible) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "unsubscribe",
            assetIds: Array.from(subscribedAssetsRef.current),
          }),
        );
      }

      if (wsRef.current) {
        wsRef.current.close(1000, "Page hidden");
        wsRef.current = null;
      }

      setIsConnected(false);
      return;
    }

    if (!manuallyDisconnectedRef.current) {
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      if (subscribedAssetsRef.current.size > 0) {
        connect();
      }
    }
  }, [isVisible, connect]);

  // Master layout clock batching: flushes updates inline with the single RAF loop
  // every 350ms whenever the connection is alive and there are pending packets.
  useRAFInterval(
    flushPendingUpdates,
    350,
    isConnected
  );

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
