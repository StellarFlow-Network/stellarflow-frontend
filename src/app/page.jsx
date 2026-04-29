"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import Nav from "./components/nav";
import useIntersectionObserver from "./hooks/useIntersectionObserver";
import FloatingSidebar from "./components/FloatingSidebar";
import SystemStats from "./components/SystemStats";
import ModularStatsCard from "./components/ModularStatsCard";
import RelayerStatusTable from "./components/RelayerStatusTable";
import WebSocketTest from "./components/test/WebSocketTest";
import {
  Shimmer,
  MapSkeleton,
  RateSparklineSkeleton,
} from "@/components/skeletons";

const LiveNetworkMap = dynamic(() => import("@/app/components/Map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const RateSparklineCard = dynamic(
  () => import("./components/RateSparklineCard"),
  {
    ssr: false,
    loading: () => <RateSparklineSkeleton />,
  },
);

const PriceFeedCard = dynamic(() => import("./components/PriceFeedCard"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-[28px] border border-[#A7C957]/30 bg-[#0B1324] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.6)]">
      <Shimmer className="h-full w-full rounded-2xl" />
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
  {
    currency: "NGN",
    rate: 750.5,
    trend: 2.3,
    sparklineData: [742, 744, 745, 748, 750, 749, 751],
  },
  {
    currency: "USD",
    rate: 0.12,
    trend: -0.8,
    sparklineData: [0.13, 0.13, 0.125, 0.124, 0.123, 0.122, 0.12],
  },
  {
    currency: "EUR",
    rate: 0.13,
    trend: 1.2,
    sparklineData: [0.124, 0.125, 0.126, 0.127, 0.128, 0.129, 0.13],
  },
];

const LoadingChartState = () => {
  return <MapSkeleton />;
};

export default function DashboardPage() {
  const [cardsReady, setCardsReady] = useState(false);
  const { ref: priceFeedRef, isVisible: isPriceFeedVisible } =
    useIntersectionObserver();
  const { ref: networkMapRef, isVisible: isNetworkMapVisible } =
    useIntersectionObserver();
  useEffect(() => {
    const id = requestAnimationFrame(() => setCardsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
            <div className="aspect-[16/10]">
              <ModularStatsCard
                label="Network Throughput"
                value={1245670}
                trend={12.5}
                unit="TPS"
              />
            </div>
            <div className="aspect-[16/10]">
              <ModularStatsCard
                label="Total Value Locked"
                value={85432000}
                trend={-2.4}
                unit="USD"
              />
            </div>
            <div className="aspect-[16/10]">
              <ModularStatsCard label="Active Nodes" value={1240} trend={0.8} />
            </div>
            <div className="aspect-[16/10]">
              <ModularStatsCard
                label="Oracle Accuracy"
                value={99.98}
                trend={0.01}
                unit="%"
              />
            </div>
          </section>

          {/* Local FX rates with memoized sparklines */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {rateCards.map((card, index) => (
              <motion.div
                key={card.currency}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 100,
                }}
              >
                <RateSparklineCard {...card} loading={!cardsReady} />
              </motion.div>
            ))}
          </section>

          {/* Dynamic Price Feed — NGN/XLM */}
          <section
            ref={priceFeedRef}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <div className="sm:col-span-2 lg:col-span-1 aspect-[4/3] min-h-[320px]">
              <PriceFeedCard
                refreshInterval={30000}
                isVisible={isPriceFeedVisible}
              />
            </div>
          </section>

          {/* WebSocket Test Component */}
          <section className="flex justify-center">
            <WebSocketTest />
          </section>

          {/* Relayer Status Table */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">
              Relayer Network Status
            </h2>
            <RelayerStatusTable relayers={mockRelayers} />
          </section>
          <section ref={networkMapRef} className="space-y-4">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">
              Live Network Map
            </h2>

            <AnimatePresence mode="wait">
              {isNetworkMapVisible ? (
                <motion.div
                  key="network-map"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 10 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                >
                  <LiveNetworkMap />
                </motion.div>
              ) : (
                <div className="min-h-[320px] rounded-[28px] border border-[#A7C957]/20 bg-[#0A1020] p-6 text-sm text-slate-400">
                  Live Network Map paused while off-screen.
                </div>
              )}
            </AnimatePresence>
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
}
