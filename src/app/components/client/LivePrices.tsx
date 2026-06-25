"use client"

import React, { useEffect, useState, memo } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { ASSET_SYMBOL_LIST } from '@/config/assetSymbols'
import { CHART_HISTORY_LIMIT } from '../../charts/chartCalculations'

interface PriceData {
  symbol: string
  price: number
  timestamp: number
}

function LivePrices({ initialData }: any) {
  const [data, setData] = useState<PriceData[]>(initialData || [])
  
  // Subscribe to multiple asset updates
  const { isConnected, lastUpdate, error } = useSocket({
    assetIds: [...ASSET_SYMBOL_LIST],
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

export default memo(LivePrices);