'use client'

import { useEffect, useRef } from 'react'
import { storeDataPoints, pruneDataPoints } from '@/lib/indexeddb'
import { useSocketData } from '@/app/components/providers/SocketProvider'

const FLUSH_INTERVAL_MS = 10_000
const PRUNE_INTERVAL_MS = 300_000
const MAX_BATCH_SIZE = 50

export function useHistoricalSync(enabled: boolean = true) {
  const { lastUpdate } = useSocketData()
  const batchRef = useRef<Array<{
    assetPair: string
    timestamp: number
    price: number
    decimals: number
    source: string
    confidenceScore: number
  }>>([])
  const lastPruneRef = useRef(0)
  const lastDataRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !lastUpdate) return

    const key = `${lastUpdate.assetPair}_${lastUpdate.timestamp}`
    if (key === lastDataRef.current) return
    lastDataRef.current = key

    batchRef.current.push({
      assetPair: lastUpdate.assetPair,
      timestamp: lastUpdate.timestamp,
      price: lastUpdate.price,
      decimals: lastUpdate.decimals,
      source: lastUpdate.source,
      confidenceScore: lastUpdate.confidenceScore,
    })

    if (batchRef.current.length >= MAX_BATCH_SIZE) {
      const batch = batchRef.current.splice(0, MAX_BATCH_SIZE)
      storeDataPoints(batch).catch(() => {})
    }
  }, [lastUpdate, enabled])

  useEffect(() => {
    if (!enabled) return

    const flushTimer = setInterval(() => {
      if (batchRef.current.length > 0) {
        const batch = batchRef.current.splice(0)
        storeDataPoints(batch).catch(() => {})
      }
    }, FLUSH_INTERVAL_MS)

    return () => clearInterval(flushTimer)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const pruneTimer = setInterval(() => {
      const now = Date.now()
      if (now - lastPruneRef.current >= PRUNE_INTERVAL_MS) {
        lastPruneRef.current = now
        pruneDataPoints().catch(() => {})
      }
    }, PRUNE_INTERVAL_MS)

    return () => clearInterval(pruneTimer)
  }, [enabled])
}
