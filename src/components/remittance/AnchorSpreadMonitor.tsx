'use client';

import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Award, TrendingDown, TrendingUp } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

type Corridor = {
  id: string;
  label: string;
  base: string;
  quote: string;
  midRate: number; // approximate mid-market rate, base -> quote
};

const CORRIDORS: Corridor[] = [
  { id: 'usd-ngn', label: 'USD / NGN', base: 'USD', quote: 'NGN', midRate: 1550 },
  { id: 'eur-kes', label: 'EUR / KES', base: 'EUR', quote: 'KES', midRate: 168 },
  { id: 'usd-brl', label: 'USD / BRL', base: 'USD', quote: 'BRL', midRate: 5.4 },
];

const SPREAD_BEST_VALUE_THRESHOLD = 1.0; // percent

interface CorridorSeries {
  labels: string[];
  midMarket: number[];
  anchor: number[];
  currentSpreadPct: number;
}

// TODO: replace with a real call to the anchor feed, e.g.
// const res = await fetch(`/api/anchors/${corridor.id}/history?days=30`);
function generateCorridorSeries(corridor: Corridor): CorridorSeries {
  const days = 30;
  const labels: string[] = [];
  const midMarket: number[] = [];
  const anchor: number[] = [];

  // Deterministic pseudo-random so the chart doesn't jitter on re-render.
  let seed = Array.from(corridor.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const drift = (rand() - 0.5) * corridor.midRate * 0.01;
    const mid = corridor.midRate + drift * (days - i);
    midMarket.push(Number(mid.toFixed(4)));

    const spreadFactor = 1 + (0.002 + rand() * 0.02); // 0.2% - 2.2% anchor spread
    anchor.push(Number((mid * spreadFactor).toFixed(4)));
  }

  const lastMid = midMarket[midMarket.length - 1];
  const lastAnchor = anchor[anchor.length - 1];
  const currentSpreadPct = ((lastAnchor - lastMid) / lastMid) * 100;

  return { labels, midMarket, anchor, currentSpreadPct };
}

export default function AnchorSpreadMonitor() {
  const [corridorId, setCorridorId] = useState(CORRIDORS[0].id);

  const corridor = useMemo(
    () => CORRIDORS.find((c) => c.id === corridorId) ?? CORRIDORS[0],
    [corridorId]
  );

  const series = useMemo(() => generateCorridorSeries(corridor), [corridor]);

  const isBestValue = series.currentSpreadPct <= SPREAD_BEST_VALUE_THRESHOLD;

  const chartData = {
    labels: series.labels,
    datasets: [
      {
        label: 'Mid-market rate',
        data: series.midMarket,
        borderColor: '#64748b',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'Anchor rate',
        data: series.anchor,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        fill: true,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { boxWidth: 12, usePointStyle: true },
      },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.15)' } },
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Anchor Spread Monitor
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            30-day FX volatility vs. anchor spread
          </p>
        </div>

        <select
          value={corridorId}
          onChange={(e) => setCorridorId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          aria-label="Select remittance corridor"
        >
          {CORRIDORS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          {series.currentSpreadPct >= 0 ? (
            <TrendingUp className="h-4 w-4 text-rose-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-sm text-slate-600 dark:text-slate-300">Current spread</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {series.currentSpreadPct.toFixed(2)}%
          </span>
        </div>

        {isBestValue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Award className="h-3.5 w-3.5" />
            Best Value
          </span>
        )}
      </div>

      <div className="h-64 w-full">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}