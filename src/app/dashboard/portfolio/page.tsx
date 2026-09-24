"use client";

import PortfolioSummary from "@/components/analytics/PortfolioSummary";

export default function PortfolioTrackerPage() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mb-8 border-b border-neutral-800 pb-6">
        <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Portfolio Tracker
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Aggregate net worth, allocation, and yield performance across your
          wallet, liquidity pools, and vaults.
        </p>
      </div>

      <PortfolioSummary />
    </div>
  );
}
