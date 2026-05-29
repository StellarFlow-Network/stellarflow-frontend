'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Database, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, TrendingUp, Coins, ArrowDownLeft,
  Zap, Clock, Filter, Wifi, WifiOff,
} from 'lucide-react';
import type { StakingLogEntry, PageResult } from '@/lib/stakingLogsDb';
import type { DbStats } from '@/app/hooks/useStakingLogsStore';

interface Props {
  page: PageResult<StakingLogEntry> | null;
  dbStats: DbStats | null;
  isLoading: boolean;
  currentPage: number;
  pageSize: number;
  eventTypeFilter: StakingLogEntry['eventType'] | undefined;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onFilterChange: (f: StakingLogEntry['eventType'] | undefined) => void;
  onRefresh: () => void;
}

const EVENT_META: Record<StakingLogEntry['eventType'], { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  stake:   { label: 'Stake',   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)',  icon: <Coins size={11} /> },
  slash:   { label: 'Slash',   color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', icon: <AlertTriangle size={11} /> },
  reward:  { label: 'Reward',  color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)',  icon: <TrendingUp size={11} /> },
  unstake: { label: 'Unstake', color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)',  icon: <ArrowDownLeft size={11} /> },
};

const FILTERS: Array<{ value: StakingLogEntry['eventType'] | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'stake', label: 'Stake' },
  { value: 'slash', label: 'Slash' },
  { value: 'reward', label: 'Reward' },
  { value: 'unstake', label: 'Unstake' },
];

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

function fmtTs(ts: number) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function StakingLogsPanel({
  page, dbStats, isLoading, currentPage, pageSize, eventTypeFilter,
  onPageChange, onPageSizeChange, onFilterChange, onRefresh,
}: Props) {
  const [live, setLive] = useState(false);
  const prevTotal = useRef(dbStats?.totalLogs ?? 0);

  useEffect(() => {
    if (dbStats && dbStats.totalLogs !== prevTotal.current) {
      prevTotal.current = dbStats.totalLogs;
      setLive(true);
      const t = setTimeout(() => setLive(false), 2000);
      return () => clearTimeout(t);
    }
  }, [dbStats]);

  const items = page?.items ?? [];
  const totalPages = page?.totalPages ?? 1;

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{ background: 'rgba(13,17,23,0.85)', borderColor: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}>

      {/* Header */}
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Database size={16} className="text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-100">IndexedDB Log Store</h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', color: '#6ee7b7' }}>
                <span className="relative flex h-2 w-2">
                  {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: live ? '#34d399' : '#374151' }} />
                </span>
                {live ? 'Syncing' : 'Live'}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(156,163,175,0.45)' }}>
              Persistent client-side cache · 7-day TTL eviction
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dbStats && (
            <>
              {[
                { label: 'Total', val: dbStats.totalLogs, c: '#a78bfa' },
                { label: 'Slashes', val: dbStats.slashCount, c: '#f87171' },
                { label: 'Rewards', val: dbStats.rewardCount, c: '#34d399' },
              ].map(({ label, val, c }) => (
                <span key={label} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: `${c}10`, border: `1px solid ${c}25`, color: c }}>
                  <span className="font-bold tabular-nums">{val}</span>
                  <span className="opacity-70">{label}</span>
                </span>
              ))}
            </>
          )}
          <button onClick={onRefresh} disabled={isLoading}
            className="p-2 rounded-xl border text-gray-400 hover:text-white transition-all disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {dbStats && (
        <div className="px-6 py-3 border-b grid grid-cols-2 sm:grid-cols-4 gap-4"
          style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>
          {([
            { icon: <Coins size={12} />, label: 'Stakes', val: dbStats.stakeCount, c: '#60a5fa' },
            { icon: <AlertTriangle size={12} />, label: 'Slashes', val: dbStats.slashCount, c: '#f87171' },
            { icon: <TrendingUp size={12} />, label: 'Rewards', val: dbStats.rewardCount, c: '#34d399' },
            { icon: <ArrowDownLeft size={12} />, label: 'Unstakes', val: dbStats.unstakeCount, c: '#fb923c' },
          ] as const).map(({ icon, label, val, c }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: `${c}12`, color: c }}>{icon}</div>
              <div>
                <div className="text-xs font-bold tabular-nums" style={{ color: c }}>{val}</div>
                <div className="text-xs" style={{ color: 'rgba(156,163,175,0.4)' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="px-6 py-3 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={12} className="text-gray-500 mr-1" />
          {FILTERS.map(opt => {
            const active = opt.value === 'all' ? !eventTypeFilter : eventTypeFilter === opt.value;
            return (
              <button key={opt.value}
                onClick={() => onFilterChange(opt.value === 'all' ? undefined : opt.value as StakingLogEntry['eventType'])}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={active
                  ? { background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.35)' }
                  : { background: 'transparent', color: 'rgba(156,163,175,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Rows:</span>
          {[5, 10, 20].map(s => (
            <button key={s} onClick={() => { onPageSizeChange(s); onPageChange(1); }}
              className="px-2 py-0.5 rounded text-xs transition-all"
              style={pageSize === s
                ? { background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(156,163,175,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)', opacity: 1 - i * 0.07 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <WifiOff size={24} className="text-violet-400 opacity-50" />
            </div>
            <p className="text-sm font-medium" style={{ color: 'rgba(156,163,175,0.5)' }}>No logs in IndexedDB</p>
            <p className="text-xs" style={{ color: 'rgba(156,163,175,0.3)' }}>Logs appear here once staking events are recorded</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-widest border-b"
                style={{ color: 'rgba(156,163,175,0.4)', borderColor: 'rgba(255,255,255,0.04)' }}>
                {['Event', 'Node', 'Amount', 'Tx Hash', 'Time'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 font-medium${i === 4 ? ' text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((log, i) => {
                const m = EVENT_META[log.eventType];
                return (
                  <tr key={log.id} className="border-b transition-colors duration-100"
                    style={{ borderColor: 'rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)')}>

                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                        {m.icon}{m.label}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-gray-200 truncate max-w-[140px]">{log.nodeName}</div>
                      <div className="text-xs font-mono mt-0.5 truncate max-w-[140px]" style={{ color: 'rgba(156,163,175,0.4)' }}>{log.nodeId}</div>
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 text-sm font-mono font-semibold" style={{ color: m.color }}>
                        <Zap size={10} />
                        {log.amountXLM.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        <span className="text-xs font-normal" style={{ color: 'rgba(156,163,175,0.4)' }}>XLM</span>
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      {log.txHash
                        ? <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(156,163,175,0.5)' }}>{log.txHash.slice(0, 8)}…</span>
                        : <span className="text-xs" style={{ color: 'rgba(156,163,175,0.25)' }}>—</span>}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock size={10} style={{ color: 'rgba(156,163,175,0.35)' }} />
                        <div>
                          <div className="text-xs font-medium" style={{ color: 'rgba(156,163,175,0.7)' }}>{timeAgo(log.timestamp)}</div>
                          <div className="text-xs" style={{ color: 'rgba(156,163,175,0.3)' }}>{fmtTs(log.timestamp)}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && items.length > 0 && (
        <div className="px-6 py-3 border-t flex flex-col sm:flex-row justify-between items-center gap-2"
          style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
          <span className="text-xs" style={{ color: 'rgba(156,163,175,0.5)' }}>
            {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, page?.total ?? 0)} of {page?.total ?? 0} logs
          </span>
          <div className="flex items-center gap-1">
            {[
              { icon: <ChevronLeft size={14} />, onClick: () => onPageChange(currentPage - 1), disabled: currentPage <= 1 },
              { icon: <ChevronRight size={14} />, onClick: () => onPageChange(currentPage + 1), disabled: currentPage >= totalPages },
            ].map(({ icon, onClick, disabled }, idx) => (
              <button key={idx} onClick={onClick} disabled={disabled}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(156,163,175,0.6)' }}>
                {icon}
              </button>
            ))}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : Math.max(1, currentPage - 2) + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => onPageChange(p)}
                  className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
                  style={p === currentPage
                    ? { background: 'rgba(124,58,237,0.25)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.4)' }
                    : { background: 'transparent', color: 'rgba(156,163,175,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-2.5 border-t flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(156,163,175,0.4)' }}>
          <Wifi size={11} className="text-emerald-500" />
          <span>Stored in browser IndexedDB · No server round-trips</span>
        </div>
        {dbStats?.newestTimestamp && (
          <span className="text-xs" style={{ color: 'rgba(156,163,175,0.3)' }}>
            Last entry: {timeAgo(dbStats.newestTimestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
