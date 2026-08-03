"use client";

/**
 * useRpcHealth — pings the active network's Horizon and Soroban RPC
 * endpoints on an interval and classifies each by round-trip latency.
 *
 * Decoupled from `NetworkProvider` on purpose: the hook only needs the
 * static `NETWORK_CONFIGS` table (which endpoint URLs belong to which
 * network), not the provider's lazily-instantiated SDK clients. This lets
 * any component render a latency indicator without requiring the whole tree
 * to be wrapped in `<NetworkProvider>`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NETWORK_CONFIGS,
  type NetworkTarget,
} from "@/app/components/providers/NetworkProvider";

export type RpcHealthStatus = "healthy" | "degraded" | "unhealthy" | "checking";

export interface RpcEndpointHealth {
  label: string;
  url: string;
  status: RpcHealthStatus;
  latencyMs: number | null;
  lastChecked: number | null;
  error: string | null;
}

export interface UseRpcHealthOptions {
  /** Which network's endpoints to monitor. Defaults to "testnet". */
  network?: NetworkTarget;
  /** How often to re-check, in ms. Defaults to 15s. */
  pollIntervalMs?: number;
  /** Latency ceiling (ms) for "healthy"; 2.5x this is the "unhealthy" ceiling. */
  degradedThresholdMs?: number;
  /** Per-request abort timeout, in ms. */
  timeoutMs?: number;
}

export interface UseRpcHealthReturn {
  horizon: RpcEndpointHealth;
  soroban: RpcEndpointHealth;
  overallStatus: RpcHealthStatus;
  /** Force an immediate re-check outside of the poll interval. */
  refresh: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_DEGRADED_THRESHOLD_MS = 800;
const DEFAULT_TIMEOUT_MS = 6_000;

function classify(latencyMs: number, degradedThresholdMs: number): RpcHealthStatus {
  if (latencyMs <= degradedThresholdMs) return "healthy";
  if (latencyMs <= degradedThresholdMs * 2.5) return "degraded";
  return "unhealthy";
}

function idleEndpoint(label: string, url: string): RpcEndpointHealth {
  return { label, url, status: "checking", latencyMs: null, lastChecked: null, error: null };
}

/** GET the Horizon root resource — cheapest way to confirm liveness. */
async function pingHorizon(url: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Horizon responded ${res.status}`);
    return performance.now() - start;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON-RPC `getHealth` — Soroban RPC's dedicated liveness method. */
async function pingSoroban(url: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    if (!res.ok) throw new Error(`Soroban RPC responded ${res.status}`);
    const json = (await res.json()) as { error?: { message?: string } };
    if (json.error) throw new Error(json.error.message ?? "Soroban RPC error");
    return performance.now() - start;
  } finally {
    clearTimeout(timer);
  }
}

export function useRpcHealth(options: UseRpcHealthOptions = {}): UseRpcHealthReturn {
  const {
    network = "testnet",
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    degradedThresholdMs = DEFAULT_DEGRADED_THRESHOLD_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const config = NETWORK_CONFIGS[network];

  const [horizon, setHorizon] = useState<RpcEndpointHealth>(() =>
    idleEndpoint("Horizon", config.horizonUrl),
  );
  const [soroban, setSoroban] = useState<RpcEndpointHealth>(() =>
    idleEndpoint("Soroban RPC", config.sorobanRpcUrl),
  );

  // React-recommended "adjust state during render" pattern: reset both
  // endpoints to "checking" synchronously the instant `network` changes, so
  // stale latency numbers from the previous network never paint. Doing this
  // during render (rather than in an effect) avoids an extra commit.
  const [trackedNetwork, setTrackedNetwork] = useState(network);
  if (trackedNetwork !== network) {
    setTrackedNetwork(network);
    setHorizon(idleEndpoint("Horizon", config.horizonUrl));
    setSoroban(idleEndpoint("Soroban RPC", config.sorobanRpcUrl));
  }

  // Guards a slow in-flight check from clobbering state after a network
  // switch (or unmount) invalidates it.
  const generationRef = useRef(0);

  const checkAll = useCallback(async () => {
    const gen = ++generationRef.current;
    const cfg = NETWORK_CONFIGS[network];
    const now = () => Date.now();

    const [horizonResult, sorobanResult] = await Promise.allSettled([
      pingHorizon(cfg.horizonUrl, timeoutMs),
      pingSoroban(cfg.sorobanRpcUrl, timeoutMs),
    ]);

    if (gen !== generationRef.current) return;

    setHorizon((prev) =>
      horizonResult.status === "fulfilled"
        ? {
            ...prev,
            url: cfg.horizonUrl,
            status: classify(horizonResult.value, degradedThresholdMs),
            latencyMs: Math.round(horizonResult.value),
            lastChecked: now(),
            error: null,
          }
        : {
            ...prev,
            url: cfg.horizonUrl,
            status: "unhealthy",
            latencyMs: null,
            lastChecked: now(),
            error: horizonResult.reason instanceof Error ? horizonResult.reason.message : "Request failed",
          },
    );

    setSoroban((prev) =>
      sorobanResult.status === "fulfilled"
        ? {
            ...prev,
            url: cfg.sorobanRpcUrl,
            status: classify(sorobanResult.value, degradedThresholdMs),
            latencyMs: Math.round(sorobanResult.value),
            lastChecked: now(),
            error: null,
          }
        : {
            ...prev,
            url: cfg.sorobanRpcUrl,
            status: "unhealthy",
            latencyMs: null,
            lastChecked: now(),
            error: sorobanResult.reason instanceof Error ? sorobanResult.reason.message : "Request failed",
          },
    );
  }, [network, timeoutMs, degradedThresholdMs]);

  useEffect(() => {
    void checkAll();
    const id = setInterval(() => void checkAll(), pollIntervalMs);
    return () => clearInterval(id);
  }, [checkAll, pollIntervalMs]);

  const overallStatus: RpcHealthStatus =
    horizon.status === "unhealthy" || soroban.status === "unhealthy"
      ? "unhealthy"
      : horizon.status === "checking" || soroban.status === "checking"
        ? "checking"
        : horizon.status === "degraded" || soroban.status === "degraded"
          ? "degraded"
          : "healthy";

  return { horizon, soroban, overallStatus, refresh: () => void checkAll() };
}
