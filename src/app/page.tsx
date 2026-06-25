import React from "react";
import Nav from "./components/nav";
import FloatingSidebar from "./components/FloatingSidebar";
import SystemStats from "./components/SystemStats";
import ModularStatsCard from "./components/ModularStatsCard";
import RelayerStatusTable from "./components/RelayerStatusTable";
import DashboardInteractive from "./DashboardInteractive";
import { SocketProvider } from "./components/providers/SocketProvider";

const mockRelayers = [
  { id: "r1", name: "Abuja Relayer", status: "Online" as const, latency: 34 },
  { id: "r2", name: "Lagos Relayer", status: "Syncing" as const, latency: 72 },
  { id: "r3", name: "Cape Town Relayer", status: "Online" as const, latency: 48 },
];

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

export default function Page() {
  return (
    <div className="min-h-screen bg-[#020817] text-white selection:bg-[#CBF34D]/30 overflow-x-hidden">
      <Nav />
      <FloatingSidebar />

      <main className="min-w-0 px-4 py-8 pl-16 sm:pl-20 md:px-8 lg:px-10 xl:px-12 md:pl-24 md:pr-8 md:py-16">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* System At-A-Glance Stats Section */}
          <SystemStats />

          {/* Server-rendered stats cards — no JS required for initial paint */}
          <section className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

          {/* Client-rendered interactive sections */}
          <SocketProvider>
            <DashboardInteractive rateCards={rateCards} />
          </SocketProvider>

          {/* Relayer Status Table — server-rendered static HTML */}
          <section
            className="content-visibility-auto space-y-4"
            style={{ "--content-visibility-fallback": "1px 220px" } as React.CSSProperties}
          >
            <h2 className="text-xl font-semibold text-white uppercase tracking-wider mb-4">
              Relayer Network Status
            </h2>
            <RelayerStatusTable relayers={mockRelayers} />
          </section>
        </div>
      </main>
    </div>
  );
}
