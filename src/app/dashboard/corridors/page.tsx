"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useCorridorMetricsWithFallback } from "../../hooks/useCorridorMetrics";

const CorridorSpreadTable = dynamic(() => import("./CorridorSpreadTable"), {
  ssr: false,
  loading: () => (
    <div className="h-[28rem] rounded-3xl bg-neutral-900/80 animate-pulse" />
  ),
});

export default function CorridorMonitorPage() {
  const { data, isFetching } = useCorridorMetricsWithFallback();
  const { metrics, bids, asks } = data;

  const [activePair, setActivePair] = useState<string>("USD / NGN");

  const maxVolume = useMemo(() => {
    const allEntries = [...bids, ...asks];
    return Math.max(...allEntries.map((e) => e.total), 1);
  }, [bids, asks]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans selection:bg-lime-500 selection:text-black">
      {/* Header Container */}
      <div className="mb-8 border-b border-neutral-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Regional Liquidity & Corridor Monitor
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time latency metrics, depth analysis, and spreads for African
            fiat telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          <span
            className={`w-2 h-2 rounded-full ml-2 ${
              isFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            }`}
          />
          <span className="text-xs font-mono text-neutral-400 pr-2">
            {isFetching
              ? "SYNCING FRESH METRICS"
              : "LIVE INGESTION MATRIX ACTIVE"}
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Module 1: Corridor Performance Grid */}
        <div className="xl:col-span-2 space-y-6">
          <CorridorSpreadTable
            metrics={metrics}
            activePair={activePair}
            onSelectPair={setActivePair}
          />

          {/* Module 2: Synthetic Analytics / Flow Summary Component */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-mono text-neutral-400 block mb-1">
                AGGREGATED 24H FLOW
              </span>
              <span className="text-2xl font-bold font-mono text-neutral-100">
                $7,020,000
              </span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-mono text-neutral-400 block mb-1">
                AVERAGE NETWORK SPREAD
              </span>
              <span className="text-2xl font-bold font-mono text-lime-400">
                0.35%
              </span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-mono text-neutral-400 block mb-1">
                GLOBAL INGESTION HEALTH
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                99.98%
              </span>
            </div>
          </div>
        </div>

        {/* Module 3: Aggregated Order Book Depth Component */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-neutral-200">
                Order Book Depth
              </h2>
              <span className="text-xs font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                {activePair}
              </span>
            </div>

            {/* Asks (Sells) Table Area */}
            <div className="space-y-1 mb-4 flex flex-col-reverse">
              {asks.map((ask, index) => (
                <div
                  key={`ask-${index}`}
                  className="relative flex justify-between text-xs font-mono py-1 px-2 group overflow-hidden"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 left-0 bg-red-950/20 transition-transform duration-300 pointer-events-none will-change:transform"
                    style={{ 
                      transformOrigin: 'right',
                      transform: `scaleX(${(ask.total / maxVolume)})` 
                    }}
                  />
                  <span className="text-red-400 relative z-10">
                    {ask.price.toFixed(2)}
                  </span>
                  <span className="text-neutral-300 relative z-10">
                    {ask.amount}
                  </span>
                  <span className="text-neutral-500 relative z-10">
                    {ask.total}
                  </span>
                </div>
              ))}
            </div>

            {/* Spread Intercept Bar */}
            <div className="border-y border-neutral-800 py-1.5 px-2 my-2 text-center text-xs font-mono bg-neutral-950/50">
              <span className="text-neutral-400">Spread Intercept: </span>
              <span className="text-lime-400 font-bold">0.80 NGN</span>
            </div>

            {/* Bids (Buys) Table Area */}
            <div className="space-y-1">
              {bids.map((bid, index) => (
                <div
                  key={`bid-${index}`}
                  className="relative flex justify-between text-xs font-mono py-1 px-2 group overflow-hidden"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-950/20 transition-all duration-300 pointer-events-none"
                    style={{ width: "100%", transform: `scaleX(${(bid.total / maxVolume)})`, transformOrigin: "left", willChange: "transform" }}
                  />
                  <span className="text-emerald-400 relative z-10">
                    {bid.price.toFixed(2)}
                  </span>
                  <span className="text-neutral-300 relative z-10">
                    {bid.amount}
                  </span>
                  <span className="text-neutral-500 relative z-10">
                    {bid.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-800 pt-4">
            <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">
              * Order book data aggregates local fiat trading books with
              underlying Stellar DEX liquidity pools utilizing specific paths.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}