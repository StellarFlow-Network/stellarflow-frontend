"use client";

/**
 * FeeSavingsWidget — Real-time Fee Savings Calculator
 *
 * Interactive widget for calculating and visualizing remittance fee savings
 * compared to traditional Money Transfer Operators (Western Union, MoneyGram).
 *
 * Features:
 * - Real-time comparison showing savings vs traditional channels
 * - Interactive slider to map transfer volume to total money saved
 * - Exportable fee breakdown summary for sender receipt records
 * - Visual charts and animations
 */

import { useState, useMemo, useCallback } from "react";
import { Download, TrendingDown, DollarSign, ArrowRight, Sparkles } from "lucide-react";
import type { FxCurrencyCode } from "@/types/fxRates";
import { useFxRatesWithFallback } from "@/app/hooks/useFxRates";

interface MtoProfile {
  provider: string;
  flatFeeUsd: number;
  pctFee: number;
  fxMarginPct: number;
  settlementTime: string;
  isStellarFlow?: boolean;
  color?: string;
}

const MTO_PROFILES: MtoProfile[] = [
  {
    provider: "StellarFlow",
    flatFeeUsd: 0.5,
    pctFee: 0.1,
    fxMarginPct: 0.001,
    settlementTime: "Seconds",
    isStellarFlow: true,
    color: "emerald",
  },
  {
    provider: "Western Union",
    flatFeeUsd: 4.99,
    pctFee: 1.5,
    fxMarginPct: 0.02,
    settlementTime: "Minutes – 1 day",
    color: "amber",
  },
  {
    provider: "MoneyGram",
    flatFeeUsd: 3.99,
    pctFee: 1.2,
    fxMarginPct: 0.025,
    settlementTime: "Minutes – 1 day",
    color: "orange",
  },
  {
    provider: "Wise",
    flatFeeUsd: 1.5,
    pctFee: 0.6,
    fxMarginPct: 0.004,
    settlementTime: "1 – 2 days",
    color: "teal",
  },
  {
    provider: "Remitly",
    flatFeeUsd: 2.99,
    pctFee: 0.9,
    fxMarginPct: 0.015,
    settlementTime: "Minutes – 3 days",
    color: "indigo",
  },
];

const CURRENCIES: FxCurrencyCode[] = ["EUR", "NGN", "BRL", "KES"];
const CURRENCY_NAMES: Record<FxCurrencyCode, string> = {
  EUR: "Euro",
  NGN: "Nigerian Naira",
  BRL: "Brazilian Real",
  KES: "Kenyan Shilling",
};

interface ComparisonResult extends MtoProfile {
  totalFee: number;
  recipientGets: number;
  effectiveFeePct: number;
  savingsVsStellarFlow?: number;
}

export interface FeeSavingsWidgetProps {
  className?: string;
  defaultAmount?: number;
}

export default function FeeSavingsWidget({
  className = "",
  defaultAmount = 500,
}: FeeSavingsWidgetProps) {
  const { data } = useFxRatesWithFallback();
  const [sendAmount, setSendAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState<FxCurrencyCode>("NGN");
  const [selectedComparison, setSelectedComparison] = useState<string | null>("Western Union");

  const midRate = data.quotes.find((q) => q.currency === currency)?.rate ?? 0;

  // Calculate comparison results
  const comparisonResults = useMemo(() => {
    const results = MTO_PROFILES.map((mto) => {
      const totalFee = mto.flatFeeUsd + sendAmount * (mto.pctFee / 100);
      const netSendUsd = sendAmount - totalFee;
      const effectiveRate = midRate * (1 - mto.fxMarginPct);
      const recipientGets = netSendUsd * effectiveRate;
      const effectiveFeePct = (totalFee / sendAmount) * 100 + mto.fxMarginPct * 100;

      return {
        ...mto,
        totalFee,
        recipientGets,
        effectiveFeePct,
      };
    });

    // Calculate savings vs StellarFlow
    const stellarFlowResult = results.find((r) => r.isStellarFlow);
    if (stellarFlowResult) {
      results.forEach((result) => {
        if (!result.isStellarFlow) {
          result.savingsVsStellarFlow = result.totalFee - stellarFlowResult.totalFee;
        }
      });
    }

    return results.sort((a, b) => a.effectiveFeePct - b.effectiveFeePct);
  }, [sendAmount, midRate]);

  const stellarFlowResult = comparisonResults.find((r) => r.isStellarFlow)!;
  const selectedResult = comparisonResults.find((r) => r.provider === selectedComparison);

  // Calculate total savings over multiple transfers
  const totalSavingsCalc = useMemo(() => {
    if (!selectedResult || selectedResult.isStellarFlow) return null;

    const savingsPerTransfer = selectedResult.totalFee - stellarFlowResult.totalFee;
    const transfersPerMonth = [1, 2, 4, 12, 24, 52]; // weekly to annual

    return transfersPerMonth.map((count) => ({
      transfers: count,
      period:
        count === 1
          ? "per transfer"
          : count === 2
          ? "bi-weekly"
          : count === 4
          ? "monthly"
          : count === 12
          ? "quarterly"
          : count === 24
          ? "bi-annually"
          : "annually",
      totalSavings: savingsPerTransfer * count,
    }));
  }, [selectedResult, stellarFlowResult]);

  // Export fee breakdown as CSV
  const exportBreakdown = useCallback(() => {
    const rows = [
      ["Provider", "Send Amount (USD)", "Flat Fee", "Percentage Fee", "Total Fee", "Recipient Gets", "Effective Cost %", "Settlement Time"],
      ...comparisonResults.map((result) => [
        result.provider,
        sendAmount.toFixed(2),
        result.flatFeeUsd.toFixed(2),
        result.pctFee.toFixed(2) + "%",
        result.totalFee.toFixed(2),
        result.recipientGets.toFixed(2) + " " + currency,
        result.effectiveFeePct.toFixed(2) + "%",
        result.settlementTime,
      ]),
    ];

    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fee-comparison-${currency}-${sendAmount}-${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [comparisonResults, sendAmount, currency]);

  // Export detailed receipt as text
  const exportReceipt = useCallback(() => {
    const timestamp = new Date().toISOString();
    const content = `
═══════════════════════════════════════════════════════════════
              STELLARFLOW FEE SAVINGS SUMMARY
═══════════════════════════════════════════════════════════════

Generated: ${new Date(timestamp).toLocaleString()}
Transfer Amount: $${sendAmount.toFixed(2)} USD
Destination Currency: ${currency} (${CURRENCY_NAMES[currency]})
Mid-Market Rate: 1 USD = ${midRate.toFixed(4)} ${currency}

───────────────────────────────────────────────────────────────
                     STELLARFLOW COST
───────────────────────────────────────────────────────────────
Flat Fee:            $${stellarFlowResult.flatFeeUsd.toFixed(2)}
Percentage Fee:      ${stellarFlowResult.pctFee}%
Total Fee:           $${stellarFlowResult.totalFee.toFixed(2)}
Effective Cost:      ${stellarFlowResult.effectiveFeePct.toFixed(2)}%
Recipient Receives:  ${stellarFlowResult.recipientGets.toFixed(2)} ${currency}
Settlement Time:     ${stellarFlowResult.settlementTime}

───────────────────────────────────────────────────────────────
                COMPETITOR FEE COMPARISON
───────────────────────────────────────────────────────────────
${comparisonResults
  .filter((r) => !r.isStellarFlow)
  .map(
    (result) => `
${result.provider}:
  Total Fee:         $${result.totalFee.toFixed(2)}
  Effective Cost:    ${result.effectiveFeePct.toFixed(2)}%
  Recipient Gets:    ${result.recipientGets.toFixed(2)} ${currency}
  Savings vs SF:     $${result.savingsVsStellarFlow?.toFixed(2)}
  Settlement:        ${result.settlementTime}
`
  )
  .join("\n")}

───────────────────────────────────────────────────────────────
                    PROJECTED SAVINGS
───────────────────────────────────────────────────────────────
${
  selectedResult && !selectedResult.isStellarFlow
    ? totalSavingsCalc
        ?.map(
          (calc) =>
            `${calc.period.padEnd(15)}: $${calc.totalSavings.toFixed(2)} saved`
        )
        .join("\n")
    : "Select a competitor above to see projected savings"
}

═══════════════════════════════════════════════════════════════
           Fast • Transparent • Built on Stellar
═══════════════════════════════════════════════════════════════
`.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `stellarflow-savings-receipt-${Date.now()}.txt`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [
    comparisonResults,
    stellarFlowResult,
    selectedResult,
    totalSavingsCalc,
    sendAmount,
    currency,
    midRate,
  ]);

  return (
    <div
      className={`rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-950/20 p-6 shadow-xl ${className}`}
      data-testid="fee-savings-widget"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-neutral-100">
              Fee Savings Calculator
            </h2>
          </div>
          <p className="text-sm text-neutral-400">
            See how much you save with StellarFlow vs traditional MTOs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportBreakdown}
            className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
            aria-label="Export CSV"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={exportReceipt}
            className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-800/60"
          >
            Export Receipt
          </button>
        </div>
      </div>

      {/* Transfer Amount Slider */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
        <label htmlFor="send-amount" className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Transfer Amount
          </span>
          <span className="font-mono text-2xl font-bold text-neutral-100">
            ${sendAmount.toLocaleString()}
          </span>
        </label>
        <input
          id="send-amount"
          type="range"
          min="50"
          max="5000"
          step="50"
          value={sendAmount}
          onChange={(e) => setSendAmount(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800"
          style={{
            background: `linear-gradient(to right, rgb(16 185 129) 0%, rgb(16 185 129) ${
              ((sendAmount - 50) / (5000 - 50)) * 100
            }%, rgb(38 38 38) ${((sendAmount - 50) / (5000 - 50)) * 100}%, rgb(38 38 38) 100%)`,
          }}
        />
        <div className="mt-2 flex justify-between text-xs text-neutral-500">
          <span>$50</span>
          <span>$5,000</span>
        </div>
      </div>

      {/* Currency Selector */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">
          Destination Currency
        </label>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCurrency(code)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                currency === code
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-lg shadow-emerald-500/20"
                  : "border-neutral-700 bg-neutral-800/60 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800"
              }`}
            >
              <div className="font-mono font-bold">{code}</div>
              <div className="text-xs text-neutral-500">{CURRENCY_NAMES[code]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Comparison Cards */}
      <div className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Real-time Fee Comparison
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {comparisonResults.map((result) => (
            <button
              key={result.provider}
              type="button"
              onClick={() =>
                !result.isStellarFlow && setSelectedComparison(result.provider)
              }
              disabled={result.isStellarFlow}
              className={`rounded-xl border p-4 text-left transition-all ${
                result.isStellarFlow
                  ? "border-emerald-600 bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 cursor-default"
                  : selectedComparison === result.provider
                  ? "border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-500/10"
                  : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900"
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div
                    className={`text-sm font-bold ${
                      result.isStellarFlow ? "text-emerald-400" : "text-neutral-200"
                    }`}
                  >
                    {result.provider}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {result.settlementTime}
                  </div>
                </div>
                {result.isStellarFlow && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                    Best
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-neutral-400">Total Fee:</span>
                  <span className="font-mono text-sm font-bold text-neutral-100">
                    ${result.totalFee.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-neutral-400">Effective Cost:</span>
                  <span className="font-mono text-sm font-bold text-amber-400">
                    {result.effectiveFeePct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-neutral-400">Recipient Gets:</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {result.recipientGets.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {currency}
                  </span>
                </div>
                {result.savingsVsStellarFlow && result.savingsVsStellarFlow > 0 && (
                  <div className="mt-2 flex items-center gap-1 rounded-lg bg-red-950/40 px-2 py-1.5 border border-red-900/50">
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-300">
                      ${result.savingsVsStellarFlow.toFixed(2)} more expensive
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Savings Projection */}
      {selectedResult && !selectedResult.isStellarFlow && totalSavingsCalc && (
        <div className="rounded-xl border border-blue-800 bg-gradient-to-br from-blue-950/40 to-blue-900/20 p-5">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-bold text-neutral-100">
              Your Projected Savings vs {selectedResult.provider}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {totalSavingsCalc.slice(0, 6).map((calc, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-blue-800/50 bg-blue-950/30 p-3"
              >
                <div className="mb-1 text-xs uppercase tracking-wide text-blue-300">
                  {calc.period}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-bold text-emerald-400">
                    ${calc.totalSavings.toFixed(0)}
                  </span>
                  <span className="text-xs text-neutral-400">saved</span>
                </div>
                <div className="mt-1 text-[10px] text-neutral-500">
                  {calc.transfers} transfer{calc.transfers > 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2">
            <ArrowRight className="h-4 w-4 text-emerald-400" />
            <p className="text-xs text-emerald-200">
              Switch to StellarFlow and save{" "}
              <span className="font-bold">
                $
                {(
                  (selectedResult.totalFee - stellarFlowResult.totalFee) *
                  52
                ).toFixed(0)}
              </span>{" "}
              annually on weekly ${sendAmount} transfers
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-[10px] leading-relaxed text-neutral-500">
        <strong>Disclaimer:</strong> Fee comparison based on publicly documented fee
        ranges from traditional Money Transfer Operators and current mid-market FX
        rates. Actual third-party fees may vary by transfer amount, destination
        country, payout method, and time of day. StellarFlow fees are transparent and
        displayed before confirmation. Not financial advice.
      </p>
    </div>
  );
}
