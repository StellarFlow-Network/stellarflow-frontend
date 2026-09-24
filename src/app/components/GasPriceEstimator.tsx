"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNetwork } from "./providers/NetworkProvider";

interface LedgerRecord {
  sequence: string;
  base_fee_in_stroops?: number;
  base_fee?: number;
}

interface LedgerResponse {
  _embedded?: { records?: LedgerRecord[] };
}

interface FeeTiers {
  low: number;
  average: number;
  high: number;
  sampleSize: number;
  ledgerSequence: string;
}

const REFRESH_INTERVAL_MS = 15_000;
const STROOPS_PER_XLM = 10_000_000;
const FALLBACK_XLM_USD = 0.12;

function percentile(values: number[], fraction: number): number {
  const index = (values.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower] ?? 0;
  return Math.round(values[lower] + (values[upper] - values[lower]) * (index - lower));
}

function formatStroops(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatXlm(value: number): string {
  return value.toFixed(value < 0.001 ? 7 : 4);
}

export default function GasPriceEstimator() {
  const { config, network } = useNetwork();
  const [tiers, setTiers] = useState<FeeTiers | null>(null);
  const [selectedFee, setSelectedFee] = useState(0);
  const [xlmUsd, setXlmUsd] = useState(FALLBACK_XLM_USD);
  const [priceIsLive, setPriceIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (signal: AbortSignal) => {
    const [ledgerResponse, priceResponse] = await Promise.all([
      fetch(`${config.horizonUrl}/ledgers?order=desc&limit=24`, {
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd", {
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      }),
    ]);

    if (!ledgerResponse.ok) {
      throw new Error(`Ledger request failed (${ledgerResponse.status})`);
    }

    const ledgerData = (await ledgerResponse.json()) as LedgerResponse;
    const fees = (ledgerData._embedded?.records ?? [])
      .map((ledger) => Number(ledger.base_fee_in_stroops ?? ledger.base_fee))
      .filter((fee) => Number.isFinite(fee) && fee >= 0);

    if (fees.length === 0) throw new Error("No recent ledger fee data is available.");

    fees.sort((a, b) => a - b);
    const records = ledgerData._embedded?.records ?? [];
    const latestSequence = records[0]?.sequence ?? "—";
    const nextTiers = {
      low: percentile(fees, 0.25),
      average: percentile(fees, 0.5),
      high: percentile(fees, 0.95),
      sampleSize: fees.length,
      ledgerSequence: latestSequence,
    };

    setTiers(nextTiers);
    setSelectedFee((current) => (current === 0 ? nextTiers.average : Math.min(current, nextTiers.high)));
    if (priceResponse.ok) {
      const priceData = (await priceResponse.json()) as { stellar?: { usd?: number } };
      const livePrice = Number(priceData.stellar?.usd);
      if (Number.isFinite(livePrice) && livePrice > 0) {
        setXlmUsd(livePrice);
        setPriceIsLive(true);
      }
    }
    setError(null);
  }, [config.horizonUrl]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void loadData(controller.signal)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load fee data.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    const timer = window.setInterval(() => {
      const refreshController = new AbortController();
      void loadData(refreshController.signal).catch((loadError: unknown) => {
        if (!refreshController.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to refresh fee data.");
        }
      });
    }, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadData, network]);

  const feeXlm = selectedFee / STROOPS_PER_XLM;
  const feeUsd = feeXlm * xlmUsd;
  const sliderMax = tiers ? Math.max(tiers.high, tiers.low + 1) : 1;
  const sliderMin = tiers?.low ?? 0;
  const selectedLabel = tiers
    ? selectedFee === tiers.low
      ? "Low"
      : selectedFee === tiers.average
        ? "Average"
        : selectedFee === tiers.high
          ? "High"
          : "Custom"
    : "Custom";

  const tierCards = useMemo(
    () =>
      tiers
        ? [
            { label: "Low", value: tiers.low, hint: "Cost-conscious" },
            { label: "Average", value: tiers.average, hint: "Recommended" },
            { label: "High", value: tiers.high, hint: "Fast inclusion" },
          ]
        : [],
    [tiers],
  );

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)] sm:p-7" aria-labelledby="gas-estimator-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(57,255,20,0.08),transparent_55%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/85">Network fees</p>
            <h2 id="gas-estimator-title" className="mt-1 text-2xl font-semibold text-white">Gas price estimator</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">Recent ledger base fees translated into priority tiers for your next transaction.</p>
          </div>
          <span className="rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-3 py-1.5 text-xs font-medium text-[#D9F99D]">
            {network === "mainnet" ? "Mainnet" : "Testnet"} · Live
          </span>
        </div>

        {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Your priority fee</p>
                <p className="mt-1 text-3xl font-bold text-[#D9F99D]">{formatStroops(selectedFee)} <span className="text-sm font-medium text-slate-400">stroops / op</span></p>
              </div>
              <span className="text-sm font-medium text-white">{selectedLabel}</span>
            </div>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={selectedFee}
              onChange={(event) => setSelectedFee(Number(event.target.value))}
              disabled={!tiers}
              aria-label="Custom priority fee in stroops"
              className="h-2 w-full cursor-pointer accent-[#B8E63E] disabled:cursor-not-allowed disabled:opacity-40"
            />
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>{formatStroops(sliderMin)} low</span><span>{formatStroops(sliderMax)} high</span>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Estimated cost</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-semibold text-white">{formatXlm(feeXlm)} XLM</span>
                <span className="text-sm text-[#D9F99D]">≈ ${feeUsd.toFixed(6)} USD</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Based on 1 operation · XLM ${xlmUsd.toFixed(4)} {priceIsLive ? "· live price" : "· fallback price"}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {tierCards.map((tier) => (
              <button key={tier.label} type="button" onClick={() => setSelectedFee(tier.value)} className={`rounded-2xl border p-4 text-left transition-colors ${selectedFee === tier.value ? "border-[#B8E63E]/60 bg-[#B8E63E]/10" : "border-white/10 bg-[#0F172A] hover:border-[#B8E63E]/40"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-white">{tier.label}</span><span className="text-[10px] uppercase tracking-wider text-slate-500">{tier.hint}</span></div>
                <p className="mt-2 font-mono text-lg text-[#D9F99D]">{isLoading && !tiers ? "…" : formatStroops(tier.value)}</p>
                <p className="text-[11px] text-slate-500">stroops / operation</p>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-5 text-[11px] text-slate-500">Sample: {tiers?.sampleSize ?? "—"} recent ledgers · Latest ledger #{tiers?.ledgerSequence ?? "—"} · Refreshes every 15 seconds</p>
      </div>
    </section>
  );
}
