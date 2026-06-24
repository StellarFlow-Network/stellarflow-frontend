"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shimmer,
  MapSkeleton,
  RateSparklineSkeleton,
  PriceFeedCardSkeleton,
  DashboardTrafficChartSkeleton,
} from "@/components/skeletons";
import { useMounted } from "@/app/hooks/useMounted";
import WebSocketTest from "./components/test/WebSocketTest";

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
  loading: () => <PriceFeedCardSkeleton />,
});

const DashboardTrafficChart = dynamic(
  () => import("./components/DashboardTrafficChart"),
  {
    ssr: false,
    loading: () => <DashboardTrafficChartSkeleton />,
  },
);

interface RateCard {
  currency: string;
  rate: number;
  trend: number;
  sparklineData: number[];
}

function DashboardSkeleton() {
  return (
    <>
      <section className="min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-6" aria-busy="true">
        <RateSparklineSkeleton />
        <RateSparklineSkeleton />
        <RateSparklineSkeleton />
      </section>

      <section className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="min-w-0 w-full max-w-full aspect-auto sm:aspect-4/3 min-h-[260px] sm:min-h-[320px] overflow-hidden">
          <div className="flex h-full min-h-[320px] flex-col rounded-[28px] border border-[#A7C957]/30 bg-[#0A121E] p-6 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
            <div className="mb-4 space-y-2">
              <Shimmer className="h-3 w-24 rounded-md" />
              <Shimmer className="h-8 w-44 rounded-md" />
            </div>
            <Shimmer className="h-full w-full rounded-[24px]" />
          </div>
        </div>
      </section>

      <section className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="min-w-0 w-full max-w-full aspect-auto sm:aspect-4/3 min-h-[260px] sm:min-h-[320px] overflow-hidden">
          <PriceFeedCardSkeleton />
        </div>
      </section>

      <section
        className="content-visibility-auto space-y-4"
        style={{ "--content-visibility-fallback": "1px 520px" } as React.CSSProperties}
      >
        <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">
          Live Network Map
        </h2>
        <MapSkeleton />
      </section>

      <section
        className="content-visibility-auto grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]"
        style={{ "--content-visibility-fallback": "1px 620px" } as React.CSSProperties}
      >
        <DashboardTrafficChartSkeleton />

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
    </>
  );
}

export default function DashboardInteractive({
  rateCards,
}: {
  rateCards: RateCard[];
}) {
  const mounted = useMounted();
  const [cardsReady, setCardsReady] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => setCardsReady(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      {/* Local FX rates with memoized sparklines */}
      <section className="min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {rateCards.map((card, index) => (
          <motion.div
            key={card.currency}
            className="min-w-0"
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
      <section className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="min-w-0 w-full max-w-full aspect-auto sm:aspect-4/3 min-h-[260px] sm:min-h-[320px] overflow-hidden">
          <PriceFeedCard refreshInterval={30000} />
        </div>
      </section>

      {/* WebSocket Test Component */}
      <section className="flex justify-center">
        <WebSocketTest />
      </section>

      {/* Live Network Map */}
      <section
        className="content-visibility-auto space-y-4"
        style={{ "--content-visibility-fallback": "1px 520px" } as React.CSSProperties}
      >
        <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">
          Live Network Map
        </h2>
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
      </section>

      {/* Chart section */}
      <section
        className="content-visibility-auto grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]"
        style={{ "--content-visibility-fallback": "1px 620px" } as React.CSSProperties}
      >
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
              Live chart
            </span>
          </div>

          <DashboardTrafficChart />
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
    </>
  );
}
