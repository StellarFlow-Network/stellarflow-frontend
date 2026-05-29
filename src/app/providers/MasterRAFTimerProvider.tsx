'use client'

import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react'

/**
 * MasterRAFTimerProvider — Shared requestAnimationFrame Loop
 * 
 * Consolidates all interval-based timers under a single RAF loop to reduce
 * system resource overhead. Subscribers register callbacks with desired intervals,
 * and the master loop distributes ticks efficiently across all consumers.
 * 
 * Benefits:
 * - Single RAF loop instead of N separate loops (one per component)
 * - Coordinated timing prevents timer drift across proposals, price feeds, etc.
 * - Minimal CPU overhead: one rAF + timer comparisons vs. N rAF callbacks
 * 
 * Usage:
 * - Wrap app in <MasterRAFTimerProvider>
 * - Use useSharedRAFInterval() instead of useRAFInterval()
 */

interface TimerSubscription {
  id: symbol
  callback: () => void
  intervalMs: number
  lastTickTime: number | null
  enabled: boolean
}

interface MasterRAFContextValue {
  subscribe: (callback: () => void, intervalMs: number) => symbol
  unsubscribe: (id: symbol) => void
  setEnabled: (id: symbol, enabled: boolean) => void
}

const MasterRAFContext = createContext<MasterRAFContextValue | null>(null)

export function useMasterRAFTimer() {
  const context = useContext(MasterRAFContext)
  if (!context) {
    throw new Error(
      'useMasterRAFTimer must be used within <MasterRAFTimerProvider>'
    )
  }
  return context
}

export function MasterRAFTimerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const subscriptionsRef = useRef<Map<symbol, TimerSubscription>>(new Map())
  const rafIdRef = useRef<number | null>(null)

  const subscribe = useCallback(
    (callback: () => void, intervalMs: number): symbol => {
      const id = Symbol('timer-subscription')
      subscriptionsRef.current.set(id, {
        id,
        callback,
        intervalMs,
        lastTickTime: null,
        enabled: true,
      })
      return id
    },
    []
  )

  const unsubscribe = useCallback((id: symbol) => {
    subscriptionsRef.current.delete(id)
  }, [])

  const setEnabled = useCallback((id: symbol, enabled: boolean) => {
    const subscription = subscriptionsRef.current.get(id)
    if (subscription) {
      subscription.enabled = enabled
    }
  }, [])

  const tick = useCallback((now: number) => {
    const subscriptions = subscriptionsRef.current
    for (const subscription of subscriptions.values()) {
      if (!subscription.enabled) continue

      if (subscription.lastTickTime === null) {
        subscription.lastTickTime = now
      }

      if (now - subscription.lastTickTime >= subscription.intervalMs) {
        subscription.lastTickTime = now
        subscription.callback()
      }
    }

    // Continue the RAF loop
    rafIdRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    // Start the master RAF loop
    rafIdRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [tick])

  const value: MasterRAFContextValue = {
    subscribe,
    unsubscribe,
    setEnabled,
  }

  return (
    <MasterRAFContext.Provider value={value}>
      {children}
    </MasterRAFContext.Provider>
  )
}
