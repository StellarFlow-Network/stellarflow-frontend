'use client'

import React from 'react'
import { useSocket } from '../../hooks/useSocket'

export default function WebSocketTest() {
  const {
    isConnected,
    lastUpdate,
    prices,
    error,
    reconnectAttempts,
    subscribeToAsset,
    unsubscribeFromAsset,
  } = useSocket({
    assetIds: ['NGN-XLM', 'USD-XLM', 'EUR-XLM'],
    enableDeltaUpdates: true,
  })

  return (
    <div className="p-6 bg-gray-900 border border-gray-800 text-white rounded-2xl max-w-md mx-auto mt-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight">WebSocket Monitor</h2>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
          isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {isConnected ? 'LIVE' : 'DISCONNECTED'}
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="text-gray-500 mb-1">Reconnects</div>
            <div className="font-mono font-bold text-gray-200">{reconnectAttempts}</div>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="text-gray-500 mb-1">Active Assets</div>
            <div className="font-mono font-bold text-gray-200">{Object.keys(prices).length}</div>
          </div>
        </div>
        
        {error && (
          <div className="px-4 py-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Live Asset Prices (Batched)</div>
          {Object.values(prices).length === 0 ? (
            <div className="p-4 text-center text-gray-600 text-xs italic bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
              Waiting for updates...
            </div>
          ) : (
            Object.values(prices).map((update) => (
              <div key={update.assetPair} className="flex items-center justify-between p-3 bg-blue-900/10 border border-blue-900/20 rounded-xl transition-all duration-300">
                <div className="font-bold text-sm text-blue-200">{update.assetPair}</div>
                <div className="text-right">
                  <div className="font-mono font-bold text-blue-400">{update.price.toFixed(6)}</div>
                  <div className="text-[9px] text-gray-500">{new Date(update.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="pt-4 flex gap-2">
          <button
            onClick={() => subscribeToAsset('USD-XLM')}
            className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-xl text-[10px] font-bold tracking-wider transition-colors"
          >
            + USD-XLM
          </button>
          <button
            onClick={() => subscribeToAsset('EUR-XLM')}
            className="flex-1 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-xl text-[10px] font-bold tracking-wider transition-colors"
          >
            + EUR-XLM
          </button>
        </div>
      </div>
    </div>
  )
}
