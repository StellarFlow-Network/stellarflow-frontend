'use client';

import React, { useMemo } from 'react';
import { PoolFeeApyTrendChart, type PoolApyDataPoint } from '@/components/charts/PoolFeeApyTrendChart';

interface PoolDetailClientProps {
  poolId: string;
  pair: string;
  feePercent: number;
  totalValueLocked: number;
  apr: number;
  volume24h: number;
  assetA: string;
  assetB: string;
  reserveA: number;
  reserveB: number;
}

function generateMockApyData(poolId: string, baseApy: number): PoolApyDataPoint[] {
  const data: PoolApyDataPoint[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let i = 89; i >= 0; i--) {
    const timestamp = now - i * dayMs;
    const dayVariation = (Math.sin(i * 0.3) + Math.random() * 0.5) * 1.5;
    const feeApy = Math.max(0.5, baseApy * 0.6 + dayVariation);
    const rewardApy = Math.max(0.2, baseApy * 0.4 + (Math.sin(i * 0.2) + Math.random() * 0.3) * 1);
    const volume = Math.max(10000, (baseApy * 100000) + (Math.random() - 0.5) * 50000);
    const tvl = Math.max(500000, (baseApy * 1000000) + (Math.random() - 0.5) * 200000);
    
    data.push({ timestamp, feeApy, rewardApy, volume, tvl });
  }
  
  return data;
}

export function PoolDetailClient({
  poolId,
  pair,
  feePercent,
  totalValueLocked,
  apr,
  volume24h,
  assetA,
  assetB,
  reserveA,
  reserveB,
}: PoolDetailClientProps) {
  const apyData = useMemo(
    () => generateMockApyData(poolId, apr),
    [poolId, apr]
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      <a
        href="/"
        className="text-xs font-mono text-neutral-400 hover:text-lime-400 transition-colors"
      >
        ← Back to Dashboard
      </a>

      <div className="mt-4 mb-8 border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{pair}</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Automated market maker pool · {feePercent}% swap fee
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            TOTAL VALUE LOCKED
          </span>
          <span className="text-2xl font-bold font-mono text-lime-400">
            ${totalValueLocked.toLocaleString()}
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            APR
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {apr}%
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            24H VOLUME
          </span>
          <span className="text-2xl font-bold font-mono">
            ${volume24h.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
          <h2 className="text-lg font-semibold mb-4 text-neutral-200">
            Pool Reserves
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex justify-between text-sm font-mono py-2 px-3 rounded-lg bg-neutral-950/50">
              <span className="text-neutral-400">{assetA}</span>
              <span className="text-neutral-200">
                {reserveA.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm font-mono py-2 px-3 rounded-lg bg-neutral-950/50">
              <span className="text-neutral-400">{assetB}</span>
              <span className="text-neutral-200">
                {reserveB.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
          <h2 className="text-lg font-semibold mb-4 text-neutral-200">
            Fee APY Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Swap Fee Rate</span>
              <span className="text-neutral-200 font-mono">{feePercent}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Fee APY (est.)</span>
              <span className="text-sky-400 font-mono">{(apr * 0.6).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Reward APY (est.)</span>
              <span className="text-amber-400 font-mono">{(apr * 0.4).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm border-t border-neutral-800 pt-2">
              <span className="text-neutral-400">Total APY</span>
              <span className="text-emerald-400 font-mono font-bold">{apr.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* APY Trend Chart */}
      <PoolFeeApyTrendChart
        poolId={poolId}
        pair={pair}
        data={apyData}
        height={450}
      />
    </div>
  );
}

export default PoolDetailClient;