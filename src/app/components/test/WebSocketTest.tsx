"use client";

import React from "react";
import { useSocket } from "../../hooks/useSocket";
import { useMounted } from "@/app/hooks/useMounted";
import { Shimmer } from "@/components/skeletons/Shimmer";

function WebSocketTestSkeleton() {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-lg border border-white/10 bg-gray-900 p-4 text-white" aria-busy="true">
      <div className="space-y-4">
        <Shimmer className="h-6 w-48 rounded-md" />

        <div className="space-y-2 text-sm">
          <Shimmer className="h-8 w-full rounded-md" />
          <Shimmer className="h-8 w-full rounded-md" />
          <Shimmer className="h-8 w-full rounded-md" />
          <Shimmer className="h-24 w-full rounded-md" />
          <div className="flex gap-2 pt-2">
            <Shimmer className="h-8 flex-1 rounded-md" />
            <Shimmer className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebSocketTest() {
  const mounted = useMounted();
  const {
    isConnected,
    lastUpdate,
    error,
    reconnectAttempts,
    subscribeToAsset,
    unsubscribeFromAsset,
  } = useSocket({
    assetIds: ["NGN-XLM"],
    enableDeltaUpdates: true,
  });

  if (!mounted) {
    return <WebSocketTestSkeleton />;
  }

  return (
    <div className="mx-auto mt-8 max-w-md rounded-lg bg-gray-900 p-4 text-white">
      <h2 className="mb-4 text-xl font-bold">WebSocket Delta Test</h2>

      <div className="space-y-2 text-sm">
        <div
          className={`rounded px-3 py-1 ${
            isConnected ? "bg-green-600" : "bg-red-600"
          }`}
        >
          Status: {isConnected ? "Connected" : "Disconnected"}
        </div>

        <div className="rounded bg-gray-800 px-3 py-1">
          Reconnect Attempts: {reconnectAttempts}
        </div>

        {error && (
          <div className="rounded bg-red-900 px-3 py-1 text-red-200">
            Error: {error}
          </div>
        )}

        {lastUpdate && (
          <div className="rounded bg-blue-900 px-3 py-1">
            <div className="font-semibold">Last Update:</div>
            <div className="text-xs">
              Asset: {lastUpdate.assetPair}
              <br />
              Price: {lastUpdate.price.toFixed(6)}
              <br />
              Timestamp: {new Date(lastUpdate.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => subscribeToAsset("USD-XLM")}
            className="rounded bg-blue-600 px-3 py-1 text-xs hover:bg-blue-700"
          >
            Subscribe USD-XLM
          </button>
          <button
            onClick={() => unsubscribeFromAsset("USD-XLM")}
            className="rounded bg-orange-600 px-3 py-1 text-xs hover:bg-orange-700"
          >
            Unsubscribe USD-XLM
          </button>
        </div>
      </div>
    </div>
  );
}
