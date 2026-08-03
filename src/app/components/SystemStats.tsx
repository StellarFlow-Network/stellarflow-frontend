"use client";

import React from "react";
import { useHealthStatus } from "@/hooks/useHealthStatus";

type HealthTone = "healthy" | "degraded" | "unhealthy";

function mapGlobalStatus(status: "ACTIVE" | "INACTIVE" | "WARNING"): HealthTone {
  switch (status) {
    case "ACTIVE":
      return "healthy";
    case "WARNING":
      return "degraded";
    default:
      return "unhealthy";
  }
}

function mapOracleStatus(status: "Online" | "Offline" | "Lagging"): HealthTone {
  switch (status) {
    case "Online":
      return "healthy";
    case "Lagging":
      return "degraded";
    default:
      return "unhealthy";
  }
}

function toneClasses(tone: HealthTone): string {
  switch (tone) {
    case "healthy":
      return "border-emerald-800/80 bg-emerald-950/40 text-emerald-300";
    case "degraded":
      return "border-amber-800/80 bg-amber-950/40 text-amber-300";
    default:
      return "border-red-800/80 bg-red-950/40 text-red-300";
  }
}

function dotClasses(tone: HealthTone): string {
  switch (tone) {
    case "healthy":
      return "bg-emerald-400";
    case "degraded":
      return "bg-amber-400";
    default:
      return "bg-red-400";
  }
}

function HealthIndicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: HealthTone;
}) {
  return (
    <div className={`rounded-xl border p-4 ${toneClasses(tone)}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClasses(tone)}`} />
        <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
          {label}
        </p>
      </div>
      <p className="mt-3 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

export function SystemStats() {
  const { health, loading, error, refetch } = useHealthStatus();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/5" />
        <div className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-red-200">
        <p className="text-sm font-semibold">Health check failed</p>
        <p className="mt-1 text-xs opacity-80">{error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-3 rounded-md border border-red-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-red-900/40"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
        No health data available.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">System status</h2>
          <p className="text-sm text-zinc-400">
            Batched health snapshot for core platform services.
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HealthIndicator
          label="Global health"
          value={health.global.status}
          tone={mapGlobalStatus(health.global.status)}
        />
        <HealthIndicator
          label="Oracle health"
          value={health.oracle.status}
          tone={mapOracleStatus(health.oracle.status)}
        />
      </div>
    </section>
  );
}

export default SystemStats;
