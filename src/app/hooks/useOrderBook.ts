"use client";

/**
 * useOrderBook — subscribes a single asset to live order book snapshots over
 * the shared WebSocketManager singleton (same transport `useSocket` uses for
 * price ticks, distinguished by message type). Mirrors `useSocket`'s
 * consumer-lifecycle pattern: `addConsumer`/`removeConsumer` keeps the
 * underlying socket alive only while at least one hook instance is mounted.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderBookSnapshot } from "@/types";
import type { AssetSymbol } from "@/config/assetSymbols";
import { WebSocketManager } from "@/utils/WebSocketManager";
import { usePageVisibility } from "./usePageVisibility";

export interface UseOrderBookOptions {
  assetId: AssetSymbol;
  /** Number of price levels to keep per side. Defaults to 10. */
  depth?: number;
}

export interface OrderBookSpread {
  /** Best ask minus best bid, in quote units. Null when a side is empty. */
  absolute: number | null;
  /** Spread as a percentage of the mid price. Null when not computable. */
  percentage: number | null;
  /** Best bid price, or null when the bid side is empty. */
  bestBid: number | null;
  /** Best ask price, or null when the ask side is empty. */
  bestAsk: number | null;
  /** Mid price between best bid and best ask, or null. */
  midPrice: number | null;
  /** Total quote units available across all returned ask levels. */
  askLiquidity: number;
  /** Total quote units available across all returned bid levels. */
  bidLiquidity: number;
}

export interface UseOrderBookReturn {
  orderBook: OrderBookSnapshot | null;
  isConnected: boolean;
  /** Derived spread / liquidity metrics for the current snapshot. */
  spread: OrderBookSpread | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readPrice(level: unknown): number | null {
  if (Array.isArray(level)) {
    return toNumber(level[0]);
  }
  if (level && typeof level === "object") {
    const record = level as Record<string, unknown>;
    return toNumber(record.price ?? record.p);
  }
  return null;
}

function readQty(value: unknown): number {
  if (Array.isArray(value)) {
    return toNumber(value[1]) ?? 0;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return toNumber(record.quantity ?? record.size ?? record.q) ?? 0;
  }
  return 0;
}

function computeSpread(snapshot: OrderBookSnapshot | null): OrderBookSpread | null {
  if (!snapshot) return null;

  const bestBid = snapshot.bids.length > 0 ? readPrice(snapshot.bids[0]) : null;
  const bestAsk = snapshot.asks.length > 0 ? readPrice(snapshot.asks[0]) : null;

  const askLiquidity = snapshot.asks.reduce((total, level) => total + readQty(level), 0);
  const bidLiquidity = snapshot.bids.reduce((total, level) => total + readQty(level), 0);

  if (bestBid === null || bestAsk === null) {
    return {
      absolute: null,
      percentage: null,
      bestBid,
      bestAsk,
      midPrice: null,
      askLiquidity,
      bidLiquidity,
    };
  }

  const absolute = bestAsk - bestBid;
  const midPrice = (bestAsk + bestBid) / 2;
  const percentage = midPrice > 0 ? (absolute / midPrice) * 100 : null;

  return {
    absolute,
    percentage,
    bestBid,
    bestAsk,
    midPrice,
    askLiquidity,
    bidLiquidity,
  };
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

  const spread = useMemo(() => computeSpread(orderBook), [orderBook]);

  return { orderBook, isConnected, spread };
}
