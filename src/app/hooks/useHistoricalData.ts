'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDataPoints, getLatestDataPoints, getAllAssetPairs } from '@/lib/indexeddb'
import type { HistoricalDataPoint } from '@/types'

interface UseHistoricalDataOptions {
  fromTimestamp?: number
  toTimestamp?: number
  limit?: number
}

export function useHistoricalData(
  assetPair: string | null,
  options?: UseHistoricalDataOptions,
) {
  const [data, setData] = useState<HistoricalDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const pair = assetPair
      if (!pair) {
        setData([])
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const points = await getDataPoints(pair, {
          fromTimestamp: options?.fromTimestamp,
          toTimestamp: options?.toTimestamp,
          limit: options?.limit ?? 500,
        })
        if (!cancelled) {
          setData(points)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load historical data')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [assetPair, options?.fromTimestamp, options?.toTimestamp, options?.limit, refreshKey])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  return { data, loading, error, refresh }
}

export function useLatestHistoricalData(
  assetPair: string | null,
  count: number = 50,
) {
  const [data, setData] = useState<HistoricalDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const pair = assetPair
      if (!pair) {
        setData([])
        setLoading(false)
        return
      }

      try {
        const points = await getLatestDataPoints(pair, count)
        if (!cancelled) setData(points)
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [assetPair, count])

  return { data, loading }
}

export function useHistoricalAssetPairs() {
  const [pairs, setPairs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const result = await getAllAssetPairs()
        if (!cancelled) setPairs(result)
      } catch {
        if (!cancelled) setPairs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { pairs, loading }
}
