'use client'

import React, {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from 'react'
import { useSocket, UseSocketOptions } from '../../hooks/useSocket'
import { PriceData } from '@/types'

// ---------------------------------------------------------------------------
// Three independent contexts — each slice re-renders only its own consumers.
// ---------------------------------------------------------------------------

/** Connection / error metadata — stable between data ticks. */
interface SocketConnectionContextType {
  isConnected: boolean
  error: string | null
  reconnectAttempts: number
}

/** Live data slice — updates on every WebSocket message. */
interface SocketDataContextType {
  lastUpdate: PriceData | null
}

/** Stable action callbacks — identity never changes after mount. */
interface SocketActionsContextType {
  subscribeToAsset: (assetId: string) => void
  unsubscribeFromAsset: (assetId: string) => void
  disconnect: () => void
  reconnect: () => void
}

const SocketConnectionContext =
  createContext<SocketConnectionContextType | null>(null)
const SocketDataContext = createContext<SocketDataContextType | null>(null)
const SocketActionsContext = createContext<SocketActionsContextType | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SocketProviderProps {
  children: ReactNode
  options?: UseSocketOptions
}

export function SocketProvider({ children, options }: SocketProviderProps) {
  const {
    isConnected,
    lastUpdate,
    error,
    reconnectAttempts,
    subscribeToAsset,
    unsubscribeFromAsset,
    disconnect,
    reconnect,
  } = useSocket(options)

  // Each slice is independently memoised.  When a price tick arrives only
  // `dataValue` object changes; `connectionValue` and `actionsValue` keep the
  // same reference, so their consumers are skipped by React's reconciler.
  const connectionValue = useMemo<SocketConnectionContextType>(
    () => ({ isConnected, error, reconnectAttempts }),
    [isConnected, error, reconnectAttempts],
  )

  const dataValue = useMemo<SocketDataContextType>(
    () => ({ lastUpdate }),
    [lastUpdate],
  )

  // Action callbacks from `useSocket` already have stable identities (empty
  // dep-array useCallback), so this memo almost never produces a new object.
  const actionsValue = useMemo<SocketActionsContextType>(
    () => ({ subscribeToAsset, unsubscribeFromAsset, disconnect, reconnect }),
    [subscribeToAsset, unsubscribeFromAsset, disconnect, reconnect],
  )

  return (
    <SocketConnectionContext.Provider value={connectionValue}>
      <SocketDataContext.Provider value={dataValue}>
        <SocketActionsContext.Provider value={actionsValue}>
          {children}
        </SocketActionsContext.Provider>
      </SocketDataContext.Provider>
    </SocketConnectionContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Granular consumer hooks
// ---------------------------------------------------------------------------

/**
 * Subscribe only to connection metadata (isConnected / error / attempts).
 * Will NOT re-render on price data ticks.
 */
export function useSocketConnection(): SocketConnectionContextType {
  const ctx = useContext(SocketConnectionContext)
  if (!ctx) {
    throw new Error('useSocketConnection must be used within a SocketProvider')
  }
  return ctx
}

/**
 * Subscribe only to live data updates (`lastUpdate`).
 * Re-renders on every WebSocket message — use `useValidatorMetric` to further
 * narrow the subscription to a single field.
 */
export function useSocketData(): SocketDataContextType {
  const ctx = useContext(SocketDataContext)
  if (!ctx) {
    throw new Error('useSocketData must be used within a SocketProvider')
  }
  return ctx
}

/**
 * Subscribe only to stable action callbacks.
 * Identity is stable for the lifetime of the provider — never triggers a
 * re-render.
 */
export function useSocketActions(): SocketActionsContextType {
  const ctx = useContext(SocketActionsContext)
  if (!ctx) {
    throw new Error('useSocketActions must be used within a SocketProvider')
  }
  return ctx
}

/**
 * @deprecated Use the granular hooks instead:
 *   - `useSocketConnection()` for isConnected / error / reconnectAttempts
 *   - `useSocketData()`       for lastUpdate
 *   - `useSocketActions()`    for subscribeToAsset / unsubscribeFromAsset / disconnect / reconnect
 *
 * This combined hook re-renders on every WebSocket tick because it merges all
 * three slices.  It is kept for backwards compatibility only.
 */
export function useSocketContext() {
  return {
    ...useSocketConnection(),
    ...useSocketData(),
    ...useSocketActions(),
  }
}
