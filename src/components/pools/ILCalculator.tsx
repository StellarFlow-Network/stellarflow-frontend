'use client';

import React, { useState, useMemo } from 'react';

// Tailwind is assumed to be used for styling based on typical Next.js setups

export function ILCalculator() {
  // States for the price changes in percentage
  const [assetAChange, setAssetAChange] = useState<number>(0);
  const [assetBChange, setAssetBChange] = useState<number>(0);

  // Initial investment amount for demonstration
  const [initialInvestment, setInitialInvestment] = useState<number>(1000);

  // Calculate IL and values
  const { ilPercentage, hodlValue, lpValue, riskLevel } = useMemo(() => {
    // Price ratio calculation: new price of A relative to B divided by old price of A relative to B
    const ratioA = 1 + assetAChange / 100;
    const ratioB = 1 + assetBChange / 100;
    
    // Prevent division by zero if an asset goes to -100% (worthless)
    let priceRatio = 1;
    if (ratioB > 0) {
      priceRatio = ratioA / ratioB;
    }

    // Impermanent loss formula: 2 * sqrt(ratio) / (1 + ratio) - 1
    // If an asset goes to 0 (-100%), IL is effectively -100% (all value lost relative to holding the other asset)
    let il = 0;
    if (ratioA <= 0 || ratioB <= 0) {
      il = -1;
    } else {
      il = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
    }

    const ilPercentage = il * 100;

    // HODL value (50/50 split initially)
    const initialA = initialInvestment / 2;
    const initialB = initialInvestment / 2;
    const hodlValue = initialA * Math.max(0, ratioA) + initialB * Math.max(0, ratioB);

    // LP value
    const lpValue = hodlValue * (1 + il);

    // Risk level based on absolute IL
    const absIl = Math.abs(ilPercentage);
    let riskLevel = 'Low';
    if (absIl >= 20) riskLevel = 'High';
    else if (absIl >= 5) riskLevel = 'Medium';

    return { ilPercentage, hodlValue, lpValue, riskLevel };
  }, [assetAChange, assetBChange, initialInvestment]);

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Impermanent Loss Calculator</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Estimate potential IL based on asset price divergence.
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskBadgeColor(riskLevel)}`}>
          {riskLevel} Volatility Risk
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Initial Investment ($)
            </label>
            <input
              type="number"
              value={initialInvestment}
              onChange={(e) => setInitialInvestment(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              min="0"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Asset A Price Change
              </label>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {assetAChange > 0 ? '+' : ''}{assetAChange}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="200"
              value={assetAChange}
              onChange={(e) => setAssetAChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>-50%</span>
              <span>0%</span>
              <span>+200%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Asset B Price Change
              </label>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {assetBChange > 0 ? '+' : ''}{assetBChange}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="200"
              value={assetBChange}
              onChange={(e) => setAssetBChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>-50%</span>
              <span>0%</span>
              <span>+200%</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            Results
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-sm text-gray-500 dark:text-gray-400">Impermanent Loss</span>
              <span className="text-xl font-bold text-red-500">
                {ilPercentage.toFixed(2)}%
              </span>
            </div>

            <div className="flex justify-between items-end">
              <span className="text-sm text-gray-500 dark:text-gray-400">HODL Value (50/50)</span>
              <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                ${hodlValue.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-end">
              <span className="text-sm text-gray-500 dark:text-gray-400">LP Value</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                ${lpValue.toFixed(2)}
              </span>
            </div>

            <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Loss vs HODL</span>
                <span className="text-lg font-bold text-red-500">
                  -${Math.max(0, hodlValue - lpValue).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> Impermanent loss is the difference between holding tokens in an AMM liquidity pool versus holding them in your wallet. It only becomes "permanent" if you withdraw your liquidity while the price divergence exists.
        </p>
      </div>
    </div>
  );
}
