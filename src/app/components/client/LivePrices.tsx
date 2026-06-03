"use client"

import React, { memo } from "react"
import { useAssetPrice } from "../../hooks/useAssetPrice"
import { useSocketConnection } from "../providers/SocketProvider"

const CHART_HISTORY_LIMIT = 150;

interface PriceData {
  symbol: string
  price: number
  timestamp: number
}

function LivePrices({ initialData }: any) {
  const [data, setData] = useState<PriceData[]>(initialData || [])
  
  // Subscribe to multiple asset updates
  const { isConnected, lastUpdate, error } = useSocket({
    assetIds: ['NGN-XLM', 'USD-XLM', 'EUR-XLM'],
    enableDeltaUpdates: true,
  })

  useEffect(() => {
    if (lastUpdate) {
      setData(prevData => {
        const index = prevData.findIndex(p => p.symbol === lastUpdate.assetPair)
        let next: PriceData[]
        if (index !== -1) {
          next = [...prevData]
          next[index] = {
            ...next[index],
            price: lastUpdate.price,
            timestamp: lastUpdate.timestamp,
          }
        } else {
          next = [...prevData, {
            symbol: lastUpdate.assetPair,
            price: lastUpdate.price,
            timestamp: lastUpdate.timestamp,
          }]
        }
        // Cap to the last CHART_HISTORY_LIMIT entries and null-prune trailing
        // slots to release memory registers back to the browser GC.
        const windowed = next.slice(-CHART_HISTORY_LIMIT)
        windowed.length = windowed.length
        return windowed
      })
    }
  }, [lastUpdate])

  return (
    <div>
      <h2 className="text-sm font-bold mb-2">Live Prices</h2>
      <div className={`text-xs mb-2 ${isConnected ? "text-green-400" : "text-yellow-400"}`}>
        {isConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
      </div>
      {error && <div className="text-red-400 text-xs mb-2">Error: {error}</div>}

      <div className="space-y-1">
        {initialAssets.map((id: string) => (
          <PriceRow key={id} assetId={id} />
        ))}
      </div>
    </div>
  )
}

export default memo(LivePrices)