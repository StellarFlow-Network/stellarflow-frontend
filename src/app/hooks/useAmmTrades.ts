"use client";

/**
 * useAmmTrades — subscribes to executed AMM swaps over the shared
 * WebSocketManager singleton (same transport `useSocket`/`useOrderBook` use,
 * distinguished by message type). Mirrors `useOrderBook`'s consumer-lifecycle
 * pattern: `addConsumer`/`removeConsumer` keeps the underlying socket alive
 * only while at least one hook instance is mounted.
 *
 * Events are delivered through `onTrade` rather than React state: a busy pool
 * can emit many swaps per second, and routing each one through a `setState`
 * would re-render the whole subtree on every fill. The callback instead mutates
 * refs and schedules a single animation-frame flush, so a burst of N trades
 * costs exactly one commit. Consumers that *do* want re-renders can drive them
 * from a `useReducer`/`useState` bump inside the same callback.
 */

import { useEffect, useRef, useState } from "react";
import type { AmmTradeEvent } from "@/types";
import { WebSocketManager } from "@/utils/WebSocketManager";
import { usePageVisibility } from "./usePageVisibility";

export interface UseAmmTradesOptions {
  /** Called once per executed swap, on the socket callback path. */
  onTrade: (trade: AmmTradeEvent) => void;
  /** Only surface trades routed through this pool. Omit to accept every pool. */
  poolId?: string;
}

export interface UseAmmTradesReturn {
  isConnected: boolean;
}

export function useAmmTrades({
  onTrade,
  poolId,
}: UseAmmTradesOptions): UseAmmTradesReturn {
  const [isConnected, setIsConnected] = useState(false);

  // Keep the latest callback in a ref so consumers can pass an inline closure
  // without re-subscribing the socket on every render.
  const onTradeRef = useRef(onTrade);
  useEffect(() => {
    onTradeRef.current = onTrade;
  }, [onTrade]);

  const isVisible = usePageVisibility();
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  const poolIdRef = useRef(poolId);
  useEffect(() => {
    poolIdRef.current = poolId;
  }, [poolId]);

  const wsManager = WebSocketManager.getInstance();

  useEffect(() => {
    const handleTrade = (trade: AmmTradeEvent) => {
      // Pause while the tab is backgrounded so a returning user is not
      // greeted by a burst of queued fills.
      if (!isVisibleRef.current) return;
      if (poolIdRef.current && trade.poolId !== poolIdRef.current) return;
      onTradeRef.current(trade);
    };

    const handleStatus = (status: boolean) => setIsConnected(status);

    wsManager.subscribeToTrades(handleTrade);
    wsManager.subscribeToStatus(handleStatus);
    wsManager.addConsumer();

    return () => {
      wsManager.unsubscribeFromTrades(handleTrade);
      wsManager.unsubscribeFromStatus(handleStatus);
      wsManager.removeConsumer();
    };
  }, [wsManager]);

  return { isConnected };
}
