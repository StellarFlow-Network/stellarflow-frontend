"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, 
  Plus, 
  Search, 
  MoreVertical, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  Signal 
} from 'lucide-react';

// --- Types ---
interface Relayer {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'lagging' | 'offline';
  uptime: string;
  latency: number;
  successRate: number;
}

// --- Mock Data ---
const MOCK_RELAYERS: Relayer[] = [
  { id: '1', name: 'VTPass Lagos', address: 'GA5T...BC9A', status: 'active', uptime: '99.98%', latency: 32, successRate: 99.4 },
  { id: '2', name: 'Binance Pan-Africa', address: 'GBC2...LOPA', status: 'lagging', uptime: '98.50%', latency: 540, successRate: 92.1 },
  { id: '3', name: 'Coinbase Global', address: 'GDRT...1122', status: 'active', uptime: '99.99%', latency: 45, successRate: 100 },
];

async function fetchRelayers(): Promise<Relayer[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_RELAYERS;
}

export default function RelayersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: relayers = [], isLoading } = useQuery({
    queryKey: ['relayers'],
    queryFn: fetchRelayers,
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Network</p>
          <h1 className="text-3xl font-bold tracking-tight">Relayer Management</h1>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium">
          <Plus size={18} />
          Add New Relayer
        </button>
      </div>

      {/* --- Stats Row --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Relayers" value="12" icon={<Activity className="text-blue-400" />} subtitle="3 Regions Active" />
        <StatCard title="Avg Network Latency" value="45ms" icon={<Signal className="text-green-400" />} subtitle="+2ms from last hour" />
        <StatCard title="Network Uptime" value="99.98%" icon={<ShieldCheck className="text-purple-400" />} subtitle="Last 24 hours" />
      </div>

      {/* --- Table Section --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or address..." 
              className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-800 rounded-md border border-gray-700 text-gray-400">
              <RefreshCw size={18} />
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
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading relayers...
                  </td>
                </tr>
              ) : relayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No relayers found.
                  </td>
                </tr>
              ) : (
                relayers.map((relayer) => (
                  <tr key={relayer.id} className="hover:bg-[#1c2128] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-blue-400">{relayer.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{relayer.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={relayer.status} />
                    </td>
                    <td className="px-6 py-4 text-sm">{relayer.uptime}</td>
                    <td className="px-6 py-4 text-sm font-mono">{relayer.latency}ms</td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full" 
                          style={{ width: `${relayer.successRate}%` }} 
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 block">{relayer.successRate}% confirmed</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Footer Logs --- */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-gray-400" />
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

function StatCard({ title, value, icon, subtitle }: { title: string, value: string, icon: React.ReactNode, subtitle: string }) {
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
  function StatusBadge({ status }: { status: 'active' | 'lagging' | 'offline' }) {
    const styles = {
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      lagging: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      offline: 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    return (
      <span
        style={{ contain: 'layout', willChange: 'opacity, transform' }}
        className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter ${styles[status]}`}
      >
        ● {status}
      </span>
    );
  },
  (prev, next) => prev.status === next.status,
);

StatusBadge.displayName = 'StatusBadge';
