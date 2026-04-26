import React from "react";
import { Loader2 } from "lucide-react";
import Nav from "./components/nav";
import FloatingSidebar from "./components/FloatingSidebar";
import SystemStats from "./components/SystemStats";
import ModularStatsCard from "./components/ModularStatsCard";
import PriceFeedCard from "./components/PriceFeedCard";
import RateSparklineCard from "./components/RateSparklineCard";
import RelayerStatusTable from "./components/RelayerStatusTable";
import SmartContractLogViewer from "./components/SmartContractLogViewer";

const mockRelayers = [
  { id: "r1", name: "Abuja Relayer", status: "Online", latency: 34 },
  { id: "r2", name: "Lagos Relayer", status: "Syncing", latency: 72 },
  { id: "r3", name: "Cape Town Relayer", status: "Online", latency: 48 },
];

const rateCards = [
  {
    currency: "NGN",
    rate: 13.42,
    trend: 1.8,
    sparklineData: [12.9, 13.1, 13.0, 13.3, 13.5, 13.4, 13.42],
  },
  {
    currency: "KES",
    rate: 0.30,
    trend: -0.6,
    sparklineData: [0.31, 0.305, 0.302, 0.300, 0.299, 0.301, 0.300],
  },
  {
    currency: "GHS",
    rate: 0.11,
    trend: 0.9,
    sparklineData: [0.108, 0.109, 0.110, 0.111, 0.110, 0.109, 0.110],
  },
];

const mockTransactionEvents = [
  {
    id: "tx-1",
    hash: "0x7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    ledger: 52345678,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    sourceAccount: "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7",
    contractAddress: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3",
    functionName: "update_price",
    status: "success",
    gasUsed: 12453,
    memo: "NGN/XLM price update",
  },
  {
    id: "tx-2",
    hash: "0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0",
    ledger: 52345672,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sourceAccount: "0xb9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8",
    contractAddress: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
    functionName: "submit_swap",
    status: "success",
    gasUsed: 28765,
  },
  {
    id: "tx-3",
    hash: "0x9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1",
    ledger: 52345665,
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    sourceAccount: "0xc8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7",
    contractAddress: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5",
    functionName: "mint_tokens",
    status: "pending",
    gasUsed: 0,
    memo: "USDC liquidity provision",
  },
  {
    id: "tx-4",
    hash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    ledger: 52345658,
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    sourceAccount: "0xd7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6",
    contractAddress: "0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6",
    functionName: "claim_reward",
    status: "failed",
    gasUsed: 8923,
    memo: "Staking rewards distribution",
  },
  {
    id: "tx-5",
    hash: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    ledger: 52345651,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    sourceAccount: "0xe6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5",
    contractAddress: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7",
    functionName: "update_price",
    status: "success",
    gasUsed: 11567,
    memo: "KES/XLM price update",
  },
];

const LoadingChartState = () => {
  return (
    <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0B1324] px-6 py-10 text-center shadow-[0_24px_80px_rgba(2,8,23,0.6)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(203,243,77,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      <div className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-[#D9F99D]/35 to-transparent" />

      <div className="relative flex mt-8 h-18 w-18 items-center justify-center rounded-full border border-[#D9F99D]/25 bg-[#111B2F]/90 shadow-[0_0_50px_rgba(203,243,77,0.14)]">
        <Loader2 className="h-8 w-8 animate-spin text-[#D9F99D]" strokeWidth={2.4} />
      </div>

      <div className="relative mt-6 max-w-md space-y-2">
        <p className="text-2xl font-semibold tracking-tight text-white">
          Loading data...
        </p>
        <p className="text-sm leading-6 text-slate-300">
          The oracle feed is still syncing. This chart will populate once the
          latest aggregated values arrive.
        </p>
      </div>

      <div className="relative mt-8 flex w-full max-w-xs items-end gap-3">
        <span className="h-4 w-1/4 animate-pulse rounded-full bg-[#D9F99D]/20" />
        <span className="h-4 w-1/3 animate-pulse rounded-full bg-[#D9F99D]/30" />
        <span className="h-4 w-1/5 animate-pulse rounded-full bg-[#D9F99D]/20" />
        <span className="h-4 w-1/4 animate-pulse rounded-full bg-[#D9F99D]/25" />
      </div>
    </div>
  );
};

const page = () => {
  return (
    <div className="min-h-screen bg-[#020817] text-white selection:bg-[#CBF34D]/30">
      <Nav />
      {/* Sidebar - Positioned for the dashboard layout */}
      <FloatingSidebar />
      
      <main className="pl-24 pr-8 py-10 md:py-16">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* System At-A-Glance Stats Section */}
          <SystemStats />

          {/* Modular Stats Cards Section */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ModularStatsCard label="Network Throughput" value={1245670} trend={12.5} unit="TPS" />
            <ModularStatsCard label="Total Value Locked" value={85432000} trend={-2.4} unit="USD" />
            <ModularStatsCard label="Active Nodes" value={1240} trend={0.8} />
            <ModularStatsCard label="Oracle Accuracy" value={99.98} trend={0.01} unit="%" />
          </section>

          {/* Local FX rates with memoized sparklines */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {rateCards.map((card) => (
              <RateSparklineCard key={card.currency} {...card} />
            ))}
          </section>

          {/* Dynamic Price Feed — NGN/XLM */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <PriceFeedCard refreshInterval={30000} />
          </section>
          
          {/* Relayer Status Table */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">Relayer Network Status</h2>
            <RelayerStatusTable relayers={mockRelayers} />
          </section>

          {/* Smart Contract Log Viewer */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">Smart Contract Events</h2>
            <SmartContractLogViewer events={mockTransactionEvents} />
          </section>

          {/* Chart loading state and source table shell */}
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
            <div className="rounded-[32px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/85">
                    NGN/XLM (24h)
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    Total Data Traffic
                  </h3>
                </div>
                <span className="rounded-full border border-[#D9F99D]/20 bg-[#D9F99D]/10 px-3 py-1 text-xs font-medium text-[#D9F99D]">
                  Live chart pending
                </span>
              </div>

              <LoadingChartState />
            </div>

            <div className="rounded-[32px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
              <div className="mb-5 border-b border-white/10 pb-4">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/85">
                  Raw source data
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  Incoming oracle table
                </h3>
              </div>

              <div className="space-y-3 rounded-[24px] border border-white/8 bg-[#0F172A] p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Provider feed</span>
                  <span>Status</span>
                </div>
                <div className="h-px bg-white/8" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-white/4 px-4 py-3 text-sm">
                    <span className="text-[#D9F99D]">Preparing rows</span>
                    <span className="text-slate-400">Loading</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/4 px-4 py-3 text-sm">
                    <span className="text-[#D9F99D]">Verifying sync</span>
                    <span className="text-slate-400">Pending</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default page;