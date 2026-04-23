import React from "react";
import { Loader2 } from "lucide-react";
import Nav from "./components/nav";
import FloatingSidebar from "./components/FloatingSidebar";
import SystemStats from "./components/SystemStats";

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