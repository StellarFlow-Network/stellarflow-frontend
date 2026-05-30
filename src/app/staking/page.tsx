"use client";

import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useTransformedCustomAddressField } from '@/app/hooks/useTransformedData';
import { 
  ShieldCheck, 
  Coins, 
  Percent, 
  Flame, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Gavel, 
  TrendingUp, 
  ArrowUpRight 
} from 'lucide-react';
import {
  getHealthBarColor,
  STAKER_SLASHING_NO_EVENTS,
  STAKER_SLASHING_WITH_EVENTS,
} from '@/lib/classNameVariants';

// --- Types ---
interface StakerNode {
  id: string;
  nodeName: string;
  operatorAddress: string;
  stakedAmountXLM: number;
  accruedRewardsXLM: number;
  totalSlashingEvents: number;
  healthFactor: number; // Percentage score
}

// --- Mock Data ---
const MOCK_STAKERS: StakerNode[] = [
  { id: 'N-401', nodeName: 'VTPass Lagos Edge', operatorAddress: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A', stakedAmountXLM: 50000.00, accruedRewardsXLM: 1420.50, totalSlashingEvents: 0, healthFactor: 100 },
  { id: 'N-402', nodeName: 'Binance Pan-Africa Node', operatorAddress: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA', stakedAmountXLM: 75000.00, accruedRewardsXLM: 2105.00, totalSlashingEvents: 1, healthFactor: 84 },
  { id: 'N-403', nodeName: 'Coinbase Global Relay', operatorAddress: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122', stakedAmountXLM: 120000.00, accruedRewardsXLM: 4890.75, totalSlashingEvents: 0, healthFactor: 99 },
  { id: 'N-404', nodeName: 'Accra Frontier Oracle', operatorAddress: 'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766', stakedAmountXLM: 25000.00, accruedRewardsXLM: 310.20, totalSlashingEvents: 3, healthFactor: 62 },
];

export default function StakingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isApyOpen, setIsApyOpen] = useState(false);
  const [isSlashingOpen, setIsSlashingOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 250);

  const displayedStakers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_STAKERS;
    return MOCK_STAKERS.filter(s => s.nodeName.toLowerCase().includes(q) || s.operatorAddress.toLowerCase().includes(q));
  }, [debouncedSearch]);

  // Pre-compute shortened addresses on data ingestion to avoid render-time string slicing
  const shortenedAddressMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(
      useTransformedCustomAddressField(MOCK_STAKERS, 'operatorAddress').map(s => [s.id, s.shortenedAddress])
    ),
    []
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Security</p>
          <h1 className="text-3xl font-bold tracking-tight">Staking & Collateral Pool</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsApyOpen(true)}
            className="flex items-center gap-2 bg-[#161b22] border border-gray-800 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg transition-all text-sm font-medium"
          >
            <Percent size={16} className="text-yellow-500" />
            Adjust Network APY
          </button>
          <button 
            onClick={() => setIsSlashingOpen(true)}
            className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 hover:bg-red-900/30 text-red-400 px-4 py-2 rounded-lg transition-all text-sm font-medium"
          >
            <Flame size={16} />
            Execute Manual Slashing
          </button>
        </div>
      </div>

      {/* --- Pool High-Level Metrics --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Value Locked (TVL)" value="270,000 XLM" icon={<Coins className="text-blue-400" />} subtitle="Crypto economic security" />
        <StatCard title="Network Reward Pool" value="8,726.45 XLM" icon={<TrendingUp className="text-green-400" />} subtitle="Fees ready to distribute" />
        <StatCard title="Active Bonded Nodes" value="4 / 4 Online" icon={<ShieldCheck className="text-emerald-400" />} subtitle="100% network validation coverage" />
        <StatCard title="Active Slashing Rules" value="2 Penalties" icon={<AlertTriangle className="text-red-400" />} subtitle="Downtime & faulty feeds protected" />
      </div>

      {/* --- Node Performance and Collateral Roster --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search active stakers by node name or identity..." 
              className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 bg-[#0d1117] hover:bg-gray-800 rounded-md border border-gray-700 text-gray-400 self-end md:self-auto">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="px-6 py-4 font-medium">Node Operator</th>
                <th className="px-6 py-4 font-medium">Bonded Stake</th>
                <th className="px-6 py-4 font-medium">Accrued Fees</th>
                <th className="px-6 py-4 font-medium">Health Rating</th>
                <th className="px-6 py-4 font-medium">Infractions</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedStakers.map((node) => (
                <tr key={node.id} className="hover:bg-[#1c2128] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-200">{node.nodeName}</div>
                    {/* PERFORMANCE OPTIMIZATION: O(1) map lookup instead of O(n) array scan */}
                    <div className="text-xs text-gray-500 font-mono">{shortenedAddressMap[node.id]}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-300">
                    {node.stakedAmountXLM.toLocaleString()} XLM
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-emerald-400">
                    +{node.accruedRewardsXLM.toLocaleString()} XLM
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getHealthBarColor(node.healthFactor)}`} 
                          style={{ width: `${node.healthFactor}%` }} 
                        />
                      </div>
                      <span className="text-xs font-semibold">{node.healthFactor}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      node.totalSlashingEvents === 0 
                        ? STAKER_SLASHING_NO_EVENTS 
                        : STAKER_SLASHING_WITH_EVENTS
                    }`}>
                      {node.totalSlashingEvents} slash events
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs font-medium">
                      <span>Manage Node</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Slashing Invariants Warning Section --- */}
      <div className="mt-6 p-4 bg-yellow-950/20 border border-yellow-900/30 rounded-xl flex gap-4 items-start">
        <Gavel className="text-yellow-500 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-semibold text-yellow-500">Oracle Slashing Rule Enforcement active</h4>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Staked tokens are automatically locked inside Soroban persistent storage. Any node reporting a price with a deviation higher than your threshold configuration without baseline cross-validation will trigger an automatic 5% collateral slashing protocol.
          </p>
        </div>
      </div>

      {/* ─── State-Driven Modals (Clean mount/unmount via short-circuit rendering) ─── */}
      {isApyOpen && <AdjustApyModal onClose={() => setIsApyOpen(false)} />}
      {isSlashingOpen && <ExecuteSlashingModal onClose={() => setIsSlashingOpen(false)} />}
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
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}

interface AdjustApyModalProps {
  onClose: () => void;
}

const AdjustApyModal = React.memo(({ onClose }: AdjustApyModalProps) => {
  const [targetApy, setTargetApy] = useState('5.5');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetApy || !reason) {
      alert('Please fill in all required fields.');
      return;
    }
    alert(`APY adjustment request submitted:\nNew APY: ${targetApy}%\nReason: ${reason}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="bg-[#0c0f1d] border border-gray-800 rounded-3xl p-6 max-w-lg w-full mx-4 shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(234,179,8,0.08),transparent_50%)] pointer-events-none" />
        <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
          <Percent className="text-yellow-500" size={20} />
          Adjust Network APY
        </h2>
        <p className="text-xs text-gray-400 mb-6">Modify the global cryptographic inflation yield for active node validators and stakers.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">New Target APY (%)</label>
            <input 
              type="number"
              step="0.01"
              placeholder="e.g. 5.5" 
              value={targetApy} 
              onChange={(e) => setTargetApy(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors text-white" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Governance/Consensus Proposal Justification</label>
            <textarea 
              placeholder="Provide a detailed backing reason for altering the inflation rate parameters..." 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-600 text-white resize-none" 
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="w-1/2 py-2.5 border border-gray-700 hover:bg-gray-800 rounded-xl text-sm font-medium transition-colors text-gray-300">
              Cancel
            </button>
            <button type="submit" className="w-1/2 py-2.5 bg-yellow-600 hover:bg-yellow-700 rounded-xl text-sm font-bold text-white transition-colors">
              Adjust APY Rate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

AdjustApyModal.displayName = 'AdjustApyModal';

interface ExecuteSlashingModalProps {
  onClose: () => void;
}

const ExecuteSlashingModal = React.memo(({ onClose }: ExecuteSlashingModalProps) => {
  const [selectedNode, setSelectedNode] = useState(MOCK_STAKERS[0]?.id || '');
  const [slashingPercent, setSlashingPercent] = useState(5);
  const [infractionReason, setInfractionReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !slashingPercent || !infractionReason) {
      alert('Please fill in all required fields.');
      return;
    }
    const nodeName = MOCK_STAKERS.find(s => s.id === selectedNode)?.nodeName || selectedNode;
    alert(`Slashing protocol executed successfully:\nNode: ${nodeName}\nPenalty: -${slashingPercent}%\nInfraction: ${infractionReason}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="bg-[#0c0f1d] border border-red-900/40 rounded-3xl p-6 max-w-lg w-full mx-4 shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.08),transparent_50%)] pointer-events-none" />
        <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
          <Flame className="text-red-500 animate-pulse" size={20} />
          Execute Manual Slashing
        </h2>
        <p className="text-xs text-gray-400 mb-6">Manually slash validator collateral due to protocol non-compliance or malicious price feed reporting.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Select Malicious Node Operator</label>
            <select 
              value={selectedNode} 
              onChange={(e) => setSelectedNode(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-red-500 transition-colors text-white"
            >
              {MOCK_STAKERS.map(node => (
                <option key={node.id} value={node.id}>
                  {node.nodeName} ({node.stakedAmountXLM.toLocaleString()} XLM staked)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Slash Percentage Penalty</label>
              <select 
                value={slashingPercent} 
                onChange={(e) => setSlashingPercent(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-red-500 transition-colors text-white"
              >
                <option value={5}>5% Penalty (Standard Deviation)</option>
                <option value={10}>10% Penalty (Extended Downtime)</option>
                <option value={25}>25% Penalty (Double-sign Infraction)</option>
                <option value={50}>50% Penalty (Malicious Manipulation)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Estimated Slashing Yield</label>
              <div className="w-full bg-[#0d1117]/60 border border-gray-800 text-red-400 font-mono rounded-xl py-2.5 px-3 text-sm flex items-center">
                -{((MOCK_STAKERS.find(s => s.id === selectedNode)?.stakedAmountXLM || 0) * (slashingPercent / 100)).toLocaleString()} XLM
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Infraction Details & Log Proof</label>
            <textarea 
              placeholder="Paste consensus block mismatch, heartbeat timeout telemetry logs, or other evidence..." 
              value={infractionReason} 
              onChange={(e) => setInfractionReason(e.target.value)}
              rows={3}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder-gray-600 text-white resize-none" 
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="w-1/2 py-2.5 border border-gray-700 hover:bg-gray-800 rounded-xl text-sm font-medium transition-colors text-gray-300">
              Cancel
            </button>
            <button type="submit" className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold text-white transition-colors shadow-lg shadow-red-900/20">
              Execute Slash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

ExecuteSlashingModal.displayName = 'ExecuteSlashingModal';