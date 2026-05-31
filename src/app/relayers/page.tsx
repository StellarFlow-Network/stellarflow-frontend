"use client";

import React, { useState, useMemo } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { useTransformedCustomAddressField } from "@/app/hooks/useTransformedData";
import { RELAYERS_PAGE_STATUS_VARIANTS } from "@/lib/classNameVariants";

// --- Types ---
interface Relayer {
  id: string;
  name: string;
  address: string;
  status: "active" | "lagging" | "offline";
  uptime: string;
  latency: number;
  successRate: number;
}

// --- Mock Data ---
const MOCK_RELAYERS: Relayer[] = [
  {
    id: "1",
    name: "VTPass Lagos",
    address: "GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A",
    status: "active",
    uptime: "99.98%",
    latency: 32,
    successRate: 99.4,
  },
  {
    id: "2",
    name: "Binance Pan-Africa",
    address: "GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA",
    status: "lagging",
    uptime: "98.50%",
    latency: 540,
    successRate: 92.1,
  },
  {
    id: "3",
    name: "Coinbase Global",
    address: "GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122",
    status: "active",
    uptime: "99.99%",
    latency: 45,
    successRate: 100,
  },
];
const RELAYER_ICON_IDS = {
  activity: "relayer-icon-activity",
  plus: "relayer-icon-plus",
  search: "relayer-icon-search",
  moreVertical: "relayer-icon-more-vertical",
  refresh: "relayer-icon-refresh",
  shield: "relayer-icon-shield",
  clock: "relayer-icon-clock",
  signal: "relayer-icon-signal",
} as const;

function RelayerIconDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute" }}
    >
      <defs>
        <symbol id={RELAYER_ICON_IDS.activity} viewBox="0 0 24 24">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.plus} viewBox="0 0 24 24">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.search} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.moreVertical} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.refresh} viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.shield} viewBox="0 0 24 24">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.clock} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </symbol>
        <symbol id={RELAYER_ICON_IDS.signal} viewBox="0 0 24 24">
          <path d="M2 20h.01" />
          <path d="M7 20v-4" />
          <path d="M12 20v-8" />
          <path d="M17 20V8" />
          <path d="M22 20V4" />
        </symbol>
      </defs>
    </svg>
  );
}

function RelayerIcon({
  id,
  size = 18,
  className,
}: {
  id: (typeof RELAYER_ICON_IDS)[keyof typeof RELAYER_ICON_IDS];
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <use href={`#${id}`} />
    </svg>
  );
}

export default function RelayersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 250);

  const displayedRelayers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_RELAYERS;
    return MOCK_RELAYERS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q),
    );
  }, [debouncedSearch]);

  // Pre-compute shortened addresses on data ingestion to avoid render-time string slicing
  const shortenedAddressMap = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        useTransformedCustomAddressField(MOCK_RELAYERS, "address").map((r) => [
          r.id,
          r.shortenedAddress,
        ]),
      ),
    [],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      <RelayerIconDefs />
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Network</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Relayer Management
          </h1>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium">
          <RelayerIcon id={RELAYER_ICON_IDS.plus} size={18} />
          Add New Relayer
        </button>
      </div>

      {/* --- Stats Row --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Relayers"
          value="12"
          icon={
            <RelayerIcon
              id={RELAYER_ICON_IDS.activity}
              className="text-blue-400"
            />
          }
          subtitle="3 Regions Active"
        />
        <StatCard
          title="Avg Network Latency"
          value="45ms"
          icon={
            <RelayerIcon
              id={RELAYER_ICON_IDS.signal}
              className="text-green-400"
            />
          }
          subtitle="+2ms from last hour"
        />
        <StatCard
          title="Network Uptime"
          value="99.98%"
          icon={
            <RelayerIcon
              id={RELAYER_ICON_IDS.shield}
              className="text-purple-400"
            />
          }
          subtitle="Last 24 hours"
        />
      </div>

      {/* --- Table Section --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <RelayerIcon
              id={RELAYER_ICON_IDS.search}
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Search by name or address..."
              className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-800 rounded-md border border-gray-700 text-gray-400">
              <RelayerIcon id={RELAYER_ICON_IDS.refresh} size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="px-6 py-4 font-medium">Relayer Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Uptime (24h)</th>
                <th className="px-6 py-4 font-medium">Latency</th>
                <th className="px-6 py-4 font-medium">Success Rate</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedRelayers.map((relayer) => (
                <tr
                  key={relayer.id}
                  className="hover:bg-[#1c2128] transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-blue-400">
                      {relayer.name}
                    </div>
                    {/* PERFORMANCE OPTIMIZATION: O(1) map lookup instead of O(n) array scan */}
                    <div className="text-xs text-gray-500 font-mono">
                      {shortenedAddressMap[relayer.id]}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={relayer.status} />
                  </td>
                  <td className="px-6 py-4 text-sm">{relayer.uptime}</td>
                  <td className="px-6 py-4 text-sm font-mono">
                    {relayer.latency}ms
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full"
                        style={{ width: '100%', transform: `scaleX(${relayer.successRate/100})`, transformOrigin: 'left', willChange: 'transform' }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">
                      {relayer.successRate}% confirmed
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400">
                      <RelayerIcon
                        id={RELAYER_ICON_IDS.moreVertical}
                        size={18}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Footer Logs --- */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RelayerIcon
              id={RELAYER_ICON_IDS.clock}
              size={18}
              className="text-gray-400"
            />
            Live Feed Activity
          </h3>
          <div className="space-y-3 font-mono text-xs overflow-y-auto max-h-48">
            <p className="text-green-500/80">
              [12:30:05] VTPass Lagos: Successfully pushed NGN/XLM
            </p>
            <p className="text-gray-400">
              [12:29:45] Coinbase Global: Ping acknowledgment received (45ms)
            </p>
            <p className="text-yellow-500/80">
              [12:28:10] Binance Pan-Africa: High latency detected (540ms)
            </p>
            <p className="text-gray-400">
              [12:25:30] Relayer Manager: Auto-healing protocol initiated for
              Region: West-1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="bg-[#161b22] border border-gray-800 p-6 rounded-xl">
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}

const StatusBadge = React.memo(
  function StatusBadge({
    status,
  }: {
    status: "active" | "lagging" | "offline";
  }) {
    return (
      <span
        style={{ contain: "layout", willChange: "opacity, transform" }}
        className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter ${RELAYERS_PAGE_STATUS_VARIANTS[status]}`}
      >
        ● {status}
      </span>
    );
  },
  (prev, next) => prev.status === next.status,
);

StatusBadge.displayName = "StatusBadge";
