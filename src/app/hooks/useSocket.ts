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
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts)
  const reconnectIntervalRef = useRef(reconnectInterval)

  useEffect(() => {
    subscribedAssetsRef.current = new Set(assetIds)
  }, [assetIds])

  useEffect(() => {
    maxReconnectAttemptsRef.current = maxReconnectAttempts
  }, [maxReconnectAttempts])

  useEffect(() => {
    reconnectIntervalRef.current = reconnectInterval
  }, [reconnectInterval])

  const normalizePriceData = useCallback((message: SocketMessage): PriceData | null => {
    if (!message.data || typeof message.data !== 'object') {
      return null
    }

    const current = message.data as Partial<PriceData>
    const assetPair = current.assetPair ?? message.assetId
    const price = Number(current.price)
    const timestamp = Number(current.timestamp ?? message.timestamp)

    if (!assetPair || !Number.isFinite(price) || !Number.isFinite(timestamp)) {
      return null
    }

    return {
      id: current.id ?? assetPair,
      assetPair,
      price,
      decimals: current.decimals ?? 2,
      source: current.source ?? 'stellarflow-oracle',
      timestamp,
      confidenceScore: current.confidenceScore ?? 0,
      metadata: current.metadata,
    }
  }, [])

  const connect = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      // Use ws protocol for development, wss for production
      const protocol = process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/ws`
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
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
            const nextUpdate = normalizePriceData(message)

            if (!nextUpdate) {
              console.warn('Ignoring malformed WebSocket price update:', message)
              return
            }

            setLastUpdate(prev =>
              message.type === 'delta_update' && prev?.assetPair === nextUpdate.assetPair
                ? { ...prev, ...nextUpdate }
                : nextUpdate
            )
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      wsRef.current.onclose = (event) => {
        setIsConnected(false)
        
        // Attempt reconnection if not manually closed and within max attempts
        if (!event.wasClean && reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
          reconnectAttemptsRef.current += 1
          setReconnectAttempts(reconnectAttemptsRef.current)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectIntervalRef.current)
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
  }, [normalizePriceData])

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
    reconnectAttemptsRef.current = 0
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
