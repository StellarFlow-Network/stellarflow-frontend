'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { unstable_batchedUpdates } from 'react-dom'
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
  prices: Record<string, PriceData>
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
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const subscribedAssetsRef = useRef<Set<string>>(new Set(assetIds))
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageBufferRef = useRef<SocketMessage[]>([])
  const batchScheduledRef = useRef<boolean>(false)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        unstable_batchedUpdates(() => {
          setIsConnected(true)
          setError(null)
          setReconnectAttempts(0)
        })
        
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
            messageBufferRef.current.push(message)
            
            // Schedule a batch update if not already scheduled
            if (!batchScheduledRef.current) {
              batchScheduledRef.current = true
              
              // Use queueMicrotask for high-priority batching within the same event loop tick if possible,
              // or setTimeout(0) to ensure we yield to the browser once between batches if flooded.
              queueMicrotask(() => {
                batchScheduledRef.current = false
                const batch = [...messageBufferRef.current]
                messageBufferRef.current = []
                
                if (batch.length === 0) return

                unstable_batchedUpdates(() => {
                  batch.forEach(msg => {
                    const updateData = msg.data as PriceData
                    const assetId = msg.assetId || updateData.assetPair || updateData.id
                    
                    // Update the single 'lastUpdate' state for backward compatibility
                    setLastUpdate(updateData)
                    
                    // Update the grouped 'prices' map for multi-asset card performance
                    setPrices(prev => {
                      const existing = prev[assetId]
                      const merged = (msg.type === 'delta_update' && existing)
                        ? { ...existing, ...updateData }
                        : updateData
                      return { ...prev, [assetId]: merged }
                    })
                  })
                })
              })
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      wsRef.current.onclose = (event) => {
        setIsConnected(false)
        
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectAttempts, maxReconnectAttempts, reconnectInterval]) // Removed lastUpdate to prevent re-connection loops

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

  return {
    isConnected,
    lastUpdate,
    prices,
    error,
    reconnectAttempts,
    subscribeToAsset,
    unsubscribeFromAsset,
    disconnect,
    reconnect,
  }
}
