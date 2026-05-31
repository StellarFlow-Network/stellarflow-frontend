"use client"

import { useEffect, useState } from "react"
import { useSocketActions, useSocketData } from "../components/providers/SocketProvider"

interface AssetPrice {
  price?: number
  timestamp?: number
}

/**
 * Subscribe to a single asset and expose a localized price state.
 * This hook only updates its internal state when the incoming WS tick
 * targets `assetId`, avoiding re-renders when unrelated assets change.
 */
export function useAssetPrice(assetId: string): AssetPrice {
  const { subscribeToAsset, unsubscribeFromAsset } = useSocketActions()
  const { lastUpdate } = useSocketData()

  const [state, setState] = useState<AssetPrice>({ price: undefined, timestamp: undefined })

  // Subscribe once on mount, and unsubscribe on unmount.
  useEffect(() => {
    subscribeToAsset(assetId)
    return () => {
      unsubscribeFromAsset(assetId)
    }
  }, [assetId, subscribeToAsset, unsubscribeFromAsset])

  // Update local state only when the global `lastUpdate` refers to our asset.
  useEffect(() => {
    if (!lastUpdate) return
    if (lastUpdate.assetPair === assetId) {
      setState({ price: lastUpdate.price, timestamp: lastUpdate.timestamp })
    }
  }, [assetId, lastUpdate])

  return state
}
