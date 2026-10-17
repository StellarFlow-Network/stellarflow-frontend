"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { calculateILScenario, calculateImpermanentLoss } from "./ilCalculatorMath";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function ILCalculator() {
  const [assetAChange, setAssetAChange] = useState(0);
  const [assetBChange, setAssetBChange] = useState(0);
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [feeEarnings, setFeeEarnings] = useState(0);

  const result = useMemo(() => {
    return calculateILScenario({
      assetAChange,
      assetBChange,
      initialInvestment,
      feeEarningsPercent: feeEarnings,
    });
  }, [assetAChange, assetBChange, feeEarnings, initialInvestment]);

  const chartData = useMemo<ChartData<"line">>(() => {
    const ratios = Array.from({ length: 41 }, (_, index) => 0.25 * 16 ** (index / 40));
    const currentRatio = Math.min(4, Math.max(0.25, result.priceRatio));
    const currentIndex = Math.round((Math.log(currentRatio / 0.25) / Math.log(16)) * 40);
    return {
      labels: ratios.map((ratio) => `${ratio.toFixed(2)}×`),
      datasets: [
        {
          label: "Impermanent loss",
          data: ratios.map(calculateImpermanentLoss),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.12)",
          fill: true,
          pointRadius: ratios.map((_, index) => index === currentIndex ? 4 : 0),
          pointBackgroundColor: "#f97316",
          tension: 0.2,
        },
      ],
    };
  }, [result.priceRatio]);

  const chartOptions = useMemo<ChartOptions<"line">>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `IL: ${Number(context.parsed.y).toFixed(2)}%`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Asset price ratio (A / B)", color: "#9ca3af" },
        ticks: { color: "#9ca3af", maxTicksLimit: 7 },
        grid: { color: "rgba(156, 163, 175, 0.12)" },
      },
      y: {
        title: { display: true, text: "Value vs. HODL", color: "#9ca3af" },
        ticks: { color: "#9ca3af", callback: (value) => `${value}%` },
        grid: { color: "rgba(156, 163, 175, 0.12)" },
      },
    },
  }), []);

  const risk = Math.abs(result.netImpermanentLoss) >= 20
    ? "High"
    : Math.abs(result.netImpermanentLoss) >= 5 ? "Medium" : "Low";

  const changeField = (
    label: string,
    value: number,
    setValue: (value: number) => void,
    testId: string,
  ) => (
    <label className="block text-sm text-gray-700 dark:text-gray-300">
      <span className="mb-2 flex items-center justify-between font-medium">
        {label}
        <output htmlFor={testId} className="font-mono">{value}%</output>
      </span>
      <input
        id={testId}
        data-testid={testId}
        type="range"
        min={-200}
        max={200}
        step={1}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full accent-blue-500"
        aria-label={label}
      />
      <span className="flex justify-between text-xs text-gray-500">
        <span>-200%</span>
        <span>+200%</span>
      </span>
    </label>
  );

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Impermanent Loss Calculator</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Compare a 50/50 constant-product pool position with holding both assets.
          </p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {risk} risk
        </span>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-5">
          {changeField("Asset A price change", assetAChange, setAssetAChange, "asset-a-price-change")}
          {changeField("Asset B price change", assetBChange, setAssetBChange, "asset-b-price-change")}
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            <span className="mb-2 block font-medium">Initial investment</span>
            <input
              type="number"
              min="0"
              step="any"
              value={initialInvestment}
              onChange={(event) => setInitialInvestment(Math.max(0, Number(event.target.value) || 0))}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600"
              aria-label="Initial investment"
            />
          </label>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            <span className="mb-2 flex items-center gap-2 font-medium">
              Estimated pool fee earnings (% of initial investment)
              <span
                className="group relative inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-gray-400 text-xs"
                tabIndex={0}
                aria-label="Fee mitigation information"
              >
                i
                <span role="tooltip" className="invisible absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded bg-gray-900 p-2 text-xs font-normal text-white group-hover:visible group-focus:visible">
                  Trading fees increase your pool value and can offset impermanent loss. This estimate is added to the pool value; actual earnings vary with volume, liquidity, and time.
                </span>
              </span>
            </span>
            <input
              type="number"
              min="0"
              max="200"
              step="0.1"
              value={feeEarnings}
              onChange={(event) => setFeeEarnings(Math.min(200, Math.max(0, Number(event.target.value) || 0)))}
              className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600"
              aria-label="Estimated pool fee earnings"
            />
          </label>
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
            <strong>Constant-product model:</strong> pool value is based on the geometric mean of the two price multipliers. Fee earnings are shown separately and reduce the net loss relative to HODL.
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Impermanent loss curve</h3>
          <div className="h-64" role="img" aria-label="Impermanent loss curve by relative asset price">
            <Line data={chartData} options={chartOptions} />
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>HODL value</dt>
              <dd data-testid="hodl-value" className="font-semibold">{formatCurrency(result.hodlValue)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Pool value (before fees)</dt>
              <dd data-testid="pool-value" className="font-semibold">{formatCurrency(result.poolValue)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Estimated fee earnings</dt>
              <dd className="font-semibold">{formatCurrency(result.feeIncome)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 dark:border-gray-700">
              <dt>Net impermanent loss</dt>
              <dd data-testid="net-impermanent-loss" className={`font-semibold ${result.netImpermanentLoss < 0 ? "text-red-500" : "text-green-600"}`}>
                {result.netImpermanentLoss.toFixed(2)}%
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Net difference vs. HODL</dt>
              <dd className={`font-semibold ${result.netDifference < 0 ? "text-red-500" : "text-green-600"}`}>
                {formatCurrency(result.netDifference)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export default ILCalculator;
