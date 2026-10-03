"use client";

/**
 * useRpcBenchmark — benchmarks multiple Soroban RPC endpoints in parallel,
 * measuring response latency, block height, and availability. Results are
 * ranked by performance to help users identify the fastest endpoint.
 *
 * Supports both the built-in public endpoints and caller-supplied custom /
 * private endpoints so private infrastructure can be compared in the same run.
 */

import { useCallback, useRef, useState } from "react";
import type { NetworkTarget } from "@/app/components/providers/NetworkProvider";

// ─── types ───────────────────────────────────────────────────────────────────

export interface RpcBenchmarkEndpoint {
  url: string;
  label: string;
  network: NetworkTarget;
  /** True for caller-added private/custom endpoints (never shown in the
   *  static "Supported Endpoints" list, but included in every run). */
  custom?: boolean;
}

export type BenchmarkStatus = "pending" | "running" | "completed" | "failed";

export interface RpcBenchmarkResult {
  url: string;
  label: string;
  network: NetworkTarget;
  /**
   * 1-based rank among responding endpoints; 0 means the endpoint did not
   * respond and is therefore unranked.
   */
  rank: number;
  latencyMs: number | null;
  blockHeight: number | null;
  /** How many ledgers behind the highest block seen across all endpoints. */
  blockSyncDiff: number | null;
  available: boolean;
  error: string | null;
  status: BenchmarkStatus;
  custom?: boolean;
}

export interface UseRpcBenchmarkOptions {
  /** Extra endpoints (e.g. private/self-hosted nodes) included in every run. */
  extraEndpoints?: RpcBenchmarkEndpoint[];
}

export interface UseRpcBenchmarkReturn {
  results: RpcBenchmarkResult[];
  benchmarkStatus: BenchmarkStatus;
  runBenchmark: () => Promise<void>;
}

// ─── constants ───────────────────────────────────────────────────────────────

const BENCHMARK_TIMEOUT_MS = 10_000;

const PUBLIC_TESTNET_ENDPOINTS: RpcBenchmarkEndpoint[] = [
  { url: "https://soroban-testnet.stellar.org", label: "Stellar Testnet", network: "testnet" },
  { url: "https://rpc-testnet.stellar.org", label: "RPC Testnet", network: "testnet" },
];

const PUBLIC_MAINNET_ENDPOINTS: RpcBenchmarkEndpoint[] = [
  { url: "https://soroban.stellar.org", label: "Stellar Mainnet", network: "mainnet" },
  { url: "https://rpc-mainnet.stellar.org", label: "RPC Mainnet", network: "mainnet" },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fetchJsonRpc(
  url: string,
  method: string,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
    if (json.error) throw new Error(json.error.message ?? "RPC error");
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

interface HealthResult {
  latencyMs: number;
}

async function benchmarkHealth(url: string, timeoutMs: number): Promise<HealthResult> {
  const start = performance.now();
  await fetchJsonRpc(url, "getHealth", timeoutMs);
  return { latencyMs: Math.round(performance.now() - start) };
}

interface LedgerResult {
  sequence: number;
}

async function benchmarkLedger(url: string, timeoutMs: number): Promise<LedgerResult> {
  const result = (await fetchJsonRpc(url, "getLatestLedger", timeoutMs)) as {
    sequence?: number;
  };
  return { sequence: result.sequence ?? 0 };
}

function initialResult(ep: RpcBenchmarkEndpoint): RpcBenchmarkResult {
  return {
    url: ep.url,
    label: ep.label,
    network: ep.network,
    rank: 0,
    latencyMs: null,
    blockHeight: null,
    blockSyncDiff: null,
    available: false,
    error: null,
    status: "running",
    custom: ep.custom,
  };
}

export function classifyLatency(ms: number): string {
  if (ms < 300) return "fast";
  if (ms < 800) return "moderate";
  return "slow";
}

// ─── hook ────────────────────────────────────────────────────────────────────

export function useRpcBenchmark(
  network: NetworkTarget = "testnet",
  options: UseRpcBenchmarkOptions = {},
): UseRpcBenchmarkReturn {
  const { extraEndpoints = [] } = options;

  const buildEndpointList = useCallback((): RpcBenchmarkEndpoint[] => {
    const base =
      network === "mainnet" ? PUBLIC_MAINNET_ENDPOINTS : PUBLIC_TESTNET_ENDPOINTS;
    // Merge extra endpoints, deduplicating by URL so callers can freely pass
    // the same list without risk of double-testing an endpoint.
    const seen = new Set(base.map((e) => e.url));
    const extras = extraEndpoints.filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });
    return [...base, ...extras];
  }, [network, extraEndpoints]);

  const [results, setResults] = useState<RpcBenchmarkResult[]>(() =>
    buildEndpointList().map(initialResult),
  );
  const [benchmarkStatus, setBenchmarkStatus] = useState<BenchmarkStatus>("pending");
  const generationRef = useRef(0);

  const runBenchmark = useCallback(async () => {
    const gen = ++generationRef.current;
    const endpoints = buildEndpointList();

    setBenchmarkStatus("running");
    // Show all endpoints immediately as "running" so the table isn't empty
    // during the benchmark — gives instant visual feedback that requests
    // are in-flight in parallel.
    setResults(endpoints.map(initialResult));

    // ── fire all endpoint probes concurrently ─────────────────────────────
    const settled = await Promise.allSettled(
      endpoints.map(async (ep): Promise<RpcBenchmarkResult | null> => {
        try {
          // Health check and ledger height run in parallel for each endpoint.
          const [healthResult, ledgerResult] = await Promise.allSettled([
            benchmarkHealth(ep.url, BENCHMARK_TIMEOUT_MS),
            benchmarkLedger(ep.url, BENCHMARK_TIMEOUT_MS),
          ]);

          // A newer runBenchmark() call has started — discard stale results.
          if (gen !== generationRef.current) return null;

          const latencyMs =
            healthResult.status === "fulfilled" ? healthResult.value.latencyMs : null;
          const blockHeight =
            ledgerResult.status === "fulfilled" ? ledgerResult.value.sequence : null;

          // Surface the most actionable error: prefer the health-check failure
          // (it's the primary liveness signal) then fall back to ledger failure.
          const error =
            healthResult.status === "rejected"
              ? healthResult.reason instanceof Error
                ? healthResult.reason.message
                : "Request failed"
              : ledgerResult.status === "rejected"
                ? ledgerResult.reason instanceof Error
                  ? ledgerResult.reason.message
                  : "Ledger fetch failed"
                : null;

          return {
            url: ep.url,
            label: ep.label,
            network: ep.network,
            rank: 0,
            latencyMs,
            blockHeight,
            blockSyncDiff: null, // filled in after all probes finish
            available: latencyMs !== null,
            error,
            status: latencyMs !== null ? "completed" : "failed",
            custom: ep.custom,
          };
        } catch (err) {
          if (gen !== generationRef.current) return null;
          return {
            url: ep.url,
            label: ep.label,
            network: ep.network,
            rank: 0,
            latencyMs: null,
            blockHeight: null,
            blockSyncDiff: null,
            available: false,
            error: err instanceof Error ? err.message : "Unexpected error",
            status: "failed",
            custom: ep.custom,
          };
        }
      }),
    );

    if (gen !== generationRef.current) return;

    const probed = settled
      .filter(
        (r): r is PromiseFulfilledResult<RpcBenchmarkResult | null> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value!);

    // ── calculate block-sync diff ─────────────────────────────────────────
    const maxBlock = Math.max(0, ...probed.map((r) => r.blockHeight ?? 0));
    const withSync = probed.map((r) => ({
      ...r,
      blockSyncDiff: r.blockHeight !== null ? maxBlock - r.blockHeight : null,
    }));

    // ── rank: available → latency asc → block height desc ────────────────
    // Unavailable endpoints are placed last and receive rank 0 (unranked)
    // so the UI can render them with a "—" instead of a position number.
    const available = withSync.filter((r) => r.available);
    const unavailable = withSync.filter((r) => !r.available);

    available.sort((a, b) => {
      const aLat = a.latencyMs ?? Number.POSITIVE_INFINITY;
      const bLat = b.latencyMs ?? Number.POSITIVE_INFINITY;
      if (aLat !== bLat) return aLat - bLat;
      return (b.blockHeight ?? 0) - (a.blockHeight ?? 0);
    });

    const ranked: RpcBenchmarkResult[] = [
      ...available.map((r, i) => ({ ...r, rank: i + 1 })),
      ...unavailable.map((r) => ({ ...r, rank: 0 })),
    ];

    setResults(ranked);
    setBenchmarkStatus("completed");
  }, [buildEndpointList]);

  return { results, benchmarkStatus, runBenchmark };
}

export { PUBLIC_TESTNET_ENDPOINTS, PUBLIC_MAINNET_ENDPOINTS };
