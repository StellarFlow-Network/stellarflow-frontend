"use client";

/**
 * useFxRates — Issue #718
 *
 * Polls the backend FX price feed every 15 seconds for the cross-border
 * remittance corridor currencies (USD base against EUR, NGN, BRL, KES).
 * Falls back to a locally generated snapshot if the feed is unreachable so
 * the ticker and comparison table always have something to render.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { FxCurrencyCode, FxRatesResponse } from "@/types/fxRates";

export const FX_POLL_INTERVAL_MS = 15_000;

const FALLBACK_BASE_RATES: Record<FxCurrencyCode, number> = {
  EUR: 0.92,
  NGN: 1487.5,
  BRL: 5.42,
  KES: 129.3,
};

function buildFallbackSnapshot(): FxRatesResponse {
  const now = new Date().toISOString();
  return {
    base: "USD",
    generatedAt: now,
    rateLockSeconds: 60,
    quotes: (Object.keys(FALLBACK_BASE_RATES) as FxCurrencyCode[]).map((currency) => ({
      currency,
      rate: FALLBACK_BASE_RATES[currency],
      changeAbs: 0,
      changePct: 0,
      updatedAt: now,
    })),
  };
}

const QUERY_KEY = ["fx-rates"] as const;

export function useFxRates(): UseQueryResult<FxRatesResponse, Error> {
  return useQuery<FxRatesResponse, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/fx-rates", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch FX rates: ${res.status}`);
      }
      return res.json();
    },
    placeholderData: (prev) => prev,
    refetchInterval: FX_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: FX_POLL_INTERVAL_MS,
    retry: 1,
  });
}

/**
 * Same data as {@link useFxRates}, guaranteed to return a snapshot even
 * before the first successful fetch or when the feed is unavailable.
 */
export function useFxRatesWithFallback(): {
  data: FxRatesResponse;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
} {
  const query = useFxRates();

  if (query.data) {
    return {
      data: query.data,
      isLoading: false,
      isFetching: query.isFetching,
      error: query.error,
    };
  }

  return {
    data: buildFallbackSnapshot(),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
