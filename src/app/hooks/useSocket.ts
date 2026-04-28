'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PriceData } from '@/types'

interface SocketMessage {
  type: 'price_update' | 'delta_update'
  assetId?: string
  data: PriceData | Partial<PriceData>
  timestamp: number
}

export interface UseSocketOptions {
  assetIds?: string[]
  enableDeltaUpdates?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface UseSocketReturn {
  isConnected: boolean
  lastUpdate: PriceData | null
  error: string | null
  reconnectAttempts: number
  subscribeToAsset: (assetId: string) => void
  unsubscribeFromAsset: (assetId: string) => void
  disconnect: () => void
  reconnect: () => void
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    assetIds = [],
    enableDeltaUpdates = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<PriceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const subscribedAssetsRef = useRef<Set<string>>(new Set(assetIds))
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      // Use ws protocol for development, wss for production
      const protocol = process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        setError(null)
        setReconnectAttempts(0)
        
        // Subscribe to initial asset IDs
        if (subscribedAssetsRef.current.size > 0) {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe',
            assetIds: Array.from(subscribedAssetsRef.current)
          }))
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: SocketMessage = JSON.parse(event.data)
          
          if (message.type === 'price_update' || message.type === 'delta_update') {
            // Handle delta updates by merging with existing data
            if (message.type === 'delta_update' && lastUpdate && message.assetId) {
              setLastUpdate(prev => prev ? { ...prev, ...message.data as PriceData } : message.data as PriceData)
            } else {
              setLastUpdate(message.data as PriceData)
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      wsRef.current.onclose = (event) => {
        setIsConnected(false)
        
        // Attempt reconnection if not manually closed and within max attempts
        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          setReconnectAttempts(prev => prev + 1)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      wsRef.current.onerror = (event) => {
        setError('WebSocket connection error')
        console.error('WebSocket error:', event)
      }

    } catch (err) {
      setError('Failed to establish WebSocket connection')
      console.error('Connection error:', err)
    }
  }, [lastUpdate, reconnectAttempts, maxReconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    
    setIsConnected(false)
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    setReconnectAttempts(0)
    setTimeout(connect, 100)
  }, [disconnect, connect])

  const subscribeToAsset = useCallback((assetId: string) => {
    if (!subscribedAssetsRef.current.has(assetId)) {
      subscribedAssetsRef.current.add(assetId)
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          assetIds: [assetId]
        }))
      }
    }
  }, [])

  const unsubscribeFromAsset = useCallback((assetId: string) => {
    if (subscribedAssetsRef.current.has(assetId)) {
      subscribedAssetsRef.current.delete(assetId)
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          assetIds: [assetId]
        }))
      }
    }
  }, [])

  // Initialize connection
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
        wsRef.current = null
      }
    }
  }, [])

  return {
    isConnected,
    lastUpdate,
    error,
    reconnectAttempts,
    subscribeToAsset,
    unsubscribeFromAsset,
    disconnect,
    reconnect,
  }
}
