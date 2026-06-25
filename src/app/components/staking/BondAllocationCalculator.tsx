"use client";

import React, { useState, useMemo, useCallback, useId } from "react";
import type { StakerTableRecord } from "./StakerTableRow";
import { SliderRow } from "./SliderRow";

interface BondAllocationCalculatorProps {
  nodes: StakerTableRecord[];
  availableBalance: number;
  onConfirm: (allocations: Record<string, number>) => void;
}

/**
 * Projected annual reward for a single node.
 * Uses healthFactor (0–100) as a proxy APY weight: healthFactor% of 7% base APY.
 */
function projectReward(allocationXLM: number, healthFactor: number): number {
  return allocationXLM * 0.07 * (healthFactor / 100);
}

export function BondAllocationCalculator({
  nodes,
  availableBalance,
  onConfirm,
}: BondAllocationCalculatorProps) {
  // Map of nodeId → committed allocation value (XLM).
  // Updated by SliderRow only on Throttled_Commits, not on every drag event.
  const [allocations, setAllocations] = useState<Record<string, number>>(
    () => Object.fromEntries(nodes.map((n) => [n.id, 0])),
  );

  const handleCommit = useCallback((nodeId: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  // Calculation_Engine — only re-runs when committed allocations or nodes change.
  const { totalAllocated, perNodeRewards, isOverAllocated } = useMemo(() => {
    const total = Object.values(allocations).reduce((s, v) => s + v, 0);
    const rewards = Object.fromEntries(
      nodes.map((n) => [n.id, projectReward(allocations[n.id] ?? 0, n.healthFactor)]),
    );
    return {
      totalAllocated: total,
      perNodeRewards: rewards,
      isOverAllocated: total > availableBalance,
    };
  }, [allocations, nodes, availableBalance]);

  const warningId = useId();

  return (
    <section
      className="mt-8 bg-[#161b22] border border-gray-800 rounded-xl p-6 space-y-6"
      aria-labelledby="bac-heading"
    >
      <h2 id="bac-heading" className="text-lg font-semibold text-white">
        Bond Allocation Calculator
      </h2>

      {/* Sliders — one per node */}
      <div className="space-y-5">
        {nodes.map((node) => (
          <SliderRow
            key={node.id}
            node={node}
            maxAllocation={availableBalance}
            onCommit={handleCommit}
          />
        ))}
      </div>

      {/* Calculation Engine output */}
      <div className="border-t border-gray-800 pt-4 space-y-3">
        {/* Total allocated display */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Allocated</span>
          <span
            id={warningId}
            className={`font-mono font-semibold ${
              isOverAllocated ? "text-red-400" : "text-white"
            }`}
          >
            {totalAllocated.toLocaleString()} / {availableBalance.toLocaleString()} XLM
          </span>
        </div>

        {/* Per-node projected reward rows */}
        {nodes.map((node) => (
          <div key={node.id} className="flex justify-between text-xs text-gray-400">
            <span>{node.nodeName}</span>
            <span className="font-mono text-emerald-400">
              +{(perNodeRewards[node.id] ?? 0).toFixed(2)} XLM / yr
            </span>
          </div>
        ))}

        {/* Distribution percentage bars */}
        <div className="space-y-1 pt-1">
          {nodes.map((node) => {
            const share =
              totalAllocated > 0
                ? ((allocations[node.id] ?? 0) / totalAllocated) * 100
                : 0;
            return (
              <div key={node.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-36 truncate">{node.nodeName}</span>
                <div className="flex-1 bg-gray-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-[width] duration-75"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400 w-10 text-right">
                  {share.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Over-allocation warning */}
      {isOverAllocated && (
        <div
          role="alert"
          aria-describedby={warningId}
          className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm"
        >
          <span>⚠</span>
          <span>
            Allocation exceeds available balance by{" "}
            <span className="font-mono font-semibold">
              {(totalAllocated - availableBalance).toLocaleString()} XLM
            </span>
            . Reduce one or more sliders before confirming.
          </span>
        </div>
      )}

      {/* Confirm Allocation button */}
      <button
        onClick={() => !isOverAllocated && onConfirm(allocations)}
        aria-disabled={isOverAllocated}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
          isOverAllocated
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        Confirm Allocation
      </button>
    </section>
  );
}
