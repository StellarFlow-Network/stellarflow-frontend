"use client";

/**
 * FxRateTicker — Issue #718
 *
 * Live fiat conversion rates for the cross-border remittance corridors
 * (USD → EUR, NGN, BRL, KES), refreshed every 15s via `useFxRates`.
 */

import { useFxRatesWithFallback } from "@/app/hooks/useFxRates";
import RateLockCountdown from "./RateLockCountdown";

const CURRENCY_META: Record<string, { flag: string; label: string }> = {
  EUR: { flag: "🇪🇺", label: "Euro" },
  NGN: { flag: "🇳🇬", label: "Nigerian Naira" },
  BRL: { flag: "🇧🇷", label: "Brazilian Real" },
  KES: { flag: "🇰🇪", label: "Kenyan Shilling" },
};

export interface FxRateTickerProps {
  className?: string;
}

export default function FxRateTicker({ className = "" }: FxRateTickerProps) {
  const { data, isFetching } = useFxRatesWithFallback();

  return (
    <div
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 ${className}`}
      data-testid="fx-rate-ticker"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            Live Global FX
          </p>
          <p className="text-sm font-semibold text-neutral-200">1 USD equals</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${isFetching ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
            aria-hidden
          />
          <RateLockCountdown anchorTimestamp={data.generatedAt} lockSeconds={data.rateLockSeconds} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.quotes.map((quote) => {
          const meta = CURRENCY_META[quote.currency];
          const isUp = quote.changePct >= 0;
          return (
            <div
              key={quote.currency}
              className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3"
            >
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span aria-hidden>{meta?.flag}</span>
                <span className="font-mono">{quote.currency}</span>
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-neutral-100">
                {quote.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </div>
              <div
                className={`mt-0.5 text-[11px] font-mono ${
                  isUp ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {isUp ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(3)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
