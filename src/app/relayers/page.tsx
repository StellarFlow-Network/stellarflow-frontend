"use client";

import React, { useState, useMemo } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { buildShortenedAddressMap } from "@/utils/addressUtils";
import { RELAYERS_PAGE_STATUS_VARIANTS } from "@/lib/classNameVariants";
import { Icon, ICON_IDS } from "@/components/icons";

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
    () => buildShortenedAddressMap(MOCK_RELAYERS, 'id', 'address'),
    [MOCK_RELAYERS],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Network</p>
          <h1 className="text-3xl font-bold tracking-tight">Relayer Management</h1>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium">
          <Icon id={ICON_IDS.plus} size={18} />
          Add New Relayer
        </button>
      </div>

      {/* --- Stats Row --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Relayers"
          value="12"
          icon={<Icon id={ICON_IDS.activity} size={20} className="text-blue-400" />}
          subtitle="3 Regions Active"
        />
        <StatCard
          title="Avg Network Latency"
          value="45ms"
          icon={<Icon id={ICON_IDS.signal} size={20} className="text-green-400" />}
          subtitle="+2ms from last hour"
        />
        <StatCard
          title="Network Uptime"
          value="99.98%"
          icon={<Icon id={ICON_IDS.shield} size={20} className="text-purple-400" />}
          subtitle="Last 24 hours"
        />
      </div>

      {/* --- Table Section --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Icon
              id={ICON_IDS.search}
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
              <Icon id={ICON_IDS.refresh} size={18} />
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
                    <div className="font-medium text-blue-400">{relayer.name}</div>
                    {/* PERFORMANCE OPTIMIZATION: O(1) map lookup instead of O(n) array scan */}
                    <div className="text-xs text-gray-500 font-mono">
                      {shortenedAddressMap[relayer.id]}
                    </div>
                  </td>
                  <td className="px-6 py-4 node-status-cell">
                    <StatusBadge status={relayer.status} />
                  </td>
                  <td className="px-6 py-4 text-sm node-status-cell numeric-value">{relayer.uptime}</td>
                  <td className="px-6 py-4 text-sm font-mono node-status-cell numeric-value">{relayer.latency}ms</td>
                  <td className="px-6 py-4 metric-indicator">
                    <div className="w-24 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full dynamic-scale-x"
                        style={{
                          width: "100%",
                          transform: `scaleX(${relayer.successRate / 100})`,
                          transformOrigin: "left",
                          willChange: "transform",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block numeric-value">
                      {relayer.successRate}% confirmed
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400">
                      <Icon id={ICON_IDS.moreVertical} size={18} />
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
            <Icon id={ICON_IDS.clock} size={18} className="text-gray-400" />
            Live Feed Activity
          </h3>
          <div className="space-y-3 font-mono text-xs overflow-y-auto max-h-48">
            <p className="text-green-500/80">[12:30:05] VTPass Lagos: Successfully pushed NGN/XLM</p>
            <p className="text-gray-400">[12:29:45] Coinbase Global: Ping acknowledgment received (45ms)</p>
            <p className="text-yellow-500/80">[12:28:10] Binance Pan-Africa: High latency detected (540ms)</p>
            <p className="text-gray-400">[12:25:30] Relayer Manager: Auto-healing protocol initiated for Region: West-1</p>
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
  function StatusBadge({ status }: { status: "active" | "lagging" | "offline" }) {
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
