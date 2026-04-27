'use client'

import { useEffect, useState } from 'react'
import { useSocket } from '../../hooks/useSocket'

interface PriceData {
  symbol: string
  price: number
  timestamp: number
}

export default function LivePrices({ initialData }: any) {
  const [data, setData] = useState<PriceData[]>(initialData || [])
  
  // Subscribe to multiple asset updates
  const { isConnected, lastUpdate, error } = useSocket({
    assetIds: ['NGN-XLM', 'USD-XLM', 'EUR-XLM'],
    enableDeltaUpdates: true,
  })

  useEffect(() => {
    if (lastUpdate) {
      // Update the specific asset in the data array
      setData(prevData => {
        const index = prevData.findIndex(p => p.symbol === lastUpdate.assetPair)
        if (index !== -1) {
          const newData = [...prevData]
          newData[index] = {
            ...newData[index],
            price: lastUpdate.price,
            timestamp: lastUpdate.timestamp,
          }
          return newData
        } else {
          // Add new asset if not found
          return [...prevData, {
            symbol: lastUpdate.assetPair,
            price: lastUpdate.price,
            timestamp: lastUpdate.timestamp,
          }]
        }
      })
    }
  }, [lastUpdate])

  return (
    <div>
      <h2>Live Prices</h2>
      <div className={`text-xs mb-2 ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
        {isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
      </div>
      {error && <div className="text-red-400 text-xs mb-2">Error: {error}</div>}
      {data?.map((p: PriceData) => (
        <div key={p.symbol}>
          {p.symbol}: {p.price}
        </div>
      ))}
    </div>
  )
}