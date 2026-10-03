"use client";

import { useEffect, useMemo, useState } from "react";
import { useGasFee, type FeeTier } from "@/hooks/useGasFee";

const STROOPS_PER_XLM = 10_000_000;
const MAX_MULTIPLIER = 100;

export interface GasFeeSelectorProps {
  onFeeChange?: (feeStroops: number, tier: FeeTier | "custom") => void;
  xlmUsdPrice?: number;
  className?: string;
}

export function GasFeeSelector({ onFeeChange, xlmUsdPrice = 0, className = "" }: GasFeeSelectorProps) {
  const { snapshot, selectedTier, setSelectedTier, isLoading, error } = useGasFee();
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const minimum = snapshot?.baseFeeStroops ?? 100;
  const maximum = minimum * MAX_MULTIPLIER;
  const customStroops = useMemo(() => Math.round(Number(custom) * STROOPS_PER_XLM), [custom]);
  const customError = useCustom && custom !== "" && (!Number.isFinite(customStroops) || customStroops < minimum || customStroops > maximum);
  const fee = useCustom ? customStroops : snapshot?.tiers[selectedTier].feeStroops;

  useEffect(() => { if (fee && !customError) onFeeChange?.(fee, useCustom ? "custom" : selectedTier); }, [fee, customError, useCustom, selectedTier, onFeeChange]);

  if (isLoading && !snapshot) return <div className={className}>Loading current network fee…</div>;
  if (error && !snapshot) return <p role="alert" className={className}>Unable to load network fee: {error}</p>;
  if (!snapshot) return null;
  return <section className={`rounded-xl border border-gray-700 bg-gray-900/60 p-4 ${className}`} aria-label="Transaction fee selector">
    <h3 className="mb-3 text-sm font-semibold text-white">Transaction priority fee</h3>
    <div className="grid grid-cols-3 gap-2">{(["standard", "fast", "instant"] as FeeTier[]).map((tier) => { const estimate = snapshot.tiers[tier]; return <button type="button" key={tier} aria-pressed={!useCustom && selectedTier === tier} onClick={() => { setUseCustom(false); setSelectedTier(tier); }} className={`rounded-lg border p-2 text-left ${!useCustom && selectedTier === tier ? "border-cyan-400 bg-cyan-950/40" : "border-gray-700"}`}><span className="block capitalize text-sm text-white">{tier === "fast" ? "High" : tier}</span><span className="block text-xs text-gray-400">{estimate.feeXLM} XLM</span><span className="block text-xs text-gray-500">≈ ${(Number(estimate.feeXLM) * xlmUsdPrice).toFixed(4)}</span></button>; })}</div>
    <div className="mt-3"><label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={useCustom} onChange={(event) => setUseCustom(event.target.checked)} />Custom fee (XLM)</label>{useCustom && <><input aria-label="Custom fee in XLM" type="number" min={minimum / STROOPS_PER_XLM} max={maximum / STROOPS_PER_XLM} step="0.0000001" value={custom} onChange={(event) => setCustom(event.target.value)} className="mt-2 w-full rounded border border-gray-700 bg-gray-950 p-2 text-white" placeholder={`Minimum ${minimum} stroops`} />{customError && <p role="alert" className="mt-1 text-xs text-red-400">Fee must be at least {minimum} stroops and no more than {maximum} stroops.</p>}{!customError && Number(fee) > 0 && <p className="mt-1 text-xs text-gray-400">{customStroops} stroops · ≈ ${(customStroops / STROOPS_PER_XLM * xlmUsdPrice).toFixed(4)}</p>}</>}</div>
  </section>;
}

export default GasFeeSelector;
