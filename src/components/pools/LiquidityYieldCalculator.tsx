"use client";

import React, { useState, useMemo, useId } from "react";

export interface LiquidityYieldCalculatorProps {
  /** Current Total Value Locked (TVL) in the pool */
  initialTvl?: number;
  /** Default APY percentage */
  defaultApy?: number;
}

export function LiquidityYieldCalculator({
  initialTvl = 1500000,
  defaultApy = 12.5,
}: LiquidityYieldCalculatorProps) {
  const [assetAAmount, setAssetAAmount] = useState<number>(500);
  const [assetBAmount, setAssetBAmount] = useState<number>(500);
  const [poolApy, setPoolApy] = useState<number>(defaultApy);
  const [durationDays, setDurationDays] = useState<number>(90);
  const [customTvl, setCustomTvl] = useState<number>(initialTvl);

  const assetAInputId = useId();
  const assetBInputId = useId();
  const apySliderId = useId();
  const durationSliderId = useId();
  const tvlInputId = useId();

  // Calculations
  const { totalDepositUsd, estimatedRewardsUsd, finalTotalUsd, effectiveApy } = useMemo(() => {
    const deposit = Math.max(0, assetAAmount) + Math.max(0, assetBAmount);
    // Dynamic APY dilution factor based on pool TVL scaling
    const tvlRatio = initialTvl / Math.max(customTvl, 1);
    const adjustedApy = Math.max(0, poolApy * Math.min(tvlRatio, 5));
    
    const yearFraction = Math.max(0, durationDays) / 365;
    const rewards = deposit * (adjustedApy / 100) * yearFraction;
    const total = deposit + rewards;

    return {
      totalDepositUsd: deposit,
      estimatedRewardsUsd: rewards,
      finalTotalUsd: total,
      effectiveApy: adjustedApy,
    };
  }, [assetAAmount, assetBAmount, poolApy, durationDays, customTvl, initialTvl]);

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl text-white">
      <header className="mb-6">
        <h2 className="text-xl font-bold">Liquidity Pool Yield Calculator</h2>
        <p className="mt-1 text-sm text-gray-400">
          Estimate your returns based on deposit amounts, duration, APY, and dynamic pool TVL.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label htmlFor={assetAInputId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Asset A Amount ($)
            </label>
            <input
              id={assetAInputId}
              type="number"
              min="0"
              step="10"
              value={assetAAmount}
              onChange={(e) => setAssetAAmount(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-gray-800 bg-gray-800/50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor={assetBInputId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Asset B Amount ($)
            </label>
            <input
              id={assetBInputId}
              type="number"
              min="0"
              step="10"
              value={assetBAmount}
              onChange={(e) => setAssetBAmount(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-gray-800 bg-gray-800/50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor={apySliderId} className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Pool APY
              </label>
              <span className="font-mono text-sm text-blue-400 font-bold">{poolApy.toFixed(1)}%</span>
            </div>
            <input
              id={apySliderId}
              type="range"
              min="1"
              max="100"
              step="0.5"
              value={poolApy}
              onChange={(e) => setPoolApy(Number(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor={durationSliderId} className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Duration (Days)
              </label>
              <span className="font-mono text-sm text-blue-400 font-bold">{durationDays} Days</span>
            </div>
            <input
              id={durationSliderId}
              type="range"
              min="7"
              max="365"
              step="1"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <label htmlFor={tvlInputId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Current Pool TVL ($)
            </label>
            <input
              id={tvlInputId}
              type="number"
              min="10000"
              step="10000"
              value={customTvl}
              onChange={(e) => setCustomTvl(Number(e.target.value) || 10000)}
              className="w-full rounded-xl border border-gray-800 bg-gray-800/50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Results summary panel */}
        <div className="flex flex-col justify-between rounded-xl bg-gray-800/30 p-5 border border-gray-800">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-2">
              Estimated Return Summary
            </h3>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Initial Deposit</span>
              <span className="font-mono font-semibold text-white">
                ${totalDepositUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Effective APY</span>
              <span className="font-mono font-semibold text-blue-400">
                {effectiveApy.toFixed(2)}%
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Estimated Earnings</span>
              <span className="font-mono font-semibold text-green-400">
                +${estimatedRewardsUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-800 text-base font-bold">
              <span className="text-gray-300">Total Value</span>
              <span className="font-mono text-white">
                ${finalTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-blue-950/20 p-3 border border-blue-900/30 text-xs text-blue-300">
            💡 Returns scale dynamically as pool TVL and trading volume fluctuate over time.
          </div>
        </div>
      </div>
    </section>
  );
}

export default LiquidityYieldCalculator;
