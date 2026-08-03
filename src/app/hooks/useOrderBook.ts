"use client";

/**
 * useOrderBook — subscribes a single asset to live order book snapshots over
 * the shared WebSocketManager singleton (same transport `useSocket` uses for
 * price ticks, distinguished by message type). Mirrors `useSocket`'s
 * consumer-lifecycle pattern: `addConsumer`/`removeConsumer` keeps the
 * underlying socket alive only while at least one hook instance is mounted.
 */

import { useCallback, useEffect, useState } from "react";
import type { OrderBookSnapshot } from "@/types";
import type { AssetSymbol } from "@/config/assetSymbols";
import { WebSocketManager } from "@/utils/WebSocketManager";
import { usePageVisibility } from "./usePageVisibility";

export interface UseOrderBookOptions {
  assetId: AssetSymbol;
  /** Number of price levels to keep per side. Defaults to 10. */
  depth?: number;
}

export interface UseOrderBookReturn {
  orderBook: OrderBookSnapshot | null;
  isConnected: boolean;
}

export function useOrderBook({ assetId, depth = 10 }: UseOrderBookOptions): UseOrderBookReturn {
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isVisible = usePageVisibility();
  const wsManager = WebSocketManager.getInstance();

  const handleOrderBook = useCallback(
    (snapshot: OrderBookSnapshot) => {
      if (!isVisible) return;
      if (snapshot.assetPair !== assetId) return;
      setOrderBook({
        ...snapshot,
        bids: snapshot.bids.slice(0, depth),
        asks: snapshot.asks.slice(0, depth),
      });
    },
    [assetId, depth, isVisible],
  );

  useEffect(() => {
    const handleStatus = (status: boolean) => setIsConnected(status);

    wsManager.subscribeToOrderBook(handleOrderBook);
    wsManager.subscribeToStatus(handleStatus);
    wsManager.addConsumer();
    wsManager.subscribeToAssets([assetId]);

    return () => {
      wsManager.unsubscribeFromOrderBook(handleOrderBook);
      wsManager.unsubscribeFromStatus(handleStatus);
      wsManager.unsubscribeFromAssets([assetId]);
      wsManager.removeConsumer();
    };
  }, [assetId, wsManager, handleOrderBook]);

  return { orderBook, isConnected };
}
