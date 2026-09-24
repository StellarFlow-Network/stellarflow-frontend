"use client";

import React from 'react';
import type { SorobanResourceMetrics, SorobanBudgetLimits } from '@/types/sorobanBudget';
import { DEFAULT_SOROBAN_LIMITS } from '@/types/sorobanBudget';
import { ContractVersionBadge } from '@/components/contracts/ContractVersionBadge';

interface SorobanBudgetVisualizerProps {
  metrics: SorobanResourceMetrics;
  limits?: SorobanBudgetLimits;
  className?: string;
  /** Optional contract id to surface its version badge next to the title. */
  contractId?: string;
  /** Optional static version tag when no live contract id applies. */
  version?: string;
  /** Optional pre-known wasm hash fast-path for the badge. */
  contractWasmHash?: string;
}

export const SorobanBudgetVisualizer = React.memo(function SorobanBudgetVisualizer({
  metrics,
  limits = DEFAULT_SOROBAN_LIMITS,
  className = '',
  contractId,
  version,
  contractWasmHash,
}: SorobanBudgetVisualizerProps) {
  const cpuRatio = Math.min(100, (metrics.cpuInstructions / limits.maxCpuInstructions) * 100);
  const memBytes = metrics.memoryBytes || ((metrics.writeBytes || 0) + (metrics.readBytes || 0));
  const memRatio = Math.min(100, (memBytes / limits.maxMemoryBytes) * 100);

  const getAlertState = (ratio: number) => {
    if (ratio >= 90) return { color: 'bg-red-500', text: 'text-red-400', alert: 'Critical (Near Limit)' };
    if (ratio >= 75) return { color: 'bg-amber-500', text: 'text-amber-400', alert: 'Warning (High Usage)' };
    return { color: 'bg-emerald-500', text: 'text-emerald-400', alert: 'Normal' };
  };

  const cpuState = getAlertState(cpuRatio);
  const memState = getAlertState(memRatio);

  return (
    <div className={`p-4 rounded-xl bg-slate-900 border border-slate-800 text-white space-y-4 ${className}`}>
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-lg">Soroban Execution Budget &amp; Resources</h3>
          <ContractVersionBadge
            contractId={contractId}
            version={version}
            fallbackWasmHash={contractWasmHash}
            showHash={Boolean(contractWasmHash && !version)}
            showKind
            hideOnError
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">Dry-run Simulation</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-300">CPU Instructions</span>
          <span className={cpuState.text}>
            {metrics.cpuInstructions.toLocaleString()} / {limits.maxCpuInstructions.toLocaleString()} ({cpuRatio.toFixed(1)}%) — {cpuState.alert}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-300 ${cpuState.color}`} style={{ width: `${cpuRatio}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-300">Memory / Footprint (Bytes)</span>
          <span className={memState.text}>
            {memBytes.toLocaleString()} / {limits.maxMemoryBytes.toLocaleString()} ({memRatio.toFixed(1)}%) — {memState.alert}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-300 ${memState.color}`} style={{ width: `${memRatio}%` }} />
        </div>
      </div>
    </div>
  );
});

SorobanBudgetVisualizer.displayName = 'SorobanBudgetVisualizer';
