"use client";

import { useMemo, useState } from "react";

function calculateImpermanentLoss(priceRatio: number) {
  if (!Number.isFinite(priceRatio) || priceRatio <= 0) return -100;
  return ((2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1) * 100;
}

export function ILCalculator() {
  const [assetAChange, setAssetAChange] = useState(0);
  const [assetBChange, setAssetBChange] = useState(0);
  const [initialInvestment, setInitialInvestment] = useState(1000);

  const result = useMemo(() => {
    const ratioA = Math.max(0, 1 + assetAChange / 100);
    const ratioB = Math.max(0, 1 + assetBChange / 100);
    const priceRatio = ratioB === 0 ? 0 : ratioA / ratioB;
    const ilPercentage = calculateImpermanentLoss(priceRatio);
    const hodlValue = (initialInvestment / 2) * (ratioA + ratioB);
    const lpValue = hodlValue * (1 + ilPercentage / 100);
    return { priceRatio, ilPercentage, hodlValue, lpValue };
  }, [assetAChange, assetBChange, initialInvestment]);

  const curve = useMemo(() => {
    const points = Array.from({ length: 41 }, (_, index) => {
      const ratio = Math.pow(4, index / 20 - 1);
      const x = 10 + (index / 40) * 280;
      const y = 150 - Math.max(0, Math.abs(calculateImpermanentLoss(ratio))) * 1.25;
      return `${x.toFixed(1)},${Math.max(12, y).toFixed(1)}`;
    });
    return points.join(" ");
  }, []);

  const risk = Math.abs(result.ilPercentage) >= 20 ? "High" : Math.abs(result.ilPercentage) >= 5 ? "Medium" : "Low";
  const field = (label: string, value: number, setValue: (value: number) => void) => (
    <label className="block text-sm text-gray-700 dark:text-gray-300">
      <span className="mb-2 block font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(event) => setValue(Number(event.target.value) || 0)}
          className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600"
          aria-label={label}
        />
        <span>%</span>
      </div>
    </label>
  );

  return (
    <section className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Impermanent Loss Calculator</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Project loss from price-ratio divergence before joining a pool.</p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">{risk} risk</span>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-5">
          {field("Asset A price change", assetAChange, setAssetAChange)}
          {field("Asset B price change", assetBChange, setAssetBChange)}
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            <span className="mb-2 block font-medium">Initial investment</span>
            <input type="number" min="0" value={initialInvestment} onChange={(event) => setInitialInvestment(Number(event.target.value) || 0)} className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" />
          </label>
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
            <strong>How it works:</strong> AMMs rebalance your 50/50 deposit as prices move. Compared with simply holding both assets, that rebalancing creates impermanent loss; fees may offset it.
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Loss curve</h3>
          <svg viewBox="0 0 300 160" className="h-40 w-full" role="img" aria-label="Impermanent loss curve by price ratio">
            <line x1="10" y1="150" x2="290" y2="150" stroke="currentColor" opacity=".3" />
            <polyline points={curve} fill="none" stroke="#3b82f6" strokeWidth="3" />
            <circle cx={10 + Math.min(280, Math.max(0, (Math.log2(Math.max(result.priceRatio, 0.25)) + 2) / 4 * 280))} cy={150 - Math.min(138, Math.abs(result.ilPercentage) * 1.25)} r="5" fill="#ef4444" />
          </svg>
          <div className="space-y-3">
            <div className="flex justify-between"><span>Impermanent loss</span><strong className="text-red-500">{result.ilPercentage.toFixed(2)}%</strong></div>
            <div className="flex justify-between"><span>HODL value</span><strong>${result.hodlValue.toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>LP value</span><strong>${result.lpValue.toFixed(2)}</strong></div>
            <div className="flex justify-between border-t border-gray-200 pt-3 dark:border-gray-700"><span>Difference</span><strong className="text-red-500">-${Math.max(0, result.hodlValue - result.lpValue).toFixed(2)}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ILCalculator;
