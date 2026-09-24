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

interface LivePricesProps {
  initialData?: PriceData[];
}

function LivePrices({ initialData = [] }: LivePricesProps) {
  
  const [data, setData] = useState<PriceData[]>(initialData);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  
  // Subscribe to multiple asset updates
  const { isConnected, lastUpdate, error } = useSocket({
    assetIds: [...ASSET_SYMBOL_LIST],
    enableDeltaUpdates: autoRefreshEnabled,
  })

  useEffect(() => {
    if (lastUpdate && autoRefreshEnabled) {
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
        const windowed = next.slice(-CHART_HISTORY_LIMIT)
        windowed.length = windowed.length
        return windowed
      })
    }
  }, [lastUpdate, autoRefreshEnabled])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2>Live Prices</h2>
        <div className="flex items-center gap-3">
          {/* Visual pulse indicator for active connection state */}
          <div className="flex items-center gap-2" title={isConnected && autoRefreshEnabled ? "Active connection" : "Paused / Disconnected"}>
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected && autoRefreshEnabled ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-xs text-zinc-400 font-mono">
              {isConnected && autoRefreshEnabled ? 'Live' : 'Paused'}
            </span>
          </div>
          
          {/* Auto-Refresh Toggle Button */}
          <button
            onClick={() => setAutoRefreshEnabled(prev => !prev)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              autoRefreshEnabled
                ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            {autoRefreshEnabled ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}
          </button>
        </div>
      </div>

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