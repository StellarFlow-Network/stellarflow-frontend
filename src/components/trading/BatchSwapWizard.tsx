"use client";

import { useMemo, useState } from "react";

export interface BatchSwapLeg {
  id: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  estimatedOutput: number;
  priceImpactPercent: number;
  estimatedGas: number;
}

interface BatchSwapWizardProps {
  simulateLeg: (leg: BatchSwapLeg) => Promise<boolean>;
  authorizeBatch: (legs: BatchSwapLeg[]) => Promise<void>;
}

const blankLeg = (): BatchSwapLeg => ({ id: crypto.randomUUID(), fromAsset: "", toAsset: "", amount: "", estimatedOutput: 0, priceImpactPercent: 0, estimatedGas: 0 });

export function BatchSwapWizard({ simulateLeg, authorizeBatch }: BatchSwapWizardProps) {
  const [legs, setLegs] = useState<BatchSwapLeg[]>([blankLeg()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const netOutput = useMemo(() => legs.reduce((total, leg) => total + (Number(leg.estimatedOutput) || 0), 0), [legs]);
  const gasSavings = useMemo(() => Math.max(0, legs.reduce((total, leg) => total + (Number(leg.estimatedGas) || 0), 0) - (legs.length > 1 ? Number(legs[0]?.estimatedGas) || 0 : 0)), [legs]);

  const updateLeg = (id: string, values: Partial<BatchSwapLeg>) => setLegs(current => current.map(leg => leg.id === id ? { ...leg, ...values } : leg));
  const submit = async () => {
    setError(""); setBusy(true);
    try {
      for (const leg of legs) {
        if (!leg.fromAsset || !leg.toAsset || Number(leg.amount) <= 0) throw new Error("Complete every swap leg before continuing.");
        if (!await simulateLeg(leg)) throw new Error(`Simulation rejected ${leg.fromAsset} → ${leg.toAsset}; the batch was not submitted.`);
      }
      await authorizeBatch(legs);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Batch simulation failed."); }
    finally { setBusy(false); }
  };

  return <section className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-5 text-white" aria-label="Batch swap wizard">
    <header><h2 className="text-lg font-bold">Batch swap</h2><p className="text-sm text-gray-400">Bundle multiple swaps into one atomic authorization.</p></header>
    {legs.map((leg, index) => <fieldset key={leg.id} className="grid grid-cols-2 gap-2 rounded-lg border border-gray-700 p-3">
      <legend className="px-1 text-sm">Swap leg {index + 1}</legend>
      <input aria-label={`Leg ${index + 1} input asset`} placeholder="From asset" value={leg.fromAsset} onChange={e => updateLeg(leg.id, { fromAsset: e.target.value })} className="rounded bg-gray-800 p-2" />
      <input aria-label={`Leg ${index + 1} output asset`} placeholder="To asset" value={leg.toAsset} onChange={e => updateLeg(leg.id, { toAsset: e.target.value })} className="rounded bg-gray-800 p-2" />
      <input aria-label={`Leg ${index + 1} amount`} type="number" min="0" placeholder="Amount" value={leg.amount} onChange={e => updateLeg(leg.id, { amount: e.target.value })} className="rounded bg-gray-800 p-2" />
      <button type="button" onClick={() => setLegs(current => current.filter(item => item.id !== leg.id))} disabled={legs.length === 1} className="rounded border border-gray-700 p-2 text-sm disabled:opacity-40">Remove leg</button>
      <label className="text-xs text-gray-400">Estimated output<input type="number" value={leg.estimatedOutput} onChange={e => updateLeg(leg.id, { estimatedOutput: Number(e.target.value) })} className="mt-1 block w-full rounded bg-gray-800 p-2 text-white" /></label>
      <label className="text-xs text-gray-400">Price impact %<input type="number" value={leg.priceImpactPercent} onChange={e => updateLeg(leg.id, { priceImpactPercent: Number(e.target.value) })} className="mt-1 block w-full rounded bg-gray-800 p-2 text-white" /></label>
      <label className="text-xs text-gray-400">Estimated gas<input type="number" value={leg.estimatedGas} onChange={e => updateLeg(leg.id, { estimatedGas: Number(e.target.value) })} className="mt-1 block w-full rounded bg-gray-800 p-2 text-white" /></label>
    </fieldset>)}
    <button type="button" onClick={() => setLegs(current => [...current, blankLeg()])} className="rounded border border-gray-700 px-3 py-2 text-sm">Add swap leg</button>
    <div className="rounded bg-gray-800/70 p-3 text-sm"><p>Net estimated output: <strong>{netOutput}</strong></p><p>Estimated gas savings: <strong>{gasSavings}</strong></p>{legs.map(leg => <p key={leg.id} className="text-xs text-gray-400">{leg.fromAsset || "?"} → {leg.toAsset || "?"}: {leg.priceImpactPercent}% impact</p>)}</div>
    {error && <p role="alert" className="text-sm font-semibold text-red-400">{error}</p>}
    <button type="button" disabled={busy} onClick={submit} className="w-full rounded bg-blue-600 px-4 py-3 font-semibold disabled:opacity-50">{busy ? "Simulating batch…" : "Simulate and authorize batch"}</button>
  </section>;
}
