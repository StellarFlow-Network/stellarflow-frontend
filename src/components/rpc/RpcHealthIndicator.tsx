"use client";

/**
 * RpcHealthIndicator — nav-bar pill summarising Horizon + Soroban RPC health.
 * `RpcHealthPanel` — fuller breakdown card for dashboard placement.
 *
 * Both share `useRpcHealth` so they always agree on status/latency for a
 * given network without duplicating any polling logic.
 */

import React, { useState } from "react";
import {
  useRpcHealth,
  type RpcEndpointHealth,
  type RpcHealthStatus,
} from "@/hooks/useRpcHealth";
import type { NetworkTarget } from "@/app/components/providers/NetworkProvider";

const STATUS_STYLES: Record<RpcHealthStatus, { dot: string; text: string; border: string; bg: string; label: string }> = {
  healthy: {
    dot: "bg-[#39FF14]",
    text: "text-[#39FF14]",
    border: "border-[#39FF14]/20",
    bg: "bg-[#39FF14]/10",
    label: "Healthy",
  },
  degraded: {
    dot: "bg-yellow-500",
    text: "text-yellow-500",
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/10",
    label: "Degraded",
  },
  unhealthy: {
    dot: "bg-rose-500",
    text: "text-rose-500",
    border: "border-rose-500/20",
    bg: "bg-rose-500/10",
    label: "Unhealthy",
  },
  checking: {
    dot: "bg-gray-500",
    text: "text-gray-400",
    border: "border-zinc-700",
    bg: "bg-zinc-800/60",
    label: "Checking…",
  },
};

function StatusDot({ status }: { status: RpcHealthStatus }) {
  const styles = STATUS_STYLES[status];
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {status !== "checking" && status !== "unhealthy" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${styles.dot}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${styles.dot}`} />
    </span>
  );
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}

export interface RpcHealthIndicatorProps {
  network?: NetworkTarget;
  className?: string;
}

/** Compact pill for the nav bar — click to expand per-endpoint latency. */
export function RpcHealthIndicator({ network = "testnet", className = "" }: RpcHealthIndicatorProps) {
  const { horizon, soroban, overallStatus } = useRpcHealth({ network });
  const [open, setOpen] = useState(false);
  const styles = STATUS_STYLES[overallStatus];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`RPC health: ${styles.label}`}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${styles.border} ${styles.bg}`}
      >
        <StatusDot status={overallStatus} />
        <span className={styles.text}>RPC</span>
        <span className="hidden font-mono text-gray-400 sm:inline">
          {formatLatency(horizon.latencyMs)}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="RPC endpoint latency breakdown"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-zinc-800 bg-[#0A0F1E] p-3 shadow-xl"
        >
          <EndpointRow endpoint={horizon} />
          <div className="my-2 h-px bg-zinc-800" />
          <EndpointRow endpoint={soroban} />
        </div>
      )}
    </div>
  );
}

function EndpointRow({ endpoint }: { endpoint: RpcEndpointHealth }) {
  const styles = STATUS_STYLES[endpoint.status];
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot status={endpoint.status} />
        <span className="truncate font-medium text-gray-300">{endpoint.label}</span>
      </div>
      <span className={`shrink-0 font-mono font-semibold ${styles.text}`}>
        {formatLatency(endpoint.latencyMs)}
      </span>
    </div>
  );
}

/** Fuller detail card for dashboard placement — endpoint URLs + error text. */
export function RpcHealthPanel({ network = "testnet", className = "" }: RpcHealthIndicatorProps) {
  const { horizon, soroban, overallStatus, refresh } = useRpcHealth({ network });
  const styles = STATUS_STYLES[overallStatus];

  return (
    <div className={`rounded-2xl border border-[#1B2A3B] bg-[#0A121E] p-6 shadow-lg ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
            RPC Health
          </p>
          <h3 className="mt-0.5 text-base font-black tracking-tight text-white">Node Status</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles.border} ${styles.bg} ${styles.text}`}>
            <StatusDot status={overallStatus} />
            {styles.label}
          </span>
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh RPC health"
            className="rounded-full border border-[#1B2A3B] px-2 py-1 text-[10px] text-gray-500 transition-colors hover:border-[#39FF14]/40 hover:text-[#39FF14]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <PanelRow endpoint={horizon} />
        <PanelRow endpoint={soroban} />
      </div>
    </div>
  );
}

function PanelRow({ endpoint }: { endpoint: RpcEndpointHealth }) {
  const styles = STATUS_STYLES[endpoint.status];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1B2A3B] bg-[#0A0F1E] px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={endpoint.status} />
          <span className="text-xs font-bold text-gray-200">{endpoint.label}</span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px] text-gray-600">{endpoint.url}</p>
        {endpoint.error && (
          <p className="mt-0.5 truncate text-[10px] text-rose-400">{endpoint.error}</p>
        )}
      </div>
      <span className={`shrink-0 font-mono text-sm font-black ${styles.text}`}>
        {formatLatency(endpoint.latencyMs)}
      </span>
    </div>
  );
}
