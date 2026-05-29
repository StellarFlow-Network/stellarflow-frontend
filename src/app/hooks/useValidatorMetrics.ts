'use client'

import { useMemo } from 'react'
import { useSocketData } from '../components/providers/SocketProvider'
import { PriceData } from '@/types'

// ---------------------------------------------------------------------------
// useValidatorMetric
// ---------------------------------------------------------------------------

/**
 * Granular selector hook for validator / relayer health metrics.
 *
 * Reads from `SocketDataContext` and applies a selector function to extract
 * only the slice a component cares about.  `useMemo` ensures a stable
 * reference is returned whenever `lastUpdate` and `selector` are unchanged,
 * so memoised child components (e.g. `RelayerRow` behind `React.memo`) won't
 * re-render when unrelated fields change.
 *
 * For primitive selectors (string / number / boolean) React's triple-equals
 * comparison provides the bail-out automatically.  For object selectors use
 * `useRelayerHealthMetrics` (which uses granular deps) or wrap your selector
 * in `useCallback` at the call site.
 *
 * @example
 * // Only propagates a change when `confidenceScore` actually changes.
 * const confidence = useValidatorMetric(
 *   useCallback((d) => d?.confidenceScore ?? 0, []),
 * )
 */
export function useValidatorMetric<T>(
  selector: (data: PriceData | null) => T,
): T {
  const { lastUpdate } = useSocketData()
  return useMemo(() => selector(lastUpdate), [lastUpdate, selector])
}

// ---------------------------------------------------------------------------
// useValidatorMetricField
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that selects a single named field from the live data.
 * The field name is the only dep; the returned value is memoised.
 *
 * @example
 * const price = useValidatorMetricField('price')
 */
export function useValidatorMetricField<K extends keyof PriceData>(
  field: K,
): PriceData[K] | undefined {
  const { lastUpdate } = useSocketData()
  return useMemo(() => lastUpdate?.[field], [lastUpdate, field])
}

// ---------------------------------------------------------------------------
// useRelayerHealthMetrics
// ---------------------------------------------------------------------------

/**
 * Composite selector for the staking / relayer health panel.
 *
 * Uses **granular memo deps** — the returned object reference only changes
 * when one of the four tracked fields (`price`, `confidenceScore`, `source`,
 * `timestamp`) actually changes.  A volume-only update or a pair label change
 * will not produce a new object, shielding the staking list from processing
 * those evaluation ticks.
 *
 * @example
 * function ValidatorRow() {
 *   const { price, confidenceScore } = useRelayerHealthMetrics()
 *   // Re-renders only when price or confidenceScore changes.
 * }
 */
export interface RelayerHealthMetrics {
  price: number
  confidenceScore: number
  source: string
  timestamp: number
}

export function useRelayerHealthMetrics(): RelayerHealthMetrics {
  const { lastUpdate } = useSocketData()

  return useMemo(
    () => ({
      price: lastUpdate?.price ?? 0,
      confidenceScore: lastUpdate?.confidenceScore ?? 0,
      source: lastUpdate?.source ?? '',
      timestamp: lastUpdate?.timestamp ?? 0,
    }),
    // Granular deps: recompute only when these specific fields change.
    [
      lastUpdate?.price,
      lastUpdate?.confidenceScore,
      lastUpdate?.source,
      lastUpdate?.timestamp,
    ],
  )
}


