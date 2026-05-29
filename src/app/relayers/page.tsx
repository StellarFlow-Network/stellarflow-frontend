"use client";

import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useTransformedCustomAddressField } from '@/app/hooks/useTransformedData';
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
import { RELAYERS_PAGE_STATUS_VARIANTS } from '@/lib/classNameVariants';

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
  { id: '1', name: 'VTPass Lagos', address: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A', status: 'active', uptime: '99.98%', latency: 32, successRate: 99.4 },
  { id: '2', name: 'Binance Pan-Africa', address: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA', status: 'lagging', uptime: '98.50%', latency: 540, successRate: 92.1 },
  { id: '3', name: 'Coinbase Global', address: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122', status: 'active', uptime: '99.99%', latency: 45, successRate: 100 },
];

export default function RelayersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddRelayerOpen, setIsAddRelayerOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 250);

  const displayedRelayers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_RELAYERS;
    return MOCK_RELAYERS.filter(r => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q));
  }, [debouncedSearch]);

  // Pre-compute shortened addresses on data ingestion to avoid render-time string slicing
  const shortenedAddressMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(
      useTransformedCustomAddressField(MOCK_RELAYERS, 'address').map(r => [r.id, r.shortenedAddress])
    ),
    []
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Network</p>
          <h1 className="text-3xl font-bold tracking-tight">Relayer Management</h1>
        </div>
        <button 
          onClick={() => setIsAddRelayerOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium"
        >
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
              {displayedRelayers.map((relayer) => (
                <tr key={relayer.id} className="hover:bg-[#1c2128] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-blue-400">{relayer.name}</div>
                    {/* PERFORMANCE OPTIMIZATION: O(1) map lookup instead of O(n) array scan */}
                    <div className="text-xs text-gray-500 font-mono">{shortenedAddressMap[relayer.id]}</div>
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
              ))}
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

      {/* ─── State-Driven Modal (Clean mount/unmount via short-circuit rendering) ─── */}
      {isAddRelayerOpen && <AddRelayerModal onClose={() => setIsAddRelayerOpen(false)} />}
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
    return (
      <span
        style={{ contain: 'layout', willChange: 'opacity, transform' }}
        className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter ${RELAYERS_PAGE_STATUS_VARIANTS[status]}`}
      >
        ● {status}
      </span>
    );
  },
  (prev, next) => prev.status === next.status,
);

StatusBadge.displayName = 'StatusBadge';

interface AddRelayerModalProps {
  onClose: () => void;
}

const AddRelayerModal = React.memo(({ onClose }: AddRelayerModalProps) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('West-1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      alert('Please fill in all required fields.');
      return;
    }
    alert(`Relayer successfully registered:\nName: ${name}\nRegion: ${region}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="bg-[#0c0f1d] border border-gray-800 rounded-3xl p-6 max-w-lg w-full mx-4 shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />
        <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
          <Plus className="text-blue-400" size={20} />
          Add New Network Relayer
        </h2>
        <p className="text-xs text-gray-400 mb-6">Register a high-frequency validator telemetry feed in the decentralized registry.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Relayer Name</label>
            <input 
              type="text" 
              placeholder="e.g. VTPass Accra" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600 text-white" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Freighter/Stellar Wallet Address</label>
            <input 
              type="text" 
              placeholder="e.g. GBC2VHZLKMNPQRSXYZ..." 
              value={address} 
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600 text-white" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Operating Region</label>
              <select 
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors text-white"
              >
                <option value="West-1">West Africa (West-1)</option>
                <option value="East-1">East Africa (East-1)</option>
                <option value="South-1">Southern Africa (South-1)</option>
                <option value="Global-1">Global Anycast (Global-1)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Default Target Latency</label>
              <div className="w-full bg-[#0d1117]/60 border border-gray-800 text-gray-400 rounded-xl py-2.5 px-3 text-sm">
                &lt; 50ms Target
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="w-1/2 py-2.5 border border-gray-700 hover:bg-gray-800 rounded-xl text-sm font-medium transition-colors text-gray-300">
              Cancel
            </button>
            <button type="submit" className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white transition-colors">
              Register Relayer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

AddRelayerModal.displayName = 'AddRelayerModal';
