'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useMasterRAFTimer } from '@/app/providers/MasterRAFTimerProvider'

/**
 * Drop-in replacement for useRAFInterval backed by the global master RAF loop.
 * 
 * Instead of creating separate requestAnimationFrame loops per component,
 * this hook registers with the shared master RAF timer provider, consolidating
 * all interval-based timers into a single efficient loop.
 * 
 * Benefits:
 * - No RAF loop proliferation (prevents resource waste)
 * - Coordinated timing across all countdowns
 * - Enables() / disables without unmounting
 * 
 * @param callback - Stable function to invoke on each interval tick.
 * @param intervalMs - Desired interval in milliseconds (default 1000).
 * @param enabled - Set to false to pause without unmounting (default true).
 * 
 * @example
 * // Countdown proposals across single RAF tick
 * useSharedRAFInterval(() => setCount(c => c - 1), 5000)
 */
export function useSharedRAFInterval(
  callback: () => void,
  intervalMs = 1000,
  enabled = true
): void {
  const master = useMasterRAFTimer()
  const idRef = useRef<symbol | null>(null)
  const callbackRef = useRef(callback)

  // Keep callback ref current
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    idRef.current = master.subscribe(
      () => callbackRef.current(),
      intervalMs
    )

    return () => {
      if (idRef.current !== null) {
        master.unsubscribe(idRef.current)
      }
    }
  }, [intervalMs, master])

  // Enable/disable without unmounting
  useEffect(() => {
    if (idRef.current !== null) {
      master.setEnabled(idRef.current, enabled)
    }
  }, [enabled, master])
}
