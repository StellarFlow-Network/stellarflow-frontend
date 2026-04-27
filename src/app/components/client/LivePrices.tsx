'use client'

import { useMemo } from 'react'
import { useSocket } from '../../hooks/useSocket'

interface PriceData {
  symbol: string
  price: number
  timestamp: number
}

export default function LivePrices({ initialData }: any) {
  // Subscribe to multiple asset updates
  const { isConnected, prices, error } = useSocket({
    assetIds: ['NGN-XLM', 'USD-XLM', 'EUR-XLM'],
    enableDeltaUpdates: true,
  })

  // Derive display data from initialData and live prices
  // This approach is more efficient than useEffect + setState
  const displayData = useMemo(() => {
    const merged = [...(initialData || [])]
    
    Object.entries(prices).forEach(([assetId, update]) => {
      const index = merged.findIndex(p => p.symbol === assetId)
      if (index !== -1) {
        merged[index] = {
          ...merged[index],
          price: update.price,
          timestamp: update.timestamp,
        }
      } else {
        merged.push({
          symbol: assetId,
          price: update.price,
          timestamp: update.timestamp,
        })
      }
    })
    
    return merged
  }, [initialData, prices])

  return (
    <div>
      <h2>Live Prices</h2>
      <div className={`text-xs mb-2 ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
        {isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
      </div>
      {error && <div className="text-red-400 text-xs mb-2">Error: {error}</div>}
      {displayData?.map((p: PriceData) => (
        <div key={p.symbol}>
          {p.symbol}: {p.price}
        </div>
      ))}
    </div>
  )
}
