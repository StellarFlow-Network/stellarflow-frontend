"use client";

import React, { useEffect, useState, memo } from "react";
import { useSocket } from "../../hooks/useSocket";
import { useCentralizedPoll } from "../../hooks/useCentralizedPoll";
import { getTrendClasses } from "@/lib/styleVariants";

interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  change_24h?: number;
}

function LivePrices({ initialData }: any) {
  const [data, setData] = useState<PriceData[]>(initialData || []);

  // Use centralized polling instead of independent WebSocket connections
  // Issue #151: Shared Poll Controls for Financial Tickers
  const { isConnected, lastUpdate, error } = useSocket({
    assetIds: ["NGN-XLM", "USD-XLM", "EUR-XLM"],
    enableDeltaUpdates: true,
  });

  useEffect(() => {
    if (lastUpdate) {
      // Update the specific asset in the data array
      setData((prevData) => {
        const index = prevData.findIndex(
          (p) => p.symbol === lastUpdate.assetPair,
        );
        if (index !== -1) {
          const newData = [...prevData];
          newData[index] = {
            ...newData[index],
            price: lastUpdate.price,
            timestamp: lastUpdate.timestamp,
            change_24h: (lastUpdate as any).change_24h,
          };
          return newData;
        } else {
          // Add new asset if not found
          return [
            ...prevData,
            {
              symbol: lastUpdate.assetPair,
              price: lastUpdate.price,
              timestamp: lastUpdate.timestamp,
              change_24h: (lastUpdate as any).change_24h,
            },
          ];
        }
      });
    }
  }, [lastUpdate]);

  return (
    <div>
      <h2>Live Prices</h2>
      <div
        className={`text-xs mb-2 ${isConnected ? "text-green-400" : "text-yellow-400"}`}
        data-connection-status={isConnected ? "connected" : "disconnected"}
      >
        {isConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
      </div>
      {error && <div className="text-red-400 text-xs mb-2">Error: {error}</div>}
      {data?.map((p: PriceData) => {
        const isUp = (p.change_24h ?? 0) >= 0;
        const trendClasses = getTrendClasses(isUp);
        return (
          <div
            key={p.symbol}
            data-asset-symbol={p.symbol}
            data-trend={isUp ? "up" : "down"}
            className={`flex items-center gap-2 p-2 rounded ${trendClasses.container}`}
          >
            <span className="font-semibold">{p.symbol}:</span>
            <span className={trendClasses.text}>{p.price}</span>
            {p.change_24h !== undefined && (
              <span className="text-xs">
                {isUp ? "▲" : "▼"} {Math.abs(p.change_24h).toFixed(2)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(LivePrices);
