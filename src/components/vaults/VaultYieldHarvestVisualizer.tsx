"use client";

import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  Zap,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  useVaultYieldHarvest,
  type HarvestEvent,
  type PoolAllocation,
  type YieldPathNode,
  type YieldPathEdge,
} from "@/hooks/useVaultYieldHarvest";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Node type colour map
// ---------------------------------------------------------------------------

const NODE_STYLES: Record<
  YieldPathNode["type"],
  { border: string; bg: string; text: string; dot: string }
> = {
  source: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  pool: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  router: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
    dot: "bg-violet-400",
  },
  vault: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
};

// ---------------------------------------------------------------------------
// Flowchart — SVG-based layout
// ---------------------------------------------------------------------------

interface FlowNodePos {
  node: YieldPathNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

const NODE_W = 148;
const NODE_H = 68;
const GAP_X = 72;
const GAP_Y = 28;

/**
 * Lay nodes out in columns: source → pools → router → vault
 */
function layoutNodes(
  nodes: YieldPathNode[],
): { positioned: FlowNodePos[]; svgW: number; svgH: number } {
  const colOrder: YieldPathNode["type"][] = ["source", "pool", "router", "vault"];
  const cols: YieldPathNode[][] = colOrder.map((t) =>
    nodes.filter((n) => n.type === t),
  );

  let svgW = 0;
  let svgH = 0;
  const positioned: FlowNodePos[] = [];

  cols.forEach((col, ci) => {
    const colH = col.length * NODE_H + (col.length - 1) * GAP_Y;
    const colX = ci * (NODE_W + GAP_X) + 16;
    const startY = (Math.max(...cols.map((c) => c.length)) * (NODE_H + GAP_Y) - colH) / 2 + 16;

    col.forEach((node, ri) => {
      const y = startY + ri * (NODE_H + GAP_Y);
      positioned.push({ node, x: colX, y, w: NODE_W, h: NODE_H });
      svgW = Math.max(svgW, colX + NODE_W + 16);
      svgH = Math.max(svgH, y + NODE_H + 16);
    });
  });

  return { positioned, svgW, svgH };
}

function YieldFlowchart({
  nodes,
  edges,
}: {
  nodes: YieldPathNode[];
  edges: YieldPathEdge[];
}) {
  const { positioned, svgW, svgH } = useMemo(() => layoutNodes(nodes), [nodes]);
  const posMap = useMemo(
    () => Object.fromEntries(positioned.map((p) => [p.node.id, p])),
    [positioned],
  );

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ minWidth: svgW, height: svgH }}
        aria-label="Yield harvest strategy flowchart"
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = posMap[edge.from];
          const to = posMap[edge.to];
          if (!from || !to) return null;
          const x1 = from.x + from.w;
          const y1 = from.y + from.h / 2;
          const x2 = to.x;
          const y2 = to.y + to.h / 2;
          const mx = (x1 + x2) / 2;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="rgba(100,116,139,0.5)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              {/* Flow amount label */}
              <rect
                x={midX - 22}
                y={midY - 9}
                width={44}
                height={18}
                rx={5}
                fill="#0f172a"
                stroke="rgba(100,116,139,0.3)"
                strokeWidth="1"
              />
              <text
                x={midX}
                y={midY + 4}
                textAnchor="middle"
                fill="rgba(148,163,184,0.9)"
                fontSize="9"
                fontFamily="monospace"
              >
                {edge.label}
              </text>
              {/* Arrow head */}
              <polygon
                points={`${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}`}
                fill="rgba(100,116,139,0.6)"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {positioned.map(({ node, x, y, w, h }) => {
          const s = NODE_STYLES[node.type];
          return (
            <g key={node.id}>
              {/* Node background */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={10}
                className={`${s.bg}`}
                fill="rgba(15,23,42,0.85)"
                stroke={
                  node.type === "source"
                    ? "rgba(245,158,11,0.4)"
                    : node.type === "pool"
                    ? "rgba(14,165,233,0.4)"
                    : node.type === "router"
                    ? "rgba(139,92,246,0.4)"
                    : "rgba(16,185,129,0.4)"
                }
                strokeWidth="1.5"
              />
              {/* Type dot */}
              <circle
                cx={x + 12}
                cy={y + 13}
                r={4}
                fill={
                  node.type === "source"
                    ? "#f59e0b"
                    : node.type === "pool"
                    ? "#38bdf8"
                    : node.type === "router"
                    ? "#a78bfa"
                    : "#34d399"
                }
              />
              {/* Label */}
              <text
                x={x + 22}
                y={y + 17}
                fill={
                  node.type === "source"
                    ? "#fcd34d"
                    : node.type === "pool"
                    ? "#7dd3fc"
                    : node.type === "router"
                    ? "#c4b5fd"
                    : "#6ee7b7"
                }
                fontSize="11"
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
              >
                {node.label}
              </text>
              {/* Sublabel */}
              {node.sublabel && (
                <text
                  x={x + 10}
                  y={y + 33}
                  fill="rgba(148,163,184,0.7)"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  {node.sublabel}
                </text>
              )}
              {/* Value */}
              {node.value && (
                <text
                  x={x + 10}
                  y={y + 54}
                  fill="rgba(226,232,240,0.85)"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {node.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 px-1">
        {(["source", "pool", "router", "vault"] as const).map((t) => {
          const s = NODE_STYLES[t];
          const labels: Record<typeof t, string> = {
            source: "Swap Fee Source",
            pool: "Liquidity Pool",
            router: "Harvest Router",
            vault: "Vault (sfvShares)",
          };
          return (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />
              {labels[t]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool Allocation breakdown
// ---------------------------------------------------------------------------

function AllocationBar({ pct, type }: { pct: number; type: string }) {
  const colors: Record<string, string> = {
    "xlm-usdc": "bg-sky-500",
    "xlm-ngnc": "bg-violet-500",
    "usdc-ngnc": "bg-amber-500",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div
        className={`h-full rounded-full ${colors[type] ?? "bg-lime-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PoolAllocationsPanel({ allocations }: { allocations: PoolAllocation[] }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Strategy Allocations
      </h3>
      <div className="space-y-4">
        {allocations.map((pool) => (
          <div key={pool.poolId} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-neutral-200">
                  {pool.pair}
                </span>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
                  {fmtPct(pool.feeApr)} APR
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-neutral-300">
                {fmtPct(pool.allocationPercent)}
              </span>
            </div>
            <AllocationBar pct={pool.allocationPercent} type={pool.poolId} />
            <div className="flex justify-between text-[11px] text-neutral-500">
              <span>TVL: {fmtUsd(pool.tvlUsd)}</span>
              <span>Fees/day: {fmtUsd(pool.dailyFeesUsd)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Allocation donut (pure CSS) */}
      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            {allocations.reduce(
              (acc, pool, i) => {
                const circumference = 2 * Math.PI * 15.9155;
                const offset = acc.offset;
                const dash = (pool.allocationPercent / 100) * circumference;
                const colors = ["#38bdf8", "#a78bfa", "#fbbf24"];
                acc.elements.push(
                  <circle
                    key={pool.poolId}
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="transparent"
                    stroke={colors[i % colors.length]}
                    strokeWidth="3.5"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />,
                );
                acc.offset += dash;
                return acc;
              },
              { elements: [] as React.ReactNode[], offset: 0 },
            ).elements}
            <circle cx="18" cy="18" r="12" fill="#0a0a0a" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] text-neutral-500">3 pools</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {allocations.map((p, i) => {
            const dotColors = ["bg-sky-400", "bg-violet-400", "bg-amber-400"];
            return (
              <span key={p.poolId} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                <span className={`h-2 w-2 rounded-full ${dotColors[i]}`} />
                {p.pair} — {fmtPct(p.allocationPercent)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Harvest event log row
// ---------------------------------------------------------------------------

function HarvestRow({ event, expanded, onToggle }: {
  event: HarvestEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 transition-colors hover:border-neutral-700">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <Zap size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0 text-left">
            <p className="font-mono text-sm font-bold text-neutral-200">
              {fmtUsd(event.totalHarvestedUsd)} harvested
            </p>
            <p className="text-[11px] text-neutral-500">
              {new Date(event.timestamp).toLocaleString()} · {relativeTime(event.timestamp)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
            <TrendingUp size={10} className="text-lime-400" />
            +{event.compoundedShares.toLocaleString()} shares
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              event.status === "confirmed"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {event.status}
          </span>
          {expanded ? (
            <ChevronUp size={15} className="text-neutral-500" />
          ) : (
            <ChevronDown size={15} className="text-neutral-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-neutral-800 pt-4">
          {/* Pool breakdown */}
          <div className="space-y-2">
            {event.poolBreakdown.map((p) => (
              <div
                key={p.poolId}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-mono text-neutral-400">{p.pair}</span>
                <span className="font-mono font-semibold text-lime-400">
                  {fmtUsd(p.harvestedUsd)}
                </span>
              </div>
            ))}
          </div>

          {/* TX hash */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                TX Hash
              </span>
              <span className="font-mono text-[11px] text-neutral-300">
                {truncateHash(event.txHash)}
              </span>
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
              aria-label="View transaction on Stellar Expert"
            >
              Explorer <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Harvest Logs Panel
// ---------------------------------------------------------------------------

function HarvestLogsPanel({ events }: { events: HarvestEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Harvest Event Log
        </h3>
        <span className="text-[11px] text-neutral-600">
          {events.length} events shown
        </span>
      </div>
      <div className="space-y-2">
        {events.map((event) => (
          <HarvestRow
            key={event.id}
            event={event}
            expanded={expandedId === event.id}
            onToggle={() => toggle(event.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vault summary stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "amber";
}) {
  const valueClass =
    highlight === "green"
      ? "text-emerald-400"
      : highlight === "amber"
      ? "text-amber-400"
      : "text-neutral-100";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-600">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-800/60 ${className ?? ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * VaultYieldHarvestVisualizer — Issue #757
 *
 * Three-panel dashboard for the Multi-Asset Vault Yield Harvest Strategy:
 * 1. Flowchart: swap fees → pool fee collection → harvest router → vault compound
 * 2. Strategy allocations: real-time breakdown across underlying liquidity pools
 * 3. Harvest event log: timestamped transactions with per-pool breakdown
 */
export function VaultYieldHarvestVisualizer() {
  const { data, isLoading, isFetching, refetch } = useVaultYieldHarvest();

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-10 w-80" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-56" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const { vault, yieldPath, poolAllocations, harvestEvents } = data;

  // Aggregate harvest totals
  const totalHarvested24h = harvestEvents
    .filter(
      (e) =>
        Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000,
    )
    .reduce((sum, e) => sum + e.totalHarvestedUsd, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-neutral-500">Vaults / Yield Strategy</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-100">
              {vault.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Multi-asset auto-compounding vault — issue #757
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 self-start rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-60"
            aria-label="Refresh vault data"
          >
            <RefreshCw
              size={14}
              className={isFetching ? "animate-spin text-emerald-400" : ""}
            />
            Refresh
          </button>
        </div>

        {/* ── Vault stats ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Value Locked"
            value={fmtUsd(vault.totalValueLockedUsd)}
            sub={`${vault.totalSharesMinted.toLocaleString()} shares`}
          />
          <StatCard
            label="Current APY"
            value={`${vault.currentApyPercent.toFixed(1)}%`}
            sub="Auto-compounded"
            highlight="green"
          />
          <StatCard
            label="Share Price"
            value={`$${vault.sharePrice.toFixed(4)}`}
            sub="sfvShare USD value"
          />
          <StatCard
            label="Pending Harvest"
            value={fmtUsd(vault.pendingHarvestUsd)}
            sub={`${fmtUsd(totalHarvested24h)} last 24h`}
            highlight="amber"
          />
        </div>

        {/* ── Flowchart ─────────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-300">
            <ArrowRight size={15} className="text-amber-400" />
            Yield Path — Swap Fees → Auto-Compounded Shares
          </h2>
          <YieldFlowchart nodes={yieldPath.nodes} edges={yieldPath.edges} />
        </div>

        {/* ── Allocations + Harvest Log ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-300">
              <TrendingUp size={15} className="text-sky-400" />
              Strategy Allocations
            </h2>
            <PoolAllocationsPanel allocations={poolAllocations} />
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-300">
              <Clock size={15} className="text-violet-400" />
              Harvest Events
            </h2>
            <HarvestLogsPanel events={harvestEvents} />
          </div>
        </div>

        {/* ── Footer note ──────────────────────────────────────────────────── */}
        <p className="text-center text-[11px] text-neutral-700">
          Harvest events auto-triggered every 8h by Soroban contract ·
          Data refreshes every 30s
        </p>
      </div>
    </div>
  );
}

export default VaultYieldHarvestVisualizer;
