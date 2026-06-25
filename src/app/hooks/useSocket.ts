"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

  // Set up the centralized connection channel observers
  useEffect(() => {
    // Connect the manager if it's not already connected
    wsManager.connect();

    // Listeners track updates globally from the single network resource channel
    const handleIncomingData = (data: any) => {
      if (!isVisible) return;
      // Only process the message if the local hook instance is interested in this specific asset update
      if (data.assetId && subscribedAssetsRef.current.has(data.assetId)) {
        pendingUpdatesRef.current.push(data);
      } else if (!data.assetId) {
        // Fallback for global packets
        pendingUpdatesRef.current.push(data);
      }
    };

    const handleStatusChange = (status: boolean) => {
      setIsConnected(status);
    };

    wsManager.subscribeToMessages(handleIncomingData);
    wsManager.subscribeToStatus(handleStatusChange);

    // Initial asset registrations
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.subscribeToAssets(Array.from(subscribedAssetsRef.current));
    }

    return () => {
      wsManager.unsubscribeFromMessages(handleIncomingData);
      wsManager.unsubscribeFromStatus(handleStatusChange);
      flushPendingUpdates();
    };
  }, [wsManager, isVisible, flushPendingUpdates]);

  const subscribeToAsset = useCallback((assetId: string) => {
    if (!subscribedAssetsRef.current.has(assetId)) {
      subscribedAssetsRef.current.add(assetId);
      wsManager.subscribeToAssets([assetId]);
    }
  }, [wsManager]);

  const unsubscribeFromAsset = useCallback((assetId: string) => {
    if (subscribedAssetsRef.current.has(assetId)) {
      subscribedAssetsRef.current.delete(assetId);
      wsManager.unsubscribeFromAssets([assetId]);
    }
  }, [wsManager]);

  const disconnect = useCallback(() => {
    // Manual local disconnection can simply clear local contextual tracking assets
    if (subscribedAssetsRef.current.size > 0) {
      wsManager.unsubscribeFromAssets(Array.from(subscribedAssetsRef.current));
    }
    setIsConnected(false);
  }, [wsManager]);

  const reconnect = useCallback(() => {
    wsManager.connect();
  }, [wsManager]);

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