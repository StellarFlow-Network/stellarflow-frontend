"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import Nav from "./components/nav";
import FloatingSidebar from "./components/FloatingSidebar";
import SystemStats from "./components/SystemStats";
import ModularStatsCard from "./components/ModularStatsCard";
import PriceFeedCard from "./components/PriceFeedCard";
import RateSparklineCard from "./components/RateSparklineCard";
import RelayerStatusTable from "./components/RelayerStatusTable";
import WebSocketTest from "./components/test/WebSocketTest";
import { Shimmer } from "@/components/skeletons/Shimmer";

const LiveNetworkMap = dynamic(() => import("@/app/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0B1324] px-6 py-10 text-center shadow-[0_24px_80px_rgba(2,8,23,0.6)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(203,243,77,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      <div className="relative flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-[#D9F99D]/90">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading live network map</span>
      </div>
    </div>
  ),
});

const mockRelayers = [
  { id: "r1", name: "Abuja Relayer", status: "Online", latency: 34 },
  { id: "r2", name: "Lagos Relayer", status: "Syncing", latency: 72 },
  { id: "r3", name: "Cape Town Relayer", status: "Online", latency: 48 },
];

// Mock rate cards data
const rateCards = [
  { currency: "NGN", rate: 750.50, change: 2.3 },
  { currency: "USD", rate: 0.12, change: -0.8 },
  { currency: "EUR", rate: 0.13, change: 1.2 },
];

const LoadingChartState = () => {
  return <MapSkeleton />;
};

export default function DashboardPage() {
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

          {/* WebSocket Test Component */}
          <section className="flex justify-center">
            <WebSocketTest />
          </section>
          
          {/* Relayer Status Table */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">Relayer Network Status</h2>
            <RelayerStatusTable relayers={mockRelayers} />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">
              Live Network Map
            </h2>
            <LiveNetworkMap />
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
                    <Shimmer className="h-4 w-12" />
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
