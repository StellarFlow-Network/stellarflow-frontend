"use client";

import React, { useMemo, useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";

const MIN_INVESTMENT = 100;
const MAX_INVESTMENT = 100_000;
const MIN_DAYS = 7;
const MAX_DAYS = 365;
const BASE_APY = 14.7;

interface ProjectionPoint {
  day: number;
  compounded: number;
  holding: number;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function historicalApy(day: number): number {
  return BASE_APY + Math.sin(day / 17) * 1.8 + Math.cos(day / 41) * 1.1;
}

function buildProjection(investment: number, days: number): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  let compounded = investment;
  const interval = Math.max(1, Math.ceil(days / 48));

  for (let day = 0; day <= days; day += 1) {
    if (day > 0) compounded *= 1 + historicalApy(day) / 100 / 365;
    if (day % interval === 0 || day === days) {
      points.push({
        day,
        compounded,
        holding: investment,
      });
    }
  }
  return points;
}

function ComparisonChart({ points, investment }: { points: ProjectionPoint[]; investment: number }) {
  const width = 720;
  const height = 270;
  const padding = { top: 18, right: 18, bottom: 32, left: 64 };
  const maxValue = Math.max(...points.map((point) => point.compounded), investment) * 1.04;
  const x = (day: number) => padding.left + (day / Math.max(points.at(-1)?.day ?? 1, 1)) * (width - padding.left - padding.right);
  const y = (value: number) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
  const compoundedPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.day)} ${y(point.compounded)}`).join(" ");
  const holdingPath = `M ${x(0)} ${y(investment)} L ${x(points.at(-1)?.day ?? 1)} ${y(investment)}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[560px] w-full" role="img" aria-label="Projected auto-compounding vault yield compared with standard holding">
        {[0, 0.5, 1].map((ratio) => {
          const value = maxValue * ratio;
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} stroke="rgba(148,163,184,0.16)" />
              <text x={padding.left - 8} y={y(value) + 4} textAnchor="end" fill="#64748b" fontSize="11">{formatUsd(value)}</text>
            </g>
          );
        })}
        <path d={holdingPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 5" />
        <path d={compoundedPath} fill="none" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" />
        <text x={padding.left} y={height - 8} fill="#64748b" fontSize="11">Day 0</text>
        <text x={width - padding.right} y={height - 8} textAnchor="end" fill="#64748b" fontSize="11">Day {points.at(-1)?.day}</text>
      </svg>
      <div className="flex flex-wrap gap-4 px-2 pt-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-lime-400" />Auto-compounding vault</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t-2 border-dashed border-slate-400" />Standard holding</span>
      </div>
    </div>
  );
}

export function LpVaultStrategyBacktester() {
  const [investment, setInvestment] = useState(10_000);
  const [days, setDays] = useState(90);
  const projection = useMemo(() => buildProjection(investment, days), [investment, days]);
  const finalValue = projection.at(-1)?.compounded ?? investment;
  const yieldEarned = finalValue - investment;
  const annualizedApy = (Math.pow(finalValue / investment, 365 / days) - 1) * 100;
  const averageApy = projection.reduce((sum, point) => sum + historicalApy(point.day), 0) / projection.length;
  const estimatedFees = yieldEarned * 0.18;
  const netYield = yieldEarned - estimatedFees;

  return (
    <section className="border-y border-slate-800 bg-[#07111d] px-4 py-10 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-lime-300"><Calculator size={15} /> Strategy backtester</p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">See compounding work on your LP position</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">A simulated projection using the vault&apos;s recent APY range. Adjust the inputs to compare reinvested yield with simply holding your initial position.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-lime-300"><TrendingUp size={17} /> {annualizedApy.toFixed(2)}% projected APY</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <label className="block">
              <span className="flex items-center justify-between text-sm font-medium text-slate-200"><span>Initial investment</span><strong className="text-lime-300">{formatUsd(investment)}</strong></span>
              <input type="range" min={MIN_INVESTMENT} max={MAX_INVESTMENT} step={100} value={investment} onChange={(event) => setInvestment(Number(event.target.value))} className="mt-4 w-full accent-lime-400" aria-label="Initial investment" />
              <span className="mt-2 flex justify-between text-[11px] text-slate-500"><span>{formatUsd(MIN_INVESTMENT)}</span><span>{formatUsd(MAX_INVESTMENT)}</span></span>
            </label>
            <label className="block">
              <span className="flex items-center justify-between text-sm font-medium text-slate-200"><span>Timeframe</span><strong className="text-lime-300">{days} days</strong></span>
              <input type="range" min={MIN_DAYS} max={MAX_DAYS} step={1} value={days} onChange={(event) => setDays(Number(event.target.value))} className="mt-4 w-full accent-lime-400" aria-label="Projection timeframe in days" />
              <span className="mt-2 flex justify-between text-[11px] text-slate-500"><span>7 days</span><span>1 year</span></span>
            </label>
            <div className="border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">APY varies across the projection to reflect a simulated historical vault performance range.</div>
          </div>

          <div className="min-w-0 space-y-5">
            <ComparisonChart points={projection} investment={investment} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Vault value" value={formatUsd(finalValue)} accent />
              <Metric label="Net yield" value={formatUsd(netYield)} accent />
              <Metric label="Holding value" value={formatUsd(investment)} />
              <Metric label="APY average" value={`${averageApy.toFixed(2)}%`} />
            </div>
          </div>
        </div>

        <div className="mt-7 overflow-hidden rounded-xl border border-slate-800">
          <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-white">Dynamic APY calculation breakdown</div>
          <div className="grid grid-cols-2 divide-x divide-slate-800 sm:grid-cols-4">
            <Breakdown label="Starting principal" value={formatUsd(investment)} />
            <Breakdown label="Gross compound yield" value={formatUsd(yieldEarned)} />
            <Breakdown label="Estimated vault fees" value={`-${formatUsd(estimatedFees)}`} />
            <Breakdown label={`After ${days} days`} value={formatUsd(investment + netYield)} highlight />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${accent ? "text-lime-300" : "text-white"}`}>{value}</p></div>;
}

function Breakdown({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="min-w-0 p-4"><p className="truncate text-xs text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${highlight ? "text-lime-300" : "text-slate-200"}`}>{value}</p></div>;
}

export default LpVaultStrategyBacktester;