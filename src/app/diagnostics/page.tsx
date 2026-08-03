'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import { useRpcHealth } from '@/hooks/useRpcHealth';
import type { RpcHealthStatus } from '@/hooks/useRpcHealth';
import { NETWORK_CONFIGS, useOptionalNetwork } from '@/app/components/providers/NetworkProvider';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { clear } from '@/utils/storage';
import { COMMIT_SHA } from '@/config/env';
import packageJson from '../../../package.json';

const SDK_VERSIONS = {
  next: packageJson.dependencies.next,
  react: packageJson.dependencies.react,
  stellarSdk: packageJson.dependencies['@stellar/stellar-sdk'],
  freighterApi: packageJson.dependencies['@stellar/freighter-api'],
} as const;

// ─── types ────────────────────────────────────────────────────────────────────

interface StorageEntry {
  key: string;
  sizeBytes: number;
}

interface WsState {
  status: 'connected' | 'disconnected';
  url: string;
  lastEvent: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: RpcHealthStatus): string {
  switch (status) {
    case 'healthy':    return 'text-green-400';
    case 'degraded':   return 'text-yellow-400';
    case 'unhealthy':  return 'text-red-400';
    case 'checking':   return 'text-gray-400';
  }
}

function statusBadge(status: RpcHealthStatus): string {
  switch (status) {
    case 'healthy':    return 'bg-green-900/40 text-green-400 border border-green-800';
    case 'degraded':   return 'bg-yellow-900/40 text-yellow-400 border border-yellow-800';
    case 'unhealthy':  return 'bg-red-900/40 text-red-400 border border-red-800';
    case 'checking':   return 'bg-gray-800 text-gray-400 border border-gray-700';
  }
}

function StatusIcon({ status }: { status: RpcHealthStatus }) {
  if (status === 'healthy') {
    return <Icon id={ICON_IDS.checkCircle} size={16} className="text-green-400" />;
  }
  if (status === 'unhealthy') {
    return <Icon id={ICON_IDS.alertTriangle} size={16} className="text-red-400" />;
  }
  if (status === 'degraded') {
    return <Icon id={ICON_IDS.alertTriangle} size={16} className="text-yellow-400" />;
  }
  return <Icon id={ICON_IDS.clock} size={16} className="text-gray-400 animate-spin" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTs(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

function readStorageEntries(): StorageEntry[] {
  if (typeof window === 'undefined') return [];
  const entries: StorageEntry[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const raw = window.localStorage.getItem(key) ?? '';
    entries.push({ key, sizeBytes: new Blob([raw]).size });
  }
  return entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-[#161b22] border border-gray-800 rounded-xl p-6 ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({ icon, label, color = 'text-blue-400' }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
      <span className={color}>{icon}</span>
      {label}
    </h2>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DiagnosticsDashboard() {
  // Falls back to "testnet" when rendered outside <NetworkProvider> — this
  // page must work standalone, same as useRpcHealth is designed to.
  const network = useOptionalNetwork()?.network ?? 'testnet';
  const networkConfig = NETWORK_CONFIGS[network];
  const { horizon, soroban, overallStatus, refresh } = useRpcHealth({ network });

  // Storage
  const [storageEntries, setStorageEntries] = useState<StorageEntry[]>(readStorageEntries);
  const refreshStorage = useCallback(() => setStorageEntries(readStorageEntries()), []);

  // WebSocket — reflects the real connection state of the app's shared
  // WebSocketManager singleton (the same socket used for price/orderbook
  // streaming), rather than guessing at global WebSocket instances.
  const [wsState, setWsState] = useState<WsState>(() => ({
    status: WebSocketManager.getInstance().getConnectedStatus() ? 'connected' : 'disconnected',
    url: typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : '',
    lastEvent: null,
  }));

  useEffect(() => {
    const manager = WebSocketManager.getInstance();
    const handleStatus = (connected: boolean) =>
      setWsState((s) => ({ ...s, status: connected ? 'connected' : 'disconnected', lastEvent: new Date().toLocaleTimeString() }));

    manager.subscribeToStatus(handleStatus);
    // Keep the shared socket alive while this page observes it.
    manager.addConsumer();

    return () => {
      manager.unsubscribeFromStatus(handleStatus);
      manager.removeConsumer();
    };
  }, []);

  function handleClearCache() {
    clear();
    window.location.reload();
  }

  const overallBadge = statusBadge(overallStatus);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">Developer Tools / Internal</p>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Icon id={ICON_IDS.terminal} size={28} className="text-blue-400" />
            Debug Dashboard
          </h1>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${overallBadge}`}>
          Overall: {overallStatus}
        </span>
      </div>

      <div className="max-w-5xl space-y-8">

        {/* ── Environment Info ─────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle
            icon={<Icon id={ICON_IDS.cpu} size={20} />}
            label="Environment"
            color="text-purple-400"
          />
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoRow label="Commit SHA" value={COMMIT_SHA} mono />
            <InfoRow label="Network Target" value={networkConfig.label} />
            <InfoRow label="Network Passphrase" value={networkConfig.networkPassphrase} mono />
            <InfoRow label="Next.js" value={SDK_VERSIONS.next} mono />
            <InfoRow label="React" value={SDK_VERSIONS.react} mono />
            <InfoRow label="@stellar/stellar-sdk" value={SDK_VERSIONS.stellarSdk} mono />
            <InfoRow label="@stellar/freighter-api" value={SDK_VERSIONS.freighterApi} mono />
            <InfoRow label="Node Env" value={process.env.NODE_ENV ?? 'unknown'} />
          </dl>
        </SectionCard>

        {/* ── Ping Test Suite ──────────────────────────────────────── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon id={ICON_IDS.activity} size={20} className="text-green-400" />
              RPC Health — Ping Test Suite
            </h2>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-gray-700 hover:border-blue-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Icon id={ICON_IDS.refresh} size={14} />
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            <EndpointRow endpoint={horizon} />
            <EndpointRow endpoint={soroban} />
          </div>
        </SectionCard>

        {/* ── WebSocket Status ─────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle
            icon={<Icon id={wsState.status === 'connected' ? ICON_IDS.wifi : ICON_IDS.wifiOff} size={20} />}
            label="WebSocket Status"
            color={wsState.status === 'connected' ? 'text-green-400' : 'text-gray-500'}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0d1117] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1 uppercase font-bold">Connection</p>
              <p className={`text-sm font-semibold capitalize ${
                wsState.status === 'connected' ? 'text-green-400' : 'text-gray-500'
              }`}>
                {wsState.status}
              </p>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1 uppercase font-bold">Endpoint</p>
              <p className="text-sm font-mono text-gray-300 truncate">
                {wsState.url}
              </p>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1 uppercase font-bold">Last Event</p>
              <p className="text-sm text-gray-300">{wsState.lastEvent ?? '—'}</p>
            </div>
          </div>
        </SectionCard>

        {/* ── Storage Inspector ────────────────────────────────────── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon id={ICON_IDS.database} size={20} className="text-yellow-400" />
              Storage Inspector
            </h2>
            <button
              onClick={refreshStorage}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-gray-700 hover:border-blue-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Icon id={ICON_IDS.refresh} size={14} />
              Scan
            </button>
          </div>

          {storageEntries.length === 0 ? (
            <p className="text-sm text-gray-500 italic">localStorage is empty.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0d1117]">
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold">Key</th>
                    <th className="text-right py-2 px-4 text-xs text-gray-500 uppercase font-bold">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {storageEntries.map((entry) => (
                    <tr key={entry.key} className="border-b border-gray-800/50 hover:bg-[#1c2128] transition-colors">
                      <td className="py-2 px-4 font-mono text-gray-300 truncate max-w-xs">{entry.key}</td>
                      <td className="py-2 px-4 text-right text-gray-400">{formatBytes(entry.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0d1117]">
                    <td className="py-2 px-4 text-xs text-gray-500">{storageEntries.length} key{storageEntries.length !== 1 ? 's' : ''}</td>
                    <td className="py-2 px-4 text-right text-xs text-gray-500">
                      {formatBytes(storageEntries.reduce((sum, e) => sum + e.sizeBytes, 0))} total
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ── Danger Zone ──────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle
            icon={<Icon id={ICON_IDS.shield} size={20} />}
            label="Danger Zone"
            color="text-red-400"
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-900/50 bg-red-900/10">
            <div>
              <p className="text-sm font-medium text-gray-100">Clear App Cache &amp; Reset State</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Wipes all localStorage entries and reloads the page. This cannot be undone.
              </p>
            </div>
            <button
              onClick={handleClearCache}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Icon id={ICON_IDS.zap} size={16} />
              Clear &amp; Reload
            </button>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}

// ─── small atoms ──────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-[#0d1117] rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase font-bold mb-1">{label}</p>
      <p className={`text-sm text-gray-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function EndpointRow({ endpoint }: { endpoint: { label: string; url: string; status: RpcHealthStatus; latencyMs: number | null; lastChecked: number | null; error: string | null } }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-[#0d1117] border border-gray-800">
      <div className="flex items-center gap-3 min-w-0">
        <StatusIcon status={endpoint.status} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{endpoint.label}</p>
          <p className="text-xs text-gray-500 font-mono truncate">{endpoint.url}</p>
          {endpoint.error && (
            <p className="text-xs text-red-400 mt-0.5 truncate">{endpoint.error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {endpoint.latencyMs !== null && (
          <span className={`text-sm font-mono font-semibold ${statusColor(endpoint.status)}`}>
            {endpoint.latencyMs} ms
          </span>
        )}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(endpoint.status)}`}>
          {endpoint.status}
        </span>
        <span className="text-xs text-gray-600 flex items-center gap-1">
          <Icon id={ICON_IDS.clock} size={12} />
          {formatTs(endpoint.lastChecked)}
        </span>
      </div>
    </div>
  );
}
