"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useRafThrottle } from '../hooks/useRafThrottle';
import { useTransformedCustomAddressField } from '@/app/hooks/useTransformedData';
import { buildShortenedAddressMap } from '@/utils/addressUtils';
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
  StakerTableRow,
  type StakerTableRecord,
} from '@/app/components/staking/StakerTableRow';
import { BondAllocationCalculator } from '@/app/components/staking/BondAllocationCalculator';
import { Icon, ICON_IDS } from '@/components/icons';

// --- Types ---
type StakerNode = StakerTableRecord;

// --- Mock Data ---
const MOCK_STAKERS: StakerNode[] = [
  { id: 'N-401', nodeName: 'VTPass Lagos Edge', operatorAddress: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A', stakedAmountXLM: 50000.00, accruedRewardsXLM: 1420.50, totalSlashingEvents: 0, healthFactor: 100 },
  { id: 'N-402', nodeName: 'Binance Pan-Africa Node', operatorAddress: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA', stakedAmountXLM: 75000.00, accruedRewardsXLM: 2105.00, totalSlashingEvents: 1, healthFactor: 84 },
  { id: 'N-403', nodeName: 'Coinbase Global Relay', operatorAddress: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122', stakedAmountXLM: 120000.00, accruedRewardsXLM: 4890.75, totalSlashingEvents: 0, healthFactor: 99 },
  { id: 'N-404', nodeName: 'Accra Frontier Oracle', operatorAddress: 'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766', stakedAmountXLM: 25000.00, accruedRewardsXLM: 310.20, totalSlashingEvents: 3, healthFactor: 62 },
];

export default function StakingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const throttledSetSearchTerm = useRafThrottle((v: string) => setSearchTerm(v));

  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);

  const handleConfirm = useCallback((_allocations: Record<string, number>) => {
    setConfirmationMsg('Allocation confirmed. Submitting to network…');
    setTimeout(() => setConfirmationMsg(null), 2000);
  }, []);

  const displayedStakers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_STAKERS;
    return MOCK_STAKERS.filter(s => s.nodeName.toLowerCase().includes(q) || s.operatorAddress.toLowerCase().includes(q));
  }, [debouncedSearch]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Security</p>
          <h1 className="text-3xl font-bold tracking-tight">Staking & Collateral Pool</h1>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-[#161b22] border border-gray-800 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg transition-all text-sm">
            <Icon id={ICON_IDS.percent} size={16} className="text-yellow-500" />
            Adjust Network APY
          </button>
          <button className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 hover:bg-red-900/30 text-red-400 px-4 py-2 rounded-lg transition-all text-sm font-medium">
            <Icon id={ICON_IDS.flame} size={16} />
            Execute Manual Slashing
          </button>
        </div>
      </div>

      {/* --- Pool High-Level Metrics --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Value Locked (TVL)" value="270,000 XLM" icon={<Icon id={ICON_IDS.coins} size={20} className="text-blue-400" />} subtitle="Crypto economic security" />
        <StatCard title="Network Reward Pool" value="8,726.45 XLM" icon={<Icon id={ICON_IDS.trendingUp} size={20} className="text-green-400" />} subtitle="Fees ready to distribute" />
        <StatCard title="Active Bonded Nodes" value="4 / 4 Online" icon={<Icon id={ICON_IDS.shieldCheck} size={20} className="text-emerald-400" />} subtitle="100% network validation coverage" />
        <StatCard title="Active Slashing Rules" value="2 Penalties" icon={<Icon id={ICON_IDS.alertTriangle} size={20} className="text-red-400" />} subtitle="Downtime & faulty feeds protected" />
      </div>

      {/* --- Node Performance and Collateral Roster --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Icon id={ICON_IDS.search} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search active stakers by node name or identity..." 
              className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              onChange={(e) => throttledSetSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 bg-[#0d1117] hover:bg-gray-800 rounded-md border border-gray-700 text-gray-400 self-end md:self-auto">
            <Icon id={ICON_IDS.refresh} size={16} />
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
                <StakerTableRow key={node.id} node={node} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Slashing Invariants Warning Section --- */}
      <div className="mt-6 p-4 bg-yellow-950/20 border border-yellow-900/30 rounded-xl flex gap-4 items-start">
        <Icon id={ICON_IDS.gavel} size={20} className="text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-yellow-500">Oracle Slashing Rule Enforcement active</h4>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Staked tokens are automatically locked inside Soroban persistent storage. Any node reporting a price with a deviation higher than your threshold configuration without baseline cross-validation will trigger an automatic 5% collateral slashing protocol.
          </p>
        </div>
      </div>

      {/* --- Confirmation Toast --- */}
      {confirmationMsg !== null && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-emerald-400 text-sm"
        >
          {confirmationMsg}
        </div>
      )}

      {/* --- Bond Allocation Calculator --- */}
      <BondAllocationCalculator
        nodes={MOCK_STAKERS}
        availableBalance={100_000}
        onConfirm={handleConfirm}
      />

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