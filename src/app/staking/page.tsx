"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useTransformedCustomAddressField } from '@/app/hooks/useTransformedData';
import { useStakingLogsStore } from '@/app/hooks/useStakingLogsStore';
import StakingLogsPanel from '@/app/components/StakingLogsPanel';
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
  ArrowUpRight,
  Database,
  Zap,
} from 'lucide-react';
import {
  getHealthBarColor,
  STAKER_SLASHING_NO_EVENTS,
  STAKER_SLASHING_WITH_EVENTS,
} from '@/lib/classNameVariants';
import type { StakingLogEntry } from '@/lib/stakingLogsDb';

interface StakerNode {
  id: string;
  nodeName: string;
  operatorAddress: string;
  stakedAmountXLM: number;
  accruedRewardsXLM: number;
  totalSlashingEvents: number;
  healthFactor: number;
}

const MOCK_STAKERS: StakerNode[] = [
  { id: 'N-401', nodeName: 'VTPass Lagos Edge', operatorAddress: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A', stakedAmountXLM: 50000.00, accruedRewardsXLM: 1420.50, totalSlashingEvents: 0, healthFactor: 100 },
  { id: 'N-402', nodeName: 'Binance Pan-Africa Node', operatorAddress: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA', stakedAmountXLM: 75000.00, accruedRewardsXLM: 2105.00, totalSlashingEvents: 1, healthFactor: 84 },
  { id: 'N-403', nodeName: 'Coinbase Global Relay', operatorAddress: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122', stakedAmountXLM: 120000.00, accruedRewardsXLM: 4890.75, totalSlashingEvents: 0, healthFactor: 99 },
  { id: 'N-404', nodeName: 'Accra Frontier Oracle', operatorAddress: 'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766', stakedAmountXLM: 25000.00, accruedRewardsXLM: 310.20, totalSlashingEvents: 3, healthFactor: 62 },
];

function buildSeedLogs(stakers: StakerNode[]): StakingLogEntry[] {
  const now = Date.now();
  return stakers.flatMap(s => {
    const base: StakingLogEntry = {
      id: `${s.id}-stake-seed`,
      nodeId: s.id,
      nodeName: s.nodeName,
      operatorAddress: s.operatorAddress,
      eventType: 'stake',
      amountXLM: s.stakedAmountXLM,
      timestamp: now - 86_400_000,
    };
    const slashEntries: StakingLogEntry[] = Array.from({ length: s.totalSlashingEvents }, (_, i) => ({
      id: `${s.id}-slash-seed-${i}`,
      nodeId: s.id,
      nodeName: s.nodeName,
      operatorAddress: s.operatorAddress,
      eventType: 'slash',
      amountXLM: s.stakedAmountXLM * 0.05,
      timestamp: now - (i + 1) * 3_600_000,
    }));
    return [base, ...slashEntries];
  });
}

export default function StakingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);

  const {
    logs, stakerCache, isLoading, addLogs, updateStakerCache, refresh,
    page, dbStats, currentPage, pageSize, eventTypeFilter,
    setCurrentPage, setPageSize, setEventTypeFilter,
  } = useStakingLogsStore();

  useEffect(() => {
    if (isLoading) return;
    if (logs.length === 0) {
      addLogs(buildSeedLogs(MOCK_STAKERS)).then(() => {
        MOCK_STAKERS.forEach(s =>
          updateStakerCache({ nodeId: s.id, lastSynced: Date.now(), totalSlashingEvents: s.totalSlashingEvents, healthFactor: s.healthFactor })
        );
      });
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const slashCountByNode = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      if (log.eventType === 'slash') counts[log.nodeId] = (counts[log.nodeId] ?? 0) + 1;
    }
    return counts;
  }, [logs]);

  const healthByNode = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of stakerCache) map[c.nodeId] = c.healthFactor;
    return map;
  }, [stakerCache]);

  const hydratedStakers = useMemo<StakerNode[]>(() =>
    MOCK_STAKERS.map(s => ({
      ...s,
      totalSlashingEvents: slashCountByNode[s.id] ?? s.totalSlashingEvents,
      healthFactor: healthByNode[s.id] ?? s.healthFactor,
    })),
    [slashCountByNode, healthByNode]
  );

  const displayedStakers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return hydratedStakers;
    return hydratedStakers.filter(s =>
      s.nodeName.toLowerCase().includes(q) || s.operatorAddress.toLowerCase().includes(q)
    );
  }, [debouncedSearch, hydratedStakers]);

  const shortenedAddressMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(
      useTransformedCustomAddressField(MOCK_STAKERS, 'operatorAddress').map(s => [s.id, s.shortenedAddress])
    ),
    []
  );

  const totalSlashEvents = useMemo(
    () => Object.values(slashCountByNode).reduce((a, b) => a + b, 0),
    [slashCountByNode]
  );

  return (
    <div className="min-h-screen text-gray-100 p-6 md:p-10"
      style={{ background: 'radial-gradient(ellipse at 20% 0%, #1a0a2e 0%, #0d0618 60%, #07030f 100%)' }}>

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)' }} />
      </div>

      {/* Header */}
      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium tracking-widest uppercase text-violet-400/70">Admin · Security</span>
            <span className="w-1 h-1 rounded-full bg-violet-400/40" />
            <span className="text-xs text-gray-600">Soroban Layer</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Staking & Collateral Pool
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* IndexedDB badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border"
            style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
            <Database size={12} className={isLoading ? 'animate-pulse text-yellow-400' : 'text-emerald-400'} />
            <span>{isLoading ? 'Syncing…' : `${logs.length} logs cached`}</span>
          </div>

          <button onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(245,200,66,0.07)', borderColor: 'rgba(245,200,66,0.2)', color: '#fbbf24' }}>
            <Percent size={14} />
            Adjust Network APY
          </button>

          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
            <Flame size={14} />
            Execute Manual Slashing
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Value Locked" value="270,000 XLM" icon={<Coins size={18} />} subtitle="Crypto economic security" accent="#7c3aed" />
        <StatCard title="Network Reward Pool" value="8,726.45 XLM" icon={<TrendingUp size={18} />} subtitle="Fees ready to distribute" accent="#ec4899" />
        <StatCard title="Active Bonded Nodes" value="4 / 4 Online" icon={<ShieldCheck size={18} />} subtitle="100% validation coverage" accent="#a855f7" />
        <StatCard title="Active Slashing Rules" value={`${totalSlashEvents} Penalties`} icon={<AlertTriangle size={18} />} subtitle="Downtime & faulty feeds" accent="#f43f5e" />
      </div>

      {/* Table Panel */}
      <div className="rounded-2xl overflow-hidden border"
        style={{ background: 'rgba(13,17,23,0.8)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>

        {/* Table toolbar */}
        <div className="px-6 py-4 border-b flex flex-col md:flex-row justify-between gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
            <input
              type="text"
              placeholder="Search by node name or address…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-transparent focus:outline-none transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={refresh}
            className="p-2 rounded-xl border text-gray-400 hover:text-white transition-all self-end md:self-auto"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            title="Refresh from IndexedDB">
            <RefreshCw size={15} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-widest border-b"
                style={{ color: 'rgba(156,163,175,0.6)', borderColor: 'rgba(255,255,255,0.05)' }}>
                <th className="px-6 py-4 font-medium">Node Operator</th>
                <th className="px-6 py-4 font-medium">Bonded Stake</th>
                <th className="px-6 py-4 font-medium">Accrued Fees</th>
                <th className="px-6 py-4 font-medium">Health Rating</th>
                <th className="px-6 py-4 font-medium">Infractions</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedStakers.map((node, i) => (
                <tr key={node.id}
                  className="border-b group transition-all duration-150"
                  style={{
                    borderColor: 'rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }}>
                        {node.nodeName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-100 text-sm">{node.nodeName}</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: 'rgba(156,163,175,0.5)' }}>
                          {shortenedAddressMap[node.id]}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-mono font-medium text-gray-200">
                      {node.stakedAmountXLM.toLocaleString()}
                      <span className="text-xs ml-1 text-gray-500">XLM</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-emerald-400" />
                      <span className="text-sm font-mono font-medium text-emerald-400">
                        +{node.accruedRewardsXLM.toLocaleString()}
                        <span className="text-xs ml-1 text-emerald-600">XLM</span>
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-20 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className={`h-full rounded-full ${getHealthBarColor(node.healthFactor)}`}
                          style={{ width: `${node.healthFactor}%`, transition: 'width 0.6s ease' }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums"
                        style={{ color: node.healthFactor >= 90 ? '#34d399' : node.healthFactor >= 70 ? '#fbbf24' : '#f87171' }}>
                        {node.healthFactor}%
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono ${
                      node.totalSlashingEvents === 0 ? STAKER_SLASHING_NO_EVENTS : STAKER_SLASHING_WITH_EVENTS
                    }`}>
                      {node.totalSlashingEvents > 0 && <AlertTriangle size={10} />}
                      {node.totalSlashingEvents} slash events
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:scale-[1.03]"
                      style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(124,58,237,0.08)' }}>
                      Manage Node
                      <ArrowUpRight size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* IndexedDB Logs Panel */}
      <div className="mt-8">
        <StakingLogsPanel
          page={page}
          dbStats={dbStats}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
          eventTypeFilter={eventTypeFilter}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          onFilterChange={setEventTypeFilter}
          onRefresh={refresh}
        />
      </div>

      {/* Slashing Warning */}
      <div className="mt-5 p-5 rounded-2xl flex gap-4 items-start border"
        style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
        <div className="p-2 rounded-xl shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
          <Gavel size={16} className="text-amber-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-400 mb-1">Oracle Slashing Rule Enforcement active</h4>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(156,163,175,0.7)' }}>
            Staked tokens are automatically locked inside Soroban persistent storage. Any node reporting a price with a deviation higher than your threshold configuration without baseline cross-validation will trigger an automatic 5% collateral slashing protocol.
          </p>
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, icon, subtitle, accent }: {
  title: string; value: string; icon: React.ReactNode; subtitle: string; accent: string;
}) {
  return (
    <div className="relative rounded-2xl p-5 border overflow-hidden group transition-all hover:scale-[1.01]"
      style={{ background: 'rgba(13,17,23,0.8)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      {/* accent glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${accent}18, transparent 70%)` }} />
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-medium tracking-wide" style={{ color: 'rgba(156,163,175,0.7)' }}>{title}</span>
        <div className="p-1.5 rounded-lg" style={{ background: `${accent}18`, color: accent }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-white mb-1">{value}</div>
      <div className="text-xs" style={{ color: 'rgba(107,114,128,0.8)' }}>{subtitle}</div>
    </div>
  );
}
