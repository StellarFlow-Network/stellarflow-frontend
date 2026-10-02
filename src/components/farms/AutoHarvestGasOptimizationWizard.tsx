'use client';

import { useState } from 'react';
import { Gauge, Wallet } from 'lucide-react';

interface AutoHarvestGasOptimizationWizardProps {
  apr: number;
}

export function AutoHarvestGasOptimizationWizard({ apr }: AutoHarvestGasOptimizationWizardProps) {
  const [positionUsd, setPositionUsd] = useState('1000');
  const [gasCostUsd, setGasCostUsd] = useState('0.15');
  const [targetGasPercent, setTargetGasPercent] = useState('5');

  const position = Number(positionUsd);
  const parsedGasCost = Number(gasCostUsd);
  const gasCost = Number.isFinite(parsedGasCost) ? Math.max(0, parsedGasCost) : 0;
  const targetPercent = Number(targetGasPercent);
  const dailyYieldUsd = Number.isFinite(position) && position > 0 && Number.isFinite(apr)
    ? position * Math.max(apr, 0) / 100 / 365
    : 0;
  const intervalDays = dailyYieldUsd > 0 && gasCost > 0 && targetPercent > 0
    ? Math.min(30, Math.max(1, Math.ceil(gasCost / (dailyYieldUsd * targetPercent / 100))))
    : 30;
  const dailyGasPerMonth = gasCost * 30;
  const optimizedGasPerMonth = gasCost * Math.ceil(30 / intervalDays);
  const estimatedSavings = Math.max(0, dailyGasPerMonth - optimizedGasPerMonth);
  const harvestValue = dailyYieldUsd * intervalDays;

  return (
    <section aria-labelledby="harvest-optimizer-title" className="space-y-3 border-y border-gray-800 py-4">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-emerald-400" aria-hidden="true" />
        <div>
          <h4 id="harvest-optimizer-title" className="text-sm font-semibold text-white">Auto-harvest gas optimizer</h4>
          <p className="text-xs text-gray-500">Estimate a harvest interval from your position and transaction cost.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-400">
          Position value (USD)
          <span className="mt-1 flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-2">
            <Wallet size={13} aria-hidden="true" />
            <input aria-label="Position value in USD" type="number" min="0" step="any" value={positionUsd} onChange={(event) => setPositionUsd(event.target.value)} className="min-w-0 w-full bg-transparent py-2 text-sm text-white outline-none" />
          </span>
        </label>
        <label className="text-xs text-gray-400">
          Harvest gas (USD)
          <input aria-label="Harvest gas cost in USD" type="number" min="0" step="any" value={gasCostUsd} onChange={(event) => setGasCostUsd(event.target.value)} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs text-gray-400">
          Max gas share ({targetPercent || 0}%)
          <input aria-label="Maximum gas share of harvested yield" type="range" min="1" max="20" step="1" value={targetGasPercent} onChange={(event) => setTargetGasPercent(event.target.value)} className="mt-2 block w-full accent-emerald-400" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md bg-gray-900/70 p-3 text-sm sm:grid-cols-3">
        <div><p className="text-xs text-gray-500">Suggested interval</p><p className="mt-1 font-semibold text-white">Every {intervalDays} day{intervalDays === 1 ? '' : 's'}</p></div>
        <div><p className="text-xs text-gray-500">Yield per harvest</p><p className="mt-1 font-semibold text-white">${harvestValue.toFixed(2)}</p></div>
        <div className="col-span-2 sm:col-span-1"><p className="text-xs text-gray-500">Estimated monthly gas saved</p><p className="mt-1 font-semibold text-emerald-400">${estimatedSavings.toFixed(2)}</p></div>
      </div>
      <p className="text-[11px] text-gray-600">Estimate only. Actual gas, reward value, and compounding frequency vary on-chain.</p>
    </section>
  );
}