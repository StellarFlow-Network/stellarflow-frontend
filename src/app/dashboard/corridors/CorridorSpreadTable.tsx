"use client";

import React from "react";
import type { CorridorMetrics } from "../../hooks/useCorridorMetrics";

interface CorridorSpreadTableProps {
  metrics: CorridorMetrics[];
  activePair: string;
  onSelectPair: (pair: string) => void;
}

interface CorridorSpreadRowProps {
  item: CorridorMetrics;
  isActive: boolean;
  onSelectPair: (pair: string) => void;
}

// ---------------------------------------------------------------------------
// CorridorSpreadRow — memoised per ledger row so the per-cell text
// transformations (`toLocaleString`) and format computations (spread/latency
// badge classes) are only re-evaluated when this row's own data — or its
// selected state — actually changes. A sibling corridor updating, a background
// metrics refetch (`isFetching` toggling), or selecting a different row no
// longer forces every stable row to re-run its transformations.
// ---------------------------------------------------------------------------
const CorridorSpreadRow = React.memo(
  function CorridorSpreadRow({
    item,
    isActive,
    onSelectPair,
  }: CorridorSpreadRowProps) {
    return (
      <tr
        onClick={() => onSelectPair(item.pair)}
        className={`cursor-pointer transition-colors duration-150 ${
          isActive
            ? "bg-neutral-800/40 border-l-2 border-lime-500"
            : "hover:bg-neutral-900"
        }`}
      >
        <td className="py-3 px-4 font-bold text-neutral-200">{item.pair}</td>
        <td className="py-3 px-4 text-xs text-neutral-400">{item.source}</td>
        <td className="py-3 px-4 text-right font-mono text-lime-400">
          {item.rate.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </td>
        <td className="py-3 px-4 text-right font-mono text-amber-500">
          {item.spread}%
        </td>
        <td className="py-3 px-4 text-right font-mono">
          ${item.volume24h.toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right font-mono">
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              item.status === "optimal"
                ? "bg-emerald-950/50 text-emerald-400"
                : "bg-amber-950/50 text-amber-400"
            }`}
          >
            {item.latencyMs}ms
          </span>
        </td>
      </tr>
    );
  },
  // Skip the update unless the core row data — or this row's active/selected
  // state — changes. `onSelectPair` is a referentially stable state setter, so
  // its identity is intentionally excluded from the comparison.
  (prev, next) =>
    prev.isActive === next.isActive &&
    prev.item.pair === next.item.pair &&
    prev.item.source === next.item.source &&
    prev.item.rate === next.item.rate &&
    prev.item.spread === next.item.spread &&
    prev.item.volume24h === next.item.volume24h &&
    prev.item.latencyMs === next.item.latencyMs &&
    prev.item.status === next.item.status,
);

CorridorSpreadRow.displayName = "CorridorSpreadRow";

export default function CorridorSpreadTable({
  metrics,
  activePair,
  onSelectPair,
}: CorridorSpreadTableProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
      <h2 className="text-lg font-semibold mb-4 text-neutral-200 flex items-center gap-2">
        <span>🔀</span> Cross-Border Exchange Corridors
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-xs text-neutral-400 uppercase font-mono tracking-wider">
              <th className="py-3 px-4">Asset Pairing</th>
              <th className="py-3 px-4">Telemetry Sources</th>
              <th className="py-3 px-4 text-right">Implied Rate</th>
              <th className="py-3 px-4 text-right">Market Spread</th>
              <th className="py-3 px-4 text-right">24h Vol (USDC)</th>
              <th className="py-3 px-4 text-right">Ingestion Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50 text-sm">
            {metrics.map((item) => (
              <CorridorSpreadRow
                key={item.pair}
                item={item}
                isActive={activePair === item.pair}
                onSelectPair={onSelectPair}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
