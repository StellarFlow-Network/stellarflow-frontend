"use client";

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Key, 
  Layers, 
  CreditCard, 
  Plus, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCcw, 
  Eye, 
  EyeOff, 
  Copy 
} from 'lucide-react';
import { useTransformedCustomAddressField } from '@/app/hooks/useTransformedData';

// --- Types ---
interface Consumer {
  id: string;
  projectName: string;
  contractAddress: string;
  tier: 'Enterprise' | 'Developer' | 'Staging';
  status: 'active' | 'expired' | 'paused';
  monthlyRequests: string;
  balanceXLM: number;
}

// --- Mock Data ---
const MOCK_CONSUMERS: Consumer[] = [
  { id: 'C-01', projectName: 'Zazu Lending Pool', contractAddress: 'CC7VHQGGURUNXSVWFR7RCGZV5BVMODXX75YMMV5AGJGKGHBNEA88NN', tier: 'Enterprise', status: 'active', monthlyRequests: '4.2M', balanceXLM: 2500.00 },
  { id: 'C-02', projectName: 'NairaStable DEX', contractAddress: 'GAB3FNZOMCXKKUZCWZZG5J6MFMBXVFBXKTMZK992QYJR7VBCDEF7G9JK', tier: 'Enterprise', status: 'active', monthlyRequests: '12.8M', balanceXLM: 540.50 },
  { id: 'C-03', projectName: 'AfriSwap Mobile', contractAddress: 'GDT4VHZLKMNPQRSXYZABCDEFGHIJKLM77AA', tier: 'Developer', status: 'active', monthlyRequests: '450K', balanceXLM: 120.00 },
  { id: 'C-04', projectName: 'Test Sandbox', contractAddress: 'GDD2VHZLKMNPQRSXYZABCDEFGHIJKLM3311', tier: 'Staging', status: 'paused', monthlyRequests: '12K', balanceXLM: 0.00 },
];

export default function ConsumersPage() {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pre-compute shortened addresses on data ingestion to avoid render-time string slicing
  const transformedConsumers = useMemo(
    () => useTransformedCustomAddressField(MOCK_CONSUMERS, 'contractAddress'),
    []
  );

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Gateway</p>
          <h1 className="text-3xl font-bold tracking-tight">Consumer Subscriptions</h1>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm">
          <Plus size={16} />
          Provision Client Access
        </button>
      </div>

      {/* --- Performance/Billing High-Level Overview --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Active Integrations" value="24 Projects" icon={<Users className="text-blue-400" />} subtitle="8 Added this month" />
        <StatCard title="Total Network Volume" value="17.4M" icon={<Layers className="text-purple-400" />} subtitle="Requests across 24h" />
        <StatCard title="Total Escrowed Collateral" value="3,160.50 XLM" icon={<CreditCard className="text-green-400" />} subtitle="Gas tank aggregation" />
        <StatCard title="System Performance" value="100%" icon={<CheckCircle2 className="text-emerald-400" />} subtitle="0 Failed handshakes" />
      </div>

      {/* --- API Gateway & Credentials Panel --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Key size={18} className="text-yellow-400" />
          Global Gateway Credentials
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-bold">Client Consumer ID</label>
            <div className="flex bg-[#0d1117] border border-gray-700 rounded-md p-2.5 text-sm font-mono text-gray-300">
              sf_gateway_prod_99812x33
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-bold">Secret Authentication Passkey</label>
            <div className="relative">
              <input 
                type={showSecret ? "text" : "password"} 
                defaultValue="soroban_oracle_secret_payload_hash_alignment" 
                readOnly
                className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2.5 pl-3 pr-24 text-sm font-mono text-gray-300 focus:outline-none" 
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button 
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-1 text-gray-500 hover:text-gray-300"
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button 
                  onClick={handleCopy}
                  className="p-1 text-gray-500 hover:text-gray-300 relative"
                >
                  <Copy size={16} />
                  {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">Copied!</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Consumer Roster Table --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Filter consumers by contract or title..." 
              className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button className="p-2 bg-[#0d1117] hover:bg-gray-800 rounded-md border border-gray-700 text-gray-400 self-end md:self-auto">
            <RefreshCcw size={16} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="px-6 py-4 font-medium">Project Integration</th>
                <th className="px-6 py-4 font-medium">Plan Tier</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Requests (MTD)</th>
                <th className="px-6 py-4 font-medium">Gas Tank Balance</th>
                <th className="px-6 py-4 font-medium text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transformedConsumers.map((consumer) => (
                <tr key={consumer.id} className="hover:bg-[#1c2128] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-200">{consumer.projectName}</div>
                    {/* PERFORMANCE OPTIMIZATION: Use pre-computed shortened address instead of runtime string slicing */}
                    <div className="text-xs text-gray-500 font-mono">{consumer.shortenedAddress}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`${CONSUMER_TIER_BADGE_CLASS} ${CONSUMER_TIER_VARIANTS[consumer.tier]}`}>
                      {consumer.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${CONSUMER_STATUS_TEXT_VARIANTS[consumer.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${CONSUMER_STATUS_DOT_VARIANTS[consumer.status]}`} />
                      <span className="capitalize">{consumer.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-300">
                    {consumer.monthlyRequests}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-mono ${getBalanceColorClass(consumer.balanceXLM)}`}>
                      {consumer.balanceXLM.toFixed(2)} XLM
                    </div>
                    {consumer.balanceXLM < 200 && (
                      <span className="text-[10px] text-yellow-600 block leading-none mt-0.5">Low Refill Alert</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs">
                      <span>View Contract</span>
                      <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}