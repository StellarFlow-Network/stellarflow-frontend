"use client";

import { AlertTriangle } from "lucide-react";
import { calculateMinAmountOut } from "@/lib/slippage";

interface SlippageVisualizerProps {
  expectedOutput: number;
  outputSymbol: string;
  slippagePercent: number;
  onSlippageChange: (percent: number) => void;
}

const presets = [0.1, 0.5, 1] as const;

export function SlippageVisualizer({ expectedOutput, outputSymbol, slippagePercent, onSlippageChange }: SlippageVisualizerProps) {
  const minOutput = Number.isFinite(expectedOutput) && expectedOutput > 0
    ? calculateMinAmountOut(expectedOutput, slippagePercent)
    : 0;
  const loss = Math.max(0, expectedOutput - minOutput);
  const highSlippage = slippagePercent > 3;

  return (
    <section className="space-y-3 rounded-lg border border-gray-700 bg-gray-950/50 p-3" aria-label="Slippage tolerance visualizer">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Expected output</span>
        <span className="font-mono text-gray-100">{expectedOutput || 0} {outputSymbol}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-700" role="img" aria-label={`${slippagePercent}% slippage tolerance`}>
        <div className={`h-full rounded-full ${highSlippage ? "bg-red-500" : "bg-cyan-400"}`} style={{ width: `${Math.max(0, 100 - slippagePercent)}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Minimum received</span>
        <span className="font-mono font-semibold text-white">{minOutput} {outputSymbol}</span>
      </div>
      <p className="text-xs text-amber-300">Potential value at risk: {loss.toFixed(6)} {outputSymbol} (output equivalent)</p>
      <div className="flex flex-wrap gap-2" aria-label="Quick slippage settings">
        {presets.map((preset) => <button key={preset} type="button" aria-pressed={slippagePercent === preset} onClick={() => onSlippageChange(preset)} className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:border-cyan-400">{preset.toFixed(preset === 1 ? 1 : 1)}%</button>)}
        <button type="button" aria-pressed={slippagePercent === 0.5} onClick={() => onSlippageChange(0.5)} className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:border-cyan-400">Auto</button>
      </div>
      {highSlippage && <p role="alert" className="flex items-center gap-2 font-bold text-red-400"><AlertTriangle size={14} />Danger: slippage above 3% can cause substantial losses. Acknowledge the risk to continue.</p>}
    </section>
  );
}
