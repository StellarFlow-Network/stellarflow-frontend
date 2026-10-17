"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNetwork, useNetworkActions, useNetworkStatus } from "@/components/providers/NetworkProvider";

export interface RPCNode {
  id: string;
  label: string;
  url: string;
}

export type LatencyStatus = "online" | "degraded" | "offline" | "pending";

export interface RPCNodeLatency {
  node: RPCNode;
  latencyMs: number | null;
  status: LatencyStatus;
  lastCheckedAt: number | null;
  error: string | null;
}

export const RPC_NODES: ReadonlyArray<RPCNode> = [
  { id: "testnet", label: "Testnet", url: "https://soroban-testnet.stellar.org" },
  { id: "mainnet", label: "Public", url: "https://soroban-mainnet.stellar.org" },
];

export const RPC_SELECTION_STORAGE_KEY = "stellarflow_rpc_node";

export const LATENCY_THRESHOLDS = {
  online: 250,
  degraded: 800,
} as const;

export function classifyLatency(latencyMs: number | null): LatencyStatus {
  if (latencyMs === null) return "offline";
  if (latencyMs <= LATENCY_THRESHOLDS.online) return "online";
  if (latencyMs <= LATENCY_THRESHOLDS.degraded) return "degraded";
  return "offline";
}

export const STATUS_COLORS: Record<LatencyStatus, string> = {
  online: "bg-[#39FF14]",
  degraded: "bg-yellow-400",
  offline: "bg-red-500",
  pending: "bg-zinc-500",
};

export const STATUS_LABEL: Record<LatencyStatus, string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  pending: "Measuring",
};

export function readStoredRPCId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(RPC_SELECTION_STORAGE_KEY);
    if (stored && RPC_NODES.some((node) => node.id === stored)) return stored;
  } catch {
    /* ignore storage access errors */
  }
  return null;
}

export function persistRPCId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RPC_SELECTION_STORAGE_KEY, id);
  } catch {
    /* ignore storage access errors */
  }
}

export async function measureLatency(url: string, timeoutMs = 5000): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(url.replace(/\/+$/, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getNetwork", params: [] }),
      signal: controller.signal,
      cache: "no-store",
    });
    const elapsed = performance.now() - start;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Math.round(elapsed);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function RPCNodeSelector() {
  const { sorobanUrl } = useNetwork();
  const { switchNetwork } = useNetworkActions();
  const { isSwitching } = useNetworkStatus();

  const [selectedId, setSelectedId] = useState<string>(() => readStoredRPCId() ?? "");
  const [latencies, setLatencies] = useState<Record<string, RPNOdeLatency>>(() =>
    Object.fromEntries(
      RPC_NODES.map((node) => [
        node.id,
        { node, latencyMs: null, status: "pending" as LatencyStatus, lastCheckedAt: null, error: null },
      ]),
    ),
  );
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const mountedRef = useRef(true);

  const runMeasurements = useCallback(async () => {
    setIsMeasuring(true);
    await Promise.all(
      RPC_NODES.map(async (node) => {
        try {
          const latencyMs = await measureLatency(node.url);
          if (!mountedRef.current) return;
          setLatencies((prev) => ({
            ...prev,
            [node.id]: {
              node,
              latencyMs,
              status: classifyLatency(latencyMs),
              lastCheckedAt: Date.now(),
              error: null,
            },
          }));
        } catch (err) {
          if (!mountedRef.current) return;
          setLatencies((prev) => ({
            ...prev,
            [node.id]: {
              node,
              latencyMs: null,
              status: "offline",
              lastCheckedAt: Date.now(),
              error: err instanceof Error ? err.message : "Unreachable",
            },
          }));
        }
      }),
    );
    if (mountedRef.current) setIsMeasuring(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void runMeasurements();
    const interval = window.setInterval(() => void runMeasurements(), 30000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [runMeasurements]);

  useEffect(() => {
    const match = RPC_NODES.find((node) => node.url === sorobanUrl);
    if (match) {
      setSelectedId(match.id);
      persistRPCId(match.id);
    }
  }, [sorobanUrl]);

  const selectNode = useCallback(
    async (node: RPCNode) => {
      setSelectedId(node.id);
      persistRPCId(node.id);
      if (node.id === "testnet" || node.id === "mainnet") {
        await switchNetwork(node.id as "testnet" | "mainnet");
      }
      setIsOpen(false);
    },
    [switchNetwork],
  );

  const activeLatency = useMemo(() => {
    const entry = Object.values(latencies).find((item) => item.node.url === sorobanUrl);
    return entry ?? null;
  }, [latencies, sorobanUrl]);

  const activeStatus: LatencyStatus = activeLatency?.status ?? "pending";
  const activeLabel = activeLatency?.node.label ?? "RPC";

  return (
    <div className="relative inline-flex items-center gap-2 text-xs font-mono">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-zinc-200 hover:border-zinc-500"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[activeStatus]}`} />
        <span className="text-zinc-300">{STATUS_LABEL[activeStatus]}</span>
        <span className="text-zinc-100">{activeLabel}</span>
        <span className="text-zinc-400">
          {activeLatency?.latencyMs != null ? `${activeLatency.latencyMs}ms` : "-"}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 bottom-full mb-2 w-72 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl "
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-200">Soroban RPC Nodes</span>
            <button
              type="button"
              onClick={() => void runMeasurements()}
              disabled={isMeasuring}
              className="text-xs text-[#39FF14] disabled:opacity-50 hover:underline"
            >
              {isMeasuring ? "Measuring…" : "Refresh"}
            </button>
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {RPC_NODES.map((node) => {
              const metric = latencies[node.id];
              const status = metric?.status ?? "pending";
              const isActive = node.url === sorobanUrl;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => void selectNode(node)}
                    disabled={isSwitching}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${isActive ? "bg-zinc-800/60" : "hover:bg-zinc-900"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} />
                      <span className="text-zinc-100">{node.label}</span>
                    </span>
                    <span className="text-xs text-zinc-400">
                      {metric?.latencyMs != null ? `${metric.latencyMs}ms` : STATUS_LABEL[status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
