import React, { Suspense } from "react";
import { AdminStatsSkeleton } from "@/components/skeletons/AdminStatsSkeleton";
import AdminTabBar from "@/app/components/AdminTabBar";
import SystemStats from "@/app/components/SystemStats";
import ModularStatsCard from "@/app/components/ModularStatsCard";

/**
 * AdminStatsRows — intensive telemetry section.
 * Wrapped in its own Suspense slot so the header/nav/tab-bar above are
 * never blocked waiting for this data to resolve.
 */
function AdminStatsRows() {
  return (
    <div className="space-y-8">
      <SystemStats />
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="aspect-[16/10]">
          <ModularStatsCard label="Oracle Submissions" value={84320} trend={3.2} />
        </div>
        <div className="aspect-[16/10]">
          <ModularStatsCard label="Active Relayers" value={12} trend={0} />
        </div>
        <div className="aspect-[16/10]">
          <ModularStatsCard label="Pending Validations" value={7} trend={-1.4} />
        </div>
        <div className="aspect-[16/10]">
          <ModularStatsCard label="Contract Calls (24h)" value={15670} trend={8.1} unit="calls" />
        </div>
        <div className="aspect-[16/10]">
          <ModularStatsCard label="Data Accuracy" value={99.97} trend={0.02} unit="%" />
        </div>
        <div className="aspect-[16/10]">
          <ModularStatsCard label="Total Fees Collected" value={4823} trend={11.5} unit="XLM" />
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-8 md:px-10 md:py-16">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Static header — always renders immediately, never blocked */}
        <div>
          <h1 className="text-2xl font-bold text-[#99DC1B] tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time oracle telemetry and system health
          </p>
        </div>

        {/* Tab bar — static, zero data dependency */}
        <AdminTabBar />

        {/* Intensive stats rows isolated in a Suspense context slot.
            The static fallback skeleton cards are served immediately so users
            can read header text and navigate tabs without waiting for telemetry. */}
        <Suspense fallback={<AdminStatsSkeleton />}>
          <AdminStatsRows />
        </Suspense>
      </div>
    </main>
  );
}
