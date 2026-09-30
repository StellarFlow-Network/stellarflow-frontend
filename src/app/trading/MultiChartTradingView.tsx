"use client";

import dynamic from "next/dynamic";

/**
 * Four `lightweight-charts` canvases are far too much work to run during a
 * server render, and the grid adopts its saved layout from local storage on
 * mount, so it is client-only by construction.
 */
const MultiChartGrid = dynamic(
  () => import("@/components/trading/MultiChartGrid").then((module) => module.MultiChartGrid),
  { ssr: false, loading: () => (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      aria-hidden="true"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="aspect-[16/10] min-h-[220px] rounded-2xl border border-white/10 bg-[#0c120f]"
        />
      ))}
    </div>
  ) },
);

export default function MultiChartTradingView() {
  return (
    <main className="mx-auto w-full max-w-[1760px] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Multi-Chart Trading View</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Watch up to four Stellar pairs at the same time. Every cell keeps its own market and candle
          interval, and the layout you pick is remembered on this device.
        </p>
      </header>

      <MultiChartGrid />
    </main>
  );
}
