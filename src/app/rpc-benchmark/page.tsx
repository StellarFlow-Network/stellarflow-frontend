'use client';

/**
 * RPC Endpoint Benchmark — Issue #776
 *
 * Benchmarks multiple Soroban RPC endpoints in parallel and helps users
 * connect to the fastest available node.
 *
 * Features:
 *  - Public endpoints for the active network are pre-loaded.
 *  - Users can add private / custom endpoints via the input form; these are
 *    included in every benchmark run alongside the public ones.
 *  - All probes fire concurrently (Promise.allSettled); rows show a spinner
 *    while their probe is in-flight.
 *  - Results display latency, block height, block-sync diff, and
 *    availability status, ranked best-to-worst.
 *  - "Connect to Fastest" wires the top-ranked available endpoint into
 *    rpcManager so the rest of the app immediately uses it.
 *  - Timeouts, unreachable endpoints, and malformed responses are caught
 *    gracefully; they show an error cell and are ranked last.
 */

import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import {
  useRpcBenchmark,
  classifyLatency,
  PUBLIC_TESTNET_ENDPOINTS,
  PUBLIC_MAINNET_ENDPOINTS,
} from '@/hooks/useRpcBenchmark';
import type { RpcBenchmarkEndpoint, RpcBenchmarkResult } from '@/hooks/useRpcBenchmark';
import { useOptionalNetwork } from '@/app/components/providers/NetworkProvider';
import { rpcManager } from '@/services/rpc';
import { useOptionalToast } from '@/components/ui/ToastQueue';

// ─── layout atoms ────────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-[#161b22] border border-gray-800 rounded-xl p-6 ${className}`}>
      {children}
    </section>
  );
}

// ─── cell components ─────────────────────────────────────────────────────────

function StatusBadge({ available, running }: { available: boolean; running: boolean }) {
  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800">
        <Icon id={ICON_IDS.clock} size={11} className="animate-spin" />
        Testing
      </span>
    );
  }
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
        available
          ? 'bg-green-900/40 text-green-400 border border-green-800'
          : 'bg-red-900/40 text-red-400 border border-red-800'
      }`}
    >
      {available ? 'Online' : 'Offline'}
    </span>
  );
}

function LatencyDisplay({ latencyMs, running }: { latencyMs: number | null; running: boolean }) {
  if (running) return <span className="text-sm font-mono text-gray-600">—</span>;
  if (latencyMs === null) return <span className="text-sm font-mono text-gray-500">—</span>;
  const cls = classifyLatency(latencyMs);
  const color =
    cls === 'fast' ? 'text-green-400' : cls === 'moderate' ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-sm font-mono font-semibold ${color}`}>{latencyMs} ms</span>;
}

function BlockHeightDisplay({
  height,
  syncDiff,
  running,
}: {
  height: number | null;
  syncDiff: number | null;
  running: boolean;
}) {
  if (running) return <span className="text-sm font-mono text-gray-600">—</span>;
  if (height === null) return <span className="text-sm font-mono text-gray-500">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-mono text-gray-200">{height.toLocaleString()}</span>
      {syncDiff !== null && syncDiff > 0 && (
        <span className="text-[11px] text-yellow-400">−{syncDiff} behind</span>
      )}
      {syncDiff === 0 && <span className="text-[11px] text-green-400">Latest</span>}
    </div>
  );
}

function RankBadge({ rank, running }: { rank: number; running: boolean }) {
  if (running) return <span className="text-sm text-gray-700 font-mono">—</span>;
  if (rank === 0) return <span className="text-sm text-gray-600 font-mono">—</span>;
  const colors =
    rank === 1
      ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
      : rank === 2
        ? 'bg-gray-700/40 text-gray-300 border border-gray-600'
        : rank === 3
          ? 'bg-orange-900/40 text-orange-400 border border-orange-800'
          : 'bg-gray-800 text-gray-500 border border-gray-700';
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${colors}`}>
      #{rank}
    </span>
  );
}

// ─── result row ──────────────────────────────────────────────────────────────

function ResultRow({
  result,
  isActive,
  isRunning,
}: {
  result: RpcBenchmarkResult;
  isActive: boolean;
  isRunning: boolean;
}) {
  const rowRunning = isRunning || result.status === 'running';
  return (
    <tr
      className={`border-b border-gray-800/50 transition-colors ${
        isActive ? 'bg-blue-900/10 hover:bg-blue-900/15' : 'hover:bg-[#1c2128]'
      }`}
    >
      {/* Rank */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <RankBadge rank={result.rank} running={rowRunning} />
          {isActive && !rowRunning && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-800/40 text-blue-300 border border-blue-700">
              ACTIVE
            </span>
          )}
          {result.custom && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700">
              CUSTOM
            </span>
          )}
        </div>
      </td>
      {/* Endpoint */}
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-medium text-gray-100">{result.label}</p>
          <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{result.url}</p>
        </div>
      </td>
      {/* Status */}
      <td className="py-3 px-4">
        <StatusBadge available={result.available} running={rowRunning} />
      </td>
      {/* Latency */}
      <td className="py-3 px-4">
        <LatencyDisplay latencyMs={result.latencyMs} running={rowRunning} />
      </td>
      {/* Block height */}
      <td className="py-3 px-4">
        <BlockHeightDisplay height={result.blockHeight} syncDiff={result.blockSyncDiff} running={rowRunning} />
      </td>
      {/* Error */}
      <td className="py-3 px-4">
        {!rowRunning && result.error ? (
          <span
            className="text-xs text-red-400 max-w-[200px] truncate block"
            title={result.error}
          >
            {result.error}
          </span>
        ) : (
          <span className="text-xs text-gray-700">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── custom endpoint form ────────────────────────────────────────────────────

interface CustomEndpointFormProps {
  network: 'testnet' | 'mainnet';
  onAdd: (endpoint: RpcBenchmarkEndpoint) => void;
}

function CustomEndpointForm({ network, onAdd }: CustomEndpointFormProps) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmedUrl = url.trim();
    const trimmedLabel = label.trim();

    // Basic URL validation — must start with https:// or http://
    if (!trimmedUrl) {
      setError('URL is required.');
      return;
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        setError('URL must use http:// or https://.');
        return;
      }
    } catch {
      setError('Enter a valid URL (e.g. https://my-rpc.example.com).');
      return;
    }

    setError(null);
    onAdd({
      url: trimmedUrl,
      label: trimmedLabel || new URL(trimmedUrl).hostname,
      network,
      custom: true,
    });
    setUrl('');
    setLabel('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Add a private or self-hosted Soroban RPC node to include in the benchmark alongside the
        public endpoints.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 uppercase font-bold mb-1 block" htmlFor="custom-rpc-url">
            Endpoint URL
          </label>
          <input
            id="custom-rpc-url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="https://my-rpc.example.com"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div className="sm:w-48">
          <label className="text-xs text-gray-500 uppercase font-bold mb-1 block" htmlFor="custom-rpc-label">
            Label (optional)
          </label>
          <input
            id="custom-rpc-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="My Node"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-600 active:bg-purple-800 whitespace-nowrap"
          >
            <Icon id={ICON_IDS.plus} size={16} />
            Add Endpoint
          </button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <Icon id={ICON_IDS.alertTriangle} size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── custom endpoint tag ─────────────────────────────────────────────────────

function CustomEndpointTag({
  endpoint,
  onRemove,
}: {
  endpoint: RpcBenchmarkEndpoint;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-purple-800/50 bg-purple-900/10 px-3 py-2">
      <Icon id={ICON_IDS.globe} size={14} className="text-purple-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-200 truncate">{endpoint.label}</p>
        <p className="text-[10px] text-gray-500 font-mono truncate">{endpoint.url}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${endpoint.label}`}
        className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-0.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function RpcBenchmarkPage() {
  const network = useOptionalNetwork()?.network ?? 'testnet';
  const toast = useOptionalToast();

  // Custom / private endpoints added by the user for this session.
  const [customEndpoints, setCustomEndpoints] = useState<RpcBenchmarkEndpoint[]>([]);

  const { results, benchmarkStatus, runBenchmark } = useRpcBenchmark(network, {
    extraEndpoints: customEndpoints,
  });

  const [activeUrl, setActiveUrl] = useState<string>(() => rpcManager.getCurrentEndpoint()?.url ?? '');

  const fastestAvailable = useMemo(
    () => results.find((r) => r.available && r.rank === 1) ?? null,
    [results],
  );

  const handleConnect = useCallback(
    (url: string, label: string) => {
      rpcManager.setCurrentUrl(url);
      setActiveUrl(url);
      toast?.addToast({
        status: 'confirmed',
        title: 'RPC endpoint updated',
        description: `Now using ${label} (${new URL(url).hostname}).`,
      });
    },
    [toast],
  );

  const handleConnectFastest = useCallback(() => {
    if (!fastestAvailable) return;
    handleConnect(fastestAvailable.url, fastestAvailable.label);
  }, [fastestAvailable, handleConnect]);

  const handleAddCustom = useCallback((endpoint: RpcBenchmarkEndpoint) => {
    setCustomEndpoints((prev) => {
      if (prev.some((e) => e.url === endpoint.url)) return prev;
      return [...prev, endpoint];
    });
  }, []);

  const handleRemoveCustom = useCallback((url: string) => {
    setCustomEndpoints((prev) => prev.filter((e) => e.url !== url));
  }, []);

  const publicEndpoints = network === 'mainnet' ? PUBLIC_MAINNET_ENDPOINTS : PUBLIC_TESTNET_ENDPOINTS;
  const totalEndpoints = publicEndpoints.length + customEndpoints.length;
  const availableCount = results.filter((r) => r.available).length;
  const isBenchmarkRunning = benchmarkStatus === 'running';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">Developer Tools / Network</p>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Icon id={ICON_IDS.signal} size={28} className="text-green-400" />
          RPC Endpoint Benchmark
        </h1>
        <p className="mt-2 text-sm text-gray-400 max-w-2xl">
          Test and compare Soroban RPC endpoint performance. All requests run in parallel to
          measure real-world latency, block height, and availability — then rank results so you
          can connect to the fastest node in one click.
        </p>
      </div>

      <div className="max-w-5xl space-y-8">

        {/* ── Controls ───────────────────────────────────────────────────────── */}
        <SectionCard>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Summary stats */}
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Network</p>
                <span className="text-sm font-medium text-gray-200 capitalize">{network}</span>
              </div>
              <div className="h-8 w-px bg-gray-800" />
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Endpoints</p>
                <span className="text-sm font-medium text-gray-200">{totalEndpoints} configured</span>
              </div>
              {benchmarkStatus === 'completed' && (
                <>
                  <div className="h-8 w-px bg-gray-800" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Available</p>
                    <span className="text-sm font-medium text-green-400">
                      {availableCount}/{results.length}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {fastestAvailable && benchmarkStatus === 'completed' && (
                <button
                  type="button"
                  onClick={handleConnectFastest}
                  className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 active:bg-green-800"
                >
                  <Icon id={ICON_IDS.zap} size={16} />
                  Connect to Fastest
                </button>
              )}
              <button
                type="button"
                onClick={() => void runBenchmark()}
                disabled={isBenchmarkRunning}
                className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon
                  id={ICON_IDS.refresh}
                  size={16}
                  className={isBenchmarkRunning ? 'animate-spin' : ''}
                />
                {isBenchmarkRunning ? 'Running…' : 'Run Benchmark'}
              </button>
            </div>
          </div>

          {/* Active endpoint indicator */}
          {activeUrl && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-900/15 border border-blue-800/40 px-4 py-2 text-sm text-blue-300">
              <Icon id={ICON_IDS.checkCircle} size={15} />
              <span>
                Active endpoint:{' '}
                <span className="font-mono text-blue-200">{activeUrl}</span>
              </span>
            </div>
          )}
        </SectionCard>

        {/* ── Results Table ───────────────────────────────────────────────────── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon id={ICON_IDS.activity} size={20} className="text-blue-400" />
              Benchmark Results
            </h2>
            {isBenchmarkRunning && (
              <span className="text-xs text-blue-400 flex items-center gap-1.5">
                <Icon id={ICON_IDS.clock} size={14} className="animate-spin" />
                Testing {results.length} endpoints in parallel…
              </span>
            )}
          </div>

          {benchmarkStatus === 'pending' ? (
            <p className="text-sm text-gray-500 italic">
              Click &quot;Run Benchmark&quot; to test endpoint performance.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0d1117]">
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold w-24">Rank</th>
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold">Endpoint</th>
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold w-28">Status</th>
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold w-28">Latency</th>
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold w-36">Block Height</th>
                    <th className="text-left py-2 px-4 text-xs text-gray-500 uppercase font-bold">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <ResultRow
                      key={result.url}
                      result={result}
                      isActive={result.url === activeUrl}
                      isRunning={isBenchmarkRunning}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-row connect buttons — shown after a completed benchmark */}
          {benchmarkStatus === 'completed' && results.some((r) => r.available) && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase font-bold mb-2">Connect to a specific endpoint</p>
              <div className="flex flex-wrap gap-2">
                {results
                  .filter((r) => r.available)
                  .map((r) => (
                    <button
                      key={r.url}
                      type="button"
                      onClick={() => handleConnect(r.url, r.label)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        r.url === activeUrl
                          ? 'border-blue-600 bg-blue-900/20 text-blue-300'
                          : 'border-gray-700 bg-[#0d1117] text-gray-300 hover:border-gray-500 hover:text-white'
                      }`}
                    >
                      {r.url === activeUrl && <Icon id={ICON_IDS.checkCircle} size={12} className="text-blue-400" />}
                      {r.label}
                      {r.rank > 0 && (
                        <span className="text-gray-500">#{r.rank}</span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Custom / Private Endpoints ──────────────────────────────────────── */}
        <SectionCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Icon id={ICON_IDS.cpu} size={20} className="text-purple-400" />
            Custom / Private Endpoints
          </h2>

          <CustomEndpointForm network={network} onAdd={handleAddCustom} />

          {customEndpoints.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase font-bold mb-2">
                Added ({customEndpoints.length})
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {customEndpoints.map((ep) => (
                  <CustomEndpointTag
                    key={ep.url}
                    endpoint={ep}
                    onRemove={() => handleRemoveCustom(ep.url)}
                  />
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Public Endpoints Reference ──────────────────────────────────────── */}
        <SectionCard>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Icon id={ICON_IDS.globe} size={20} className="text-gray-400" />
            Public Endpoints
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            These Soroban RPC endpoints are pre-configured for the selected network and are
            always included in the benchmark.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {publicEndpoints.map((ep) => (
              <div
                key={ep.url}
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] p-3"
              >
                <Icon id={ICON_IDS.globe} size={16} className="text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200">{ep.label}</p>
                  <p className="text-xs text-gray-500 font-mono truncate">{ep.url}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
