"use client";

import React, { useState, useMemo } from 'react';
import {
  Users,
  Layers,
  CreditCard,
  Plus,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { useDebounce } from '@/app/hooks/useDebounce';
import { withShortenedAddressField } from '@/utils/addressUtils';
import { Icon, ICON_IDS } from '@/components/icons';
import { ConsumerSearchInput } from '@/app/components/ConsumerSearchInput';
import {
  ConsumerTableRow,
  type ConsumerTableRecord,
} from '@/app/components/consumers/ConsumerTableRow';

// --- Types ---
type ConsumerSource = Omit<ConsumerTableRecord, 'shortenedAddress'>;

// --- Mock Data ---
const MOCK_CONSUMERS: ConsumerSource[] = [
  {
    id: "C-01",
    projectName: "Zazu Lending Pool",
    contractAddress: "CC7VHQGGURUNXSVWFR7RCGZV5BVMODXX75YMMV5AGJGKGHBNEA88NN",
    tier: "Enterprise",
    status: "active",
    monthlyRequests: "4.2M",
    balanceXLM: 2500.0,
  },
  {
    id: "C-02",
    projectName: "NairaStable DEX",
    contractAddress: "GAB3FNZOMCXKKUZCWZZG5J6MFMBXVFBXKTMZK992QYJR7VBCDEF7G9JK",
    tier: "Enterprise",
    status: "active",
    monthlyRequests: "12.8M",
    balanceXLM: 540.5,
  },
  {
    id: "C-03",
    projectName: "AfriSwap Mobile",
    contractAddress: "GDT4VHZLKMNPQRSXYZABCDEFGHIJKLM77AA",
    tier: "Developer",
    status: "active",
    monthlyRequests: "450K",
    balanceXLM: 120.0,
  },
  {
    id: "C-04",
    projectName: "Test Sandbox",
    contractAddress: "GDD2VHZLKMNPQRSXYZABCDEFGHIJKLM3311",
    tier: "Staging",
    status: "paused",
    monthlyRequests: "12K",
    balanceXLM: 0.0,
  },
];

export default function ConsumersPage() {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce search term to prevent filtering on every keystroke
  const debouncedSearch = useDebounce(searchTerm, 250);

  // Pre-compute shortened addresses on data ingestion to avoid render-time string slicing
  const transformedConsumers = useMemo(
    () => withShortenedAddressField(MOCK_CONSUMERS, 'contractAddress'),
    [],
  );

  // Filter consumers based on debounced search term
  // Only recalculates when debouncedSearch changes (not on every keystroke)
  const filteredConsumers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return transformedConsumers;
    return transformedConsumers.filter(
      (c) =>
        c.projectName.toLowerCase().includes(q) ||
        c.contractAddress.toLowerCase().includes(q) ||
        c.shortenedAddress.toLowerCase().includes(q),
    );
  }, [debouncedSearch, transformedConsumers]);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Gateway</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Consumer Subscriptions
          </h1>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm">
          <Plus size={16} />
          Provision Client Access
        </button>
      </div>

      {/* --- Performance/Billing High-Level Overview --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Integrations"
          value="24 Projects"
          icon={<Users className="text-blue-400" />}
          subtitle="8 Added this month"
        />
        <StatCard
          title="Total Network Volume"
          value="17.4M"
          icon={<Layers className="text-purple-400" />}
          subtitle="Requests across 24h"
        />
        <StatCard
          title="Total Escrowed Collateral"
          value="3,160.50 XLM"
          icon={<CreditCard className="text-green-400" />}
          subtitle="Gas tank aggregation"
        />
        <StatCard
          title="System Performance"
          value="100%"
          icon={<CheckCircle2 className="text-emerald-400" />}
          subtitle="0 Failed handshakes"
        />
      </div>

      {/* --- API Gateway & Credentials Panel --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon id={ICON_IDS.key} size={18} className="text-yellow-400" />
          Global Gateway Credentials
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-bold">
              Client Consumer ID
            </label>
            <div className="flex bg-[#0d1117] border border-gray-700 rounded-md p-2.5 text-sm font-mono text-gray-300">
              sf_gateway_prod_99812x33
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-bold">
              Secret Authentication Passkey
            </label>
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
                  {showSecret ? <Icon id={ICON_IDS.eyeOff} size={16} /> : <Icon id={ICON_IDS.eye} size={16} />}
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1 text-gray-500 hover:text-gray-300 relative"
                >
                  <Copy size={16} />
                  {copied && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">
                      Copied!
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Consumer Roster Table --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between gap-4">
          <ConsumerSearchInput onSearchChange={setSearchTerm} />
          <button className="p-2 bg-[#0d1117] hover:bg-gray-800 rounded-md border border-gray-700 text-gray-400 self-end md:self-auto">
            <Icon id={ICON_IDS.refreshCcw} size={16} />
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
                <th className="px-6 py-4 font-medium text-right">
                  Verification
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredConsumers.map((consumer) => (
                <ConsumerTableRow key={consumer.id} consumer={consumer} />
              ))}
            </tbody>
          </table>
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
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
