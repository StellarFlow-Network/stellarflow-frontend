"use client";

/**
 * FxComparisonTable — Issue #718
 *
 * Renders a fee/rate comparison matrix for the selected corridor showing
 * StellarFlow's on-chain settlement against traditional Money Transfer
 * Operators (MTOs), so a sender can see the savings at a glance.
 */

import { useMemo, useState } from "react";
import type { FxCurrencyCode } from "@/types/fxRates";
import { useFxRatesWithFallback } from "@/app/hooks/useFxRates";

interface MtoProfile {
  provider: string;
  /** Flat fee in USD. */
  flatFeeUsd: number;
  /** Percentage fee applied on top of the flat fee. */
  pctFee: number;
  /** FX margin applied above the mid-market rate (as a fraction, e.g. 0.02 = 2%). */
  fxMarginPct: number;
  settlementTime: string;
  isStellarFlow?: boolean;
}

// Illustrative, publicly-documented fee ranges for well-known MTOs. Used to
// contextualize StellarFlow's near-mid-market settlement against the
// traditional remittance market — not live pricing.
const MTO_PROFILES: MtoProfile[] = [
  { provider: "StellarFlow", flatFeeUsd: 0.5, pctFee: 0.1, fxMarginPct: 0.001, settlementTime: "Seconds", isStellarFlow: true },
  { provider: "Western Union", flatFeeUsd: 4.99, pctFee: 1.5, fxMarginPct: 0.02, settlementTime: "Minutes – 1 day" },
  { provider: "MoneyGram", flatFeeUsd: 3.99, pctFee: 1.2, fxMarginPct: 0.025, settlementTime: "Minutes – 1 day" },
  { provider: "Wise", flatFeeUsd: 1.5, pctFee: 0.6, fxMarginPct: 0.004, settlementTime: "1 – 2 days" },
  { provider: "Remitly", flatFeeUsd: 2.99, pctFee: 0.9, fxMarginPct: 0.015, settlementTime: "Minutes – 3 days" },
];

const SEND_AMOUNT_USD = 500;

export interface FxComparisonTableProps {
  className?: string;
}

const CURRENCIES: FxCurrencyCode[] = ["EUR", "NGN", "BRL", "KES"];

export default function FxComparisonTable({ className = "" }: FxComparisonTableProps) {
  const { data } = useFxRatesWithFallback();
  const [currency, setCurrency] = useState<FxCurrencyCode>("NGN");

  const midRate = data.quotes.find((q) => q.currency === currency)?.rate ?? 0;

  const rows = useMemo(() => {
    return MTO_PROFILES.map((mto) => {
      const totalFee = mto.flatFeeUsd + SEND_AMOUNT_USD * (mto.pctFee / 100);
      const netSendUsd = SEND_AMOUNT_USD - totalFee;
      const effectiveRate = midRate * (1 - mto.fxMarginPct);
      const recipientGets = netSendUsd * effectiveRate;
      const effectiveFeePct = (totalFee / SEND_AMOUNT_USD) * 100 + mto.fxMarginPct * 100;

      return {
        ...mto,
        totalFee,
        recipientGets,
        effectiveFeePct,
      };
    }).sort((a, b) => a.effectiveFeePct - b.effectiveFeePct);
  }, [midRate]);

  const best = rows[0];

  return (
    <div
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 ${className}`}
      data-testid="fx-comparison-table"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            Fees vs. Traditional MTOs
          </p>
          <p className="text-sm font-semibold text-neutral-200">
            Sending ${SEND_AMOUNT_USD.toLocaleString()} USD → {currency}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-1">
          {CURRENCIES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCurrency(code)}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                currency === code
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="text-neutral-500 uppercase text-[10px] tracking-wide">
              <th className="py-2 pr-3">Provider</th>
              <th className="py-2 pr-3">Fees</th>
              <th className="py-2 pr-3">Effective Cost</th>
              <th className="py-2 pr-3">Recipient Gets</th>
              <th className="py-2 pr-3">Settlement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.provider}
                className={`border-t border-neutral-800/80 ${
                  row.isStellarFlow ? "bg-emerald-950/20" : ""
                }`}
              >
                <td className="py-2 pr-3">
                  <span className={row.isStellarFlow ? "text-emerald-400 font-bold" : "text-neutral-200"}>
                    {row.provider}
                  </span>
                  {row === best && (
                    <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      Best rate
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  ${row.flatFeeUsd.toFixed(2)} + {row.pctFee}%
                </td>
                <td className="py-2 pr-3 text-amber-400">{row.effectiveFeePct.toFixed(2)}%</td>
                <td className="py-2 pr-3 text-neutral-100">
                  {row.recipientGets.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
                </td>
                <td className="py-2 pr-3 text-neutral-400">{row.settlementTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-neutral-500">
        Illustrative comparison based on published MTO fee ranges and the current mid-market rate.
        Not a quote — actual third-party fees vary by amount, destination, and payout method.
      </p>
    </div>
  );
}
