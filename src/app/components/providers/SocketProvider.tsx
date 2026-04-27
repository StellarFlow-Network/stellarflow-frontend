'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useSocket, UseSocketOptions } from '../../hooks/useSocket'
import { PriceData } from '@/types'

interface SocketContextType {
  isConnected: boolean
  lastUpdate: PriceData | null
  error: string | null
  reconnectAttempts: number
  subscribeToAsset: (assetId: string) => void
  unsubscribeFromAsset: (assetId: string) => void
  disconnect: () => void
  reconnect: () => void
}

const SocketContext = createContext<SocketContextType | null>(null)

interface SocketProviderProps {
  children: ReactNode
  options?: UseSocketOptions
}

export function SocketProvider({ children, options }: SocketProviderProps) {
  const socketHook = useSocket(options)

  return (
    <SocketContext.Provider value={socketHook}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext(): SocketContextType {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider')
  }
  return context
}
