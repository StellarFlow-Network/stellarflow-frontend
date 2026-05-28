"use client";

import React, { useState, useMemo } from 'react';
import { 
  Vote, 
  FilePlus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  Wallet 
} from 'lucide-react';
import { useTransformedCustomAddressField } from '@/app/hooks/useTransformedData';
import { useRAFInterval } from '@/app/hooks/useRAFInterval';

// --- Types ---
interface Proposal {
  id: string;
  title: string;
  proposer: string;
  status: 'Active' | 'Passed' | 'Defeated' | 'Queue';
  votesFor: number;
  votesAgainst: number;
  quorumThreshold: number;
  endsInLedgers: number;
}

// --- Mock Data ---
const MOCK_PROPOSALS: Proposal[] = [
  { id: 'SFP-12', title: 'Whitelist West African GHS/XLM Asset Pair Feed', proposer: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A', status: 'Active', votesFor: 785000, votesAgainst: 120000, quorumThreshold: 60, endsInLedgers: 4200 },
  { id: 'SFP-11', title: 'Adjust Global Deviation Threshold from 2.5% to 1.8%', proposer: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA', status: 'Active', votesFor: 450000, votesAgainst: 410000, quorumThreshold: 60, endsInLedgers: 1150 },
  { id: 'SFP-10', title: 'Upgrade Core Contract WASM to Release Version v1.2.0', proposer: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122', status: 'Passed', votesFor: 1200000, votesAgainst: 15000, quorumThreshold: 75, endsInLedgers: 0 },
  { id: 'SFP-09', title: 'Increase Relayer Missed-Heartbeat Penalty Weight by 2%', proposer: 'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766', status: 'Defeated', votesFor: 110000, votesAgainst: 920000, quorumThreshold: 50, endsInLedgers: 0 },
];

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');

  // Pre-compute shortened addresses on data ingestion to avoid render-time string slicing
  const transformedProposals = useMemo(
    () => useTransformedCustomAddressField(MOCK_PROPOSALS, 'proposer'),
    []
  );

  // Live ledger countdown — one shared RAF tick every ~5 s (Stellar avg ledger time)
  const [ledgerCounts, setLedgerCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(MOCK_PROPOSALS.map(p => [p.id, p.endsInLedgers]))
  );

  useRAFInterval(() => {
    setLedgerCounts(prev => {
      const next = { ...prev };
      for (const id in next) {
        if (next[id] > 0) next[id] -= 1;
      }
      return next;
    });
  }, 5000);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Consensus</p>
          <h1 className="text-3xl font-bold tracking-tight">Governance & Proposals</h1>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-[#161b22] border border-gray-800 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg transition-all text-sm font-medium">
            <Wallet size={16} className="text-purple-400" />
            Connect Freighter Wallet
          </button>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium">
            <FilePlus size={16} />
            Submit New Proposal
          </button>
        </div>
      </div>

      {/* --- Consensus Statistics Rows --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Staking Power" value="2.85M SF" icon={<Vote className="text-blue-400" />} subtitle="Active voting weights" />
        <StatCard title="Active Ballots" value="2 Proposals" icon={<Clock className="text-yellow-500" />} subtitle="Awaiting validation signatures" />
        <StatCard title="Voter Turnout Avg" value="74.2%" icon={<Users className="text-green-400" />} subtitle="High network coordinator interest" />
        <StatCard title="Passing Invariants" value="100%" icon={<CheckCircle className="text-emerald-400" />} subtitle="All parameters safe" />
      </div>

      {/* --- Filtering Tabs --- */}
      <div className="flex border-b border-gray-800 mb-6 gap-6">
        <button onClick={() => setActiveTab('all')} className={`pb-3 text-sm font-medium capitalize transition-all ${activeTab === 'all' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>All Ballots</button>
        <button onClick={() => setActiveTab('active')} className={`pb-3 text-sm font-medium capitalize transition-all ${activeTab === 'active' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Active</button>
        <button onClick={() => setActiveTab('archived')} className={`pb-3 text-sm font-medium capitalize transition-all ${activeTab === 'archived' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Archived</button>
      </div>

      {/* --- Proposal List Suite --- */}
      <div className="space-y-4">
        {transformedProposals.map((proposal) => {
          const totalVotes = proposal.votesFor + proposal.votesAgainst;
          const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
          
          return (
            <div key={proposal.id} className="bg-[#161b22] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors group">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Proposal Text Meta */}
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-tight">{proposal.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      proposal.status === 'Active' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      proposal.status === 'Passed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {proposal.status}
                    </span>
                    {proposal.status === 'Active' && (
                      <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                        <Clock size={12} /> ~{(ledgerCounts[proposal.id] ?? 0).toLocaleString()} ledgers remaining
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">{proposal.title}</h3>
                  {/* PERFORMANCE OPTIMIZATION: Use pre-computed shortened address instead of runtime string slicing */}
                  <p className="text-xs text-gray-500 font-mono">Proposed by authority wallet: <span className="text-gray-400">{proposal.shortenedAddress}</span></p>
                </div>

                {/* Progress Indicators and Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 lg:min-w-[320px]">
                  <div className="w-full space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">For: {forPercentage.toFixed(1)}%</span>
                      <span className="text-red-400 font-bold">Against: {(100 - forPercentage).toFixed(1)}%</span>
                    </div>
                    {/* Voting Ratio Track Bar */}
                    <div className="w-full bg-red-950/40 h-2 rounded-full overflow-hidden flex border border-gray-800">
                      <div className="bg-emerald-500 h-full" style={{ width: `${forPercentage}%` }} />
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono text-right">
                      Quorum Target Required: {proposal.quorumThreshold}%
                    </div>
                  </div>

                  <button className="p-2 bg-[#0d1117] group-hover:bg-gray-800 border border-gray-700 text-gray-400 rounded-lg shrink-0 self-end md:self-auto transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>

              </div>
            </div>
          );
        })}
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
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}