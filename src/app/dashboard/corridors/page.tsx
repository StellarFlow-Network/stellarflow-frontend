"use client";

import React, { useState, useEffect, useMemo } from "react";

// Strict interface types for strict compile checks
interface CorridorMetrics {
  pair: string;
  source: string;
  rate: number;
  spread: number;
  volume24h: number;
  latencyMs: number;
  status: "optimal" | "degraded" | "critical";
}

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export default function CorridorMonitorPage() {
  // Mock initialization states matching expected real-time socket streams
  const [metrics, setMetrics] = useState<CorridorMetrics[]>([
    { pair: "USD / NGN", source: "Binance / Local B2C", rate: 1485.50, spread: 0.12, volume24h: 4250000, latencyMs: 45, status: "optimal" },
    { pair: "XLM / KES", source: "Stellar DEX / Luno", rate: 16.40, spread: 0.25, volume24h: 1850000, latencyMs: 120, status: "optimal" },
    { pair: "NGN / GHS", source: "Cross-Corridor Implied", rate: 0.092, spread: 0.68, volume24h: 920000, latencyMs: 240, status: "degraded" },
  ]);

  const [activePair, setActivePair] = useState<string>("USD / NGN");

  // Mock static data layout for order book matching exact asset scaling
  const bids: OrderBookEntry[] = [
    { price: 1485.10, amount: 2500, total: 2500 },
    { price: 1484.80, amount: 4800, total: 7300 },
    { price: 1484.20, amount: 12500, total: 19800 },
  ];

  const asks: OrderBookEntry[] = [
    { price: 1485.90, amount: 3100, total: 3100 },
    { price: 1486.30, amount: 6200, total: 9300 },
    { price: 1487.00, amount: 15000, total: 24300 },
  ];

  // Dynamic performance optimization: Memoize totals calculation
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
            Real-time latency metrics, depth analysis, and spreads for African fiat telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-2" />
          <span className="text-xs font-mono text-neutral-400 pr-2">LIVE INGESTION MATRIX ACTIVE</span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Module 1: Corridor Performance Grid */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
            <h2 className="text-lg font-semibold mb-4 text-neutral-200 flex items-center gap-2">
              <span>🔀</span> Cross-Border Exchange Corridors
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs text-neutral-400 uppercase font-mono tracking-wider">
                    <th className="py-3 px-4">Asset Pairing</th>
                    <th className="py-3 px-4">Telemetry Sources</th>
                    <th className="py-3 px-4 text-right">Implied Rate</th>
                    <th className="py-3 px-4 text-right">Market Spread</th>
                    <th className="py-3 px-4 text-right">24h Vol (USDC)</th>
                    <th className="py-3 px-4 text-right">Ingestion Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50 text-sm">
                  {metrics.map((item) => (
                    <tr 
                      key={item.pair} 
                      onClick={() => setActivePair(item.pair)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        activePair === item.pair ? "bg-neutral-800/40 border-l-2 border-lime-500" : "hover:bg-neutral-900"
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-neutral-200">{item.pair}</td>
                      <td className="py-3 px-4 text-xs text-neutral-400">{item.source}</td>
                      <td className="py-3 px-4 text-right font-mono text-lime-400">
                        {item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-500">{item.spread}%</td>
                      <td className="py-3 px-4 text-right font-mono">${item.volume24h.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.status === "optimal" ? "bg-emerald-950/50 text-emerald-400" : "bg-amber-950/50 text-amber-400"
                        }`}>
                          {item.latencyMs}ms
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Module 2: Synthetic Analytics / Flow Summary Component */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-mono text-neutral-400 block mb-1">AGGREGATED 24H FLOW</span>
              <span className="text-2xl font-bold font-mono text-neutral-100">$7,020,000</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-mono text-neutral-400 block mb-1">AVERAGE NETWORK SPREAD</span>
              <span className="text-2xl font-bold font-mono text-lime-400">0.35%</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-mono text-neutral-400 block mb-1">GLOBAL INGESTION HEALTH</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">99.98%</span>
            </div>
          </div>
        </div>

        {/* Module 3: Aggregated Order Book Depth Component */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-neutral-200">Order Book Depth</h2>
              <span className="text-xs font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                {activePair}
              </span>
            </div>

            {/* Asks (Sells) Table Area */}
            <div className="space-y-1 mb-4 flex flex-col-reverse">
              {asks.map((ask, index) => (
                <div key={`ask-${index}`} className="relative flex justify-between text-xs font-mono py-1 px-2 group">
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-red-950/20 transition-all duration-300 pointer-events-none" 
                    style={{ width: `${(ask.total / maxVolume) * 100}%` }}
                  />
                  <span className="text-red-400 relative z-10">{ask.price.toFixed(2)}</span>
                  <span className="text-neutral-300 relative z-10">{ask.amount}</span>
                  <span className="text-neutral-500 relative z-10">{ask.total}</span>
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
                <div key={`bid-${index}`} className="relative flex justify-between text-xs font-mono py-1 px-2 group">
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-emerald-950/20 transition-all duration-300 pointer-events-none" 
                    style={{ width: `${(bid.total / maxVolume) * 100}%` }}
                  />
                  <span className="text-emerald-400 relative z-10">{bid.price.toFixed(2)}</span>
                  <span className="text-neutral-300 relative z-10">{bid.amount}</span>
                  <span className="text-neutral-500 relative z-10">{bid.total}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-800 pt-4">
            <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">
              * Order book data aggregates local fiat trading books with underlying Stellar DEX liquidity pools utilizing specific paths.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
