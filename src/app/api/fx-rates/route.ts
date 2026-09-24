import { NextResponse } from "next/server";
import type { FxCurrencyCode, FxRatesResponse } from "@/types/fxRates";

/**
 * Backend price feed stand-in for the live FX rate ticker (#718).
 *
 * Base rates approximate real-world USD crosses. Each request applies a
 * small deterministic-but-time-varying jitter so consecutive polls show
 * believable movement without a real market data provider wired up yet.
 * Swap this handler for a real upstream feed when one is available — the
 * response shape (`FxRatesResponse`) is the only contract callers rely on.
 */

const BASE_RATES: Record<FxCurrencyCode, number> = {
  EUR: 0.92,
  NGN: 1487.5,
  BRL: 5.42,
  KES: 129.3,
};

/** How long a quoted rate is considered guaranteed before the next refresh. */
const RATE_LOCK_SECONDS = 60;

function jitter(base: number, seed: number): number {
  // Smooth, bounded pseudo-random walk keyed off wall-clock time so it looks
  // "live" across polls without needing server-side state.
  const t = Date.now() / 1000 + seed * 977;
  const wobble = Math.sin(t / 9) * 0.0009 + Math.sin(t / 23) * 0.0004;
  return base * (1 + wobble);
}

export async function GET() {
  const now = Date.now();

  const quotes = (Object.keys(BASE_RATES) as FxCurrencyCode[]).map((currency, index) => {
    const base = BASE_RATES[currency];
    const rate = jitter(base, index);
    const changeAbs = rate - base;
    const changePct = (changeAbs / base) * 100;

    return {
      currency,
      rate: Number(rate.toFixed(4)),
      changeAbs: Number(changeAbs.toFixed(4)),
      changePct: Number(changePct.toFixed(3)),
      updatedAt: new Date(now).toISOString(),
    };
  });

  const body: FxRatesResponse = {
    base: "USD",
    quotes,
    generatedAt: new Date(now).toISOString(),
    rateLockSeconds: RATE_LOCK_SECONDS,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
