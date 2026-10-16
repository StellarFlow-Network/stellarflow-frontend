"use client";

import { calculateImpermanentLoss, type ImpermanentLossInputs } from "./impermanentLoss";

export interface ImpermanentLossCalculatorProps {
  inputs: ImpermanentLossInputs;
  pair?: string;
  className?: string;
}

const usd = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function signedUsd(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${usd.format(Math.abs(value))}`;
}

export function ImpermanentLossCalculator({
  inputs,
  pair = "Active position",
  className = "",
}: ImpermanentLossCalculatorProps) {
  const result = calculateImpermanentLoss(inputs);
  const barScale = Math.max(result.hodlValueUsd, result.activeLpValueUsd, 1);
  const lpWidth = (result.activeLpValueUsd / barScale) * 100;
  const hodlWidth = (result.hodlValueUsd / barScale) * 100;
  const lossTone = result.feeAdjustedLossUsd >= 0 ? "text-emerald-300" : "text-rose-300";

  return (
    <section className={`border border-white/10 bg-[#101820] p-5 text-white ${className}`} aria-label={`${pair} impermanent loss analytics`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-cyan-300">Liquidity analytics</p>
          <h2 className="mt-1 text-lg font-semibold">Impermanent loss</h2>
          <p className="mt-1 text-sm text-slate-400">{pair} · live valuation</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Fee-adjusted ROI</p>
          <p className={`font-mono text-xl font-semibold ${lossTone}`}>
            {result.feeAdjustedRoiPercent >= 0 ? "+" : ""}{result.feeAdjustedRoiPercent.toFixed(2)}%
          </p>
        </div>
      </header>

      <div className="space-y-4" aria-label="Active LP value compared with holding the deposited assets">
        <div>
          <div className="mb-1.5 flex justify-between gap-3 text-sm">
            <span className="text-slate-300">Active LP value</span>
            <strong className="font-mono">{usd.format(result.activeLpValueUsd)}</strong>
          </div>
          <div
            className="h-3 overflow-hidden bg-slate-700"
            role="meter"
            aria-label="Active LP value"
            aria-valuemin={0}
            aria-valuemax={barScale}
            aria-valuenow={result.activeLpValueUsd}
            aria-valuetext={usd.format(result.activeLpValueUsd)}
          >
            <div className="h-full bg-cyan-400" style={{ width: `${lpWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between gap-3 text-sm">
            <span className="text-slate-300">HODL strategy value</span>
            <strong className="font-mono">{usd.format(result.hodlValueUsd)}</strong>
          </div>
          <div
            className="h-3 overflow-hidden bg-slate-700"
            role="meter"
            aria-label="HODL strategy value"
            aria-valuemin={0}
            aria-valuemax={barScale}
            aria-valuenow={result.hodlValueUsd}
            aria-valuetext={usd.format(result.hodlValueUsd)}
          >
            <div className="h-full bg-amber-300" style={{ width: `${hodlWidth}%` }} />
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-sm">
        <div>
          <dt className="text-slate-400">Impermanent loss vs HODL</dt>
          <dd className={`mt-1 font-mono font-semibold ${result.impermanentLossUsd >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {signedUsd(result.impermanentLossUsd)} ({result.impermanentLossPercent.toFixed(2)}%)
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Cumulative fees</dt>
          <dd className="mt-1 font-mono font-semibold text-emerald-300">{signedUsd(result.feesClaimedUsd)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Net IL after fees</dt>
          <dd className={`mt-1 font-mono font-semibold ${lossTone}`}>{signedUsd(result.feeAdjustedLossUsd)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Initial deposit</dt>
          <dd className="mt-1 font-mono font-semibold">{usd.format(result.initialValueUsd)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default ImpermanentLossCalculator;