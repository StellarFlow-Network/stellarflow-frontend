'use client'

import React from 'react'
import { useSocket } from '../../hooks/useSocket'

export default function WebSocketTest() {
  const {
    isConnected,
    lastUpdate,
    error,
    reconnectAttempts,
    subscribeToAsset,
    unsubscribeFromAsset,
  } = useSocket({
    assetIds: ['NGN-XLM'],
    enableDeltaUpdates: true,
  })

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">WebSocket Delta Test</h2>
      
      <div className="space-y-2 text-sm">
        <div className={`px-3 py-1 rounded ${
          isConnected ? 'bg-green-600' : 'bg-red-600'
        }`}>
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        
        <div className="px-3 py-1 bg-gray-800 rounded">
          Reconnect Attempts: {reconnectAttempts}
        </div>
        
        {error && (
          <div className="px-3 py-1 bg-red-900 rounded text-red-200">
            Error: {error}
          </div>
        )}
        
        {lastUpdate && (
          <div className="px-3 py-1 bg-blue-900 rounded">
            <div className="font-semibold">Last Update:</div>
            <div className="text-xs">
              Asset: {lastUpdate.assetPair}<br />
              Price: {lastUpdate.price.toFixed(6)}<br />
              Timestamp: {new Date(lastUpdate.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => subscribeToAsset('USD-XLM')}
            className="px-3 py-1 bg-blue-600 rounded text-xs hover:bg-blue-700"
          >
            Subscribe USD-XLM
          </button>
          <button
            onClick={() => unsubscribeFromAsset('USD-XLM')}
            className="px-3 py-1 bg-orange-600 rounded text-xs hover:bg-orange-700"
          >
            Unsubscribe USD-XLM
          </button>
        </div>
      </div>
    </div>
  )
}
