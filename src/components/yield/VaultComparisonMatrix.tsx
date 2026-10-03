"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";

export interface YieldVaultStrategy {
  id: string;
  name: string;
  risk: "Low Risk" | "Medium Risk" | "High Risk";
  assets: string[];
  lockupDays: number;
  apy: number;
  features: Record<string, boolean>;
}

export interface VaultComparisonMatrixProps {
  vaults?: YieldVaultStrategy[];
  portfolioAssets?: string[];
  onDeposit?: (strategy: YieldVaultStrategy) => void;
}

const DEFAULT_VAULTS: YieldVaultStrategy[] = [
  { id: "stable-income", name: "Stable Income", risk: "Low Risk", assets: ["USDC", "USDT"], lockupDays: 0, apy: 5.8, features: { "Auto-compounding": true, "Instant withdrawal": true, "Audited strategy": true } },
  { id: "balanced-growth", name: "Balanced Growth", risk: "Medium Risk", assets: ["XLM", "USDC"], lockupDays: 7, apy: 11.2, features: { "Auto-compounding": true, "Instant withdrawal": false, "Audited strategy": true } },
  { id: "xlm-boost", name: "XLM Boost", risk: "High Yield", assets: ["XLM"], lockupDays: 30, apy: 18.6, features: { "Auto-compounding": false, "Instant withdrawal": false, "Audited strategy": true } },
];

const riskColor: Record<YieldVaultStrategy["risk"], string> = {
  "Low Risk": "text-emerald-400",
  "Medium Risk": "text-amber-400",
  "High Risk": "text-rose-400",
};

export default function VaultComparisonMatrix({ vaults = DEFAULT_VAULTS, portfolioAssets = [], onDeposit }: VaultComparisonMatrixProps) {
  const [selected, setSelected] = useState<YieldVaultStrategy | null>(null);
  const recommendedId = useMemo(() => {
    const holdings = new Set(portfolioAssets.map((asset) => asset.toUpperCase()));
    return vaults
      .map((vault) => ({ vault, matches: vault.assets.filter((asset) => holdings.has(asset.toUpperCase())).length }))
      .sort((a, b) => b.matches - a.matches || b.vault.apy - a.vault.apy)[0]?.vault.id;
  }, [portfolioAssets, vaults]);
  const featureNames = Array.from(new Set(vaults.flatMap((vault) => Object.keys(vault.features))));

  const deposit = (vault: YieldVaultStrategy) => {
    setSelected(vault);
    onDeposit?.(vault);
  };

  return <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
    <header><h2 className="text-xl font-bold text-white">Compare yield strategies</h2><p className="mt-1 text-sm text-slate-400">Compare risk, asset composition, lockup, and estimated returns.</p></header>
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead><tr><th className="sticky left-0 z-10 min-w-40 bg-slate-950 p-4 text-sm text-slate-400">Strategy</th>{vaults.map((vault) => <th key={vault.id} className="min-w-52 p-4 align-top">{vault.id === recommendedId && <span className="mb-2 inline-block rounded-full bg-lime-400/15 px-2.5 py-1 text-xs font-semibold text-lime-300">Recommended for you</span>}<h3 className="text-base font-bold text-white">{vault.name}</h3></th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800 text-sm">
          <tr><th className="sticky left-0 bg-slate-950 p-4 font-medium text-slate-400">Risk rating</th>{vaults.map((vault) => <td key={vault.id} className={`p-4 font-semibold ${riskColor[vault.risk]}`}>{vault.risk}</td>)}</tr>
          <tr><th className="sticky left-0 bg-slate-950 p-4 font-medium text-slate-400">Asset composition</th>{vaults.map((vault) => <td key={vault.id} className="p-4 text-white">{vault.assets.join(" · ")}</td>)}</tr>
          <tr><th className="sticky left-0 bg-slate-950 p-4 font-medium text-slate-400">Lockup period</th>{vaults.map((vault) => <td key={vault.id} className="p-4 text-white">{vault.lockupDays === 0 ? "Flexible" : `${vault.lockupDays} days`}</td>)}</tr>
          <tr><th className="sticky left-0 bg-slate-950 p-4 font-medium text-slate-400">Net APY</th>{vaults.map((vault) => <td key={vault.id} className="p-4 text-lg font-bold text-lime-400">{vault.apy.toFixed(2)}%</td>)}</tr>
          {featureNames.map((feature) => <tr key={feature}><th className="sticky left-0 bg-slate-950 p-4 font-medium text-slate-400">{feature}</th>{vaults.map((vault) => <td key={vault.id} className="p-4">{vault.features[feature] ? <span className="inline-flex items-center gap-2 text-emerald-400"><Check size={16} aria-hidden="true" /><span className="sr-only">Included</span></span> : <span className="inline-flex items-center gap-2 text-slate-600"><X size={16} aria-hidden="true" /><span className="sr-only">Not included</span></span>}</td>)}</tr>)}
          <tr><th className="sticky left-0 bg-slate-950 p-4 font-medium text-slate-400">Deposit</th>{vaults.map((vault) => <td key={vault.id} className="p-4"><button type="button" onClick={() => deposit(vault)} className="w-full rounded-lg bg-lime-400 px-4 py-2 font-semibold text-slate-950 hover:bg-lime-300">Deposit</button></td>)}</tr>
        </tbody>
      </table>
    </div>
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="deposit-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wide text-lime-400">Deposit strategy</p><h3 id="deposit-title" className="mt-1 text-xl font-bold text-white">{selected.name}</h3></div><button type="button" aria-label="Close deposit dialog" onClick={() => setSelected(null)} className="rounded p-1 text-slate-400 hover:text-white"><X size={20} /></button></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-slate-400">Assets</dt><dd className="text-white">{selected.assets.join(", ")}</dd></div><div className="flex justify-between"><dt className="text-slate-400">Net APY</dt><dd className="font-semibold text-lime-400">{selected.apy.toFixed(2)}%</dd></div><div className="flex justify-between"><dt className="text-slate-400">Lockup</dt><dd className="text-white">{selected.lockupDays === 0 ? "Flexible" : `${selected.lockupDays} days`}</dd></div></dl><p className="mt-5 text-xs text-slate-500">The selected strategy is preloaded. Connect a wallet to enter a deposit amount.</p></div>
    </div>}
  </section>;
}
