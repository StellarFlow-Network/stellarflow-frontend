'use client'

/**
 * useMetrics — Global SWR-style deduplication layer for West-African
 * corridor metrics.
 *
 * Problem: Multiple dashboard panels (corridor table, order-book depth,
 * sparkline cards) each previously instantiated their own data requests for
 * the same regional corridor payload, producing redundant client network
 * traffic on every render cycle.
 *
 * Solution:
 *   1. Module-level `inflightPool` Map — explicit request pooling at the
 *      `queryFn` boundary. When the first caller triggers a fetch for a given
 *      key, the in-flight Promise is stored in the pool. Every subsequent
 *      parallel caller for the same key receives the *same* Promise and waits
 *      on the single network response rather than issuing a duplicate request.
 *      The entry is removed from the pool once the request settles.
 *
 *   2. Shared `CORRIDOR_METRICS_QUERY_KEY` — TanStack Query's built-in
 *      deduplication ensures all hook consumers sharing the same key are
 *      served from one observer group. Pairing this with the inflight pool
 *      provides a double-barrier: React-layer dedup + fetch-layer dedup.
 *
 * Usage:
 *   // Any number of panels can call this hook; only one network request is
 *   // ever in flight at a time for the corridor-metrics endpoint.
 *   const { data, isLoading, isFetching, error } = useMetrics()
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getCacheProfile } from '../app/lib/cacheProfiles'
import type {
  CorridorData,
  CorridorMetrics,
  OrderBookEntry,
} from '../app/hooks/useCorridorMetrics'

// ---------------------------------------------------------------------------
// Re-export types so consumers can import from a single location.
// ---------------------------------------------------------------------------
export type { CorridorData, CorridorMetrics, OrderBookEntry }

// ---------------------------------------------------------------------------
// Shared query key — must stay identical to the key used in
// useCorridorMetrics so the two hooks share the same TanStack Query cache
// slot when both are mounted simultaneously.
// ---------------------------------------------------------------------------
export const CORRIDOR_METRICS_QUERY_KEY = ['corridor-metrics'] as const

// ---------------------------------------------------------------------------
// Inflight request pool — the explicit deduplication barrier.
//
// Keys are serialised query-key strings; values are the raw fetch Promises.
// All callers that arrive while a request is already in flight receive the
// stored Promise and await the same response, preventing parallel HTTP round
// trips for identical corridor data.
// ---------------------------------------------------------------------------
const inflightPool = new Map<string, Promise<CorridorData>>()

/**
 * Fetch corridor metrics through the inflight pool.
 *
 * If a request for `poolKey` is already in flight every concurrent invocation
 * joins it.  A new request is only issued once the previous one settles.
 */
function fetchCorridorMetrics(poolKey: string): Promise<CorridorData> {
  const existing = inflightPool.get(poolKey)
  if (existing) {
    // Another caller already owns this request — share it.
    return existing
  }

  const request = fetch('/api/corridor-metrics', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch corridor metrics: ${res.status}`)
      }
      return res.json() as Promise<CorridorData>
    })
    .finally(() => {
      // Release the pool slot so the next refetch cycle can issue a fresh
      // request rather than re-using a resolved (or rejected) Promise.
      inflightPool.delete(poolKey)
    })

  inflightPool.set(poolKey, request)
  return request
}

// ---------------------------------------------------------------------------
// useMetrics
// ---------------------------------------------------------------------------

/**
 * Primary hook for corridor metrics across all dashboard panels.
 *
 * Any number of components may call `useMetrics()` simultaneously; they will
 * all subscribe to the same TanStack Query cache slot *and* share the same
 * underlying HTTP request via `inflightPool`.
 */
export function useMetrics(): UseQueryResult<CorridorData, Error> {
  const profile = getCacheProfile('corridorMetrics')
  const poolKey = CORRIDOR_METRICS_QUERY_KEY.join(':')

  return useQuery<CorridorData, Error>({
    queryKey: CORRIDOR_METRICS_QUERY_KEY,
    queryFn: () => fetchCorridorMetrics(poolKey),
    placeholderData: (prev) => prev,
    staleTime: profile.staleTime,
    gcTime: profile.gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// ---------------------------------------------------------------------------
// useMetricsWithFallback — convenience wrapper that returns mock data when
// no live data is available yet, matching the ergonomics of
// useCorridorMetricsWithFallback.
// ---------------------------------------------------------------------------

function getMockData(): CorridorData {
  return {
    metrics: [
      {
        pair: 'USD / NGN',
        source: 'Binance / Local B2C',
        rate: 1485.5,
        spread: 0.12,
        volume24h: 4_250_000,
        latencyMs: 45,
        status: 'optimal',
      },
      {
        pair: 'XLM / KES',
        source: 'Stellar DEX / Luno',
        rate: 16.4,
        spread: 0.25,
        volume24h: 1_850_000,
        latencyMs: 120,
        status: 'optimal',
      },
      {
        pair: 'NGN / GHS',
        source: 'Cross-Corridor Implied',
        rate: 0.092,
        spread: 0.68,
        volume24h: 920_000,
        latencyMs: 240,
        status: 'degraded',
      },
    ],
    bids: [
      { price: 1485.1, amount: 2500, total: 2500 },
      { price: 1484.8, amount: 4800, total: 7300 },
      { price: 1484.2, amount: 12500, total: 19800 },
    ],
    asks: [
      { price: 1485.9, amount: 3100, total: 3100 },
      { price: 1486.3, amount: 6200, total: 9300 },
      { price: 1487.0, amount: 15000, total: 24300 },
    ],
  }
}

/**
 * Drop-in replacement for `useCorridorMetricsWithFallback` that routes through
 * the deduplication layer.
 */
export function useMetricsWithFallback(): {
  data: CorridorData
  isLoading: boolean
  isFetching: boolean
  error: Error | null
} {
  const query = useMetrics()

  if (query.data) {
    return {
      data: query.data,
      isLoading: false,
      isFetching: query.isFetching,
      error: query.error,
    }
  }

  return {
    data: getMockData(),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  }
}
