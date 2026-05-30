'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Drop-in replacement for setInterval backed by a single requestAnimationFrame loop.
 *
 * All active consumers share one rAF tick; the callback fires only when the
 * elapsed wall-clock time exceeds `intervalMs`, keeping CPU usage minimal and
 * avoiding timer drift across governance ballot countdowns.
 *
 * @param callback - Stable function to invoke on each interval tick.
 * @param intervalMs - Desired interval in milliseconds (default 1000).
 * @param enabled - Set to false to pause without unmounting (default true).
 *
 * @example
 * useRAFInterval(() => setCount(c => c - 1), 1000)
 */
export function useRAFInterval(
  callback: () => void,
  intervalMs = 1000,
  enabled = true,
): void {
  const callbackRef = useRef(callback)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // Keep callback ref current without restarting the loop
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const tick = useCallback(
    (now: number) => {
      // If we unmounted, stop scheduling and stop execution
      if (!isMountedRef.current) return

      if (lastTickRef.current === null) lastTickRef.current = now

      if (now - lastTickRef.current >= intervalMs) {
        lastTickRef.current = now
        callbackRef.current()
      }

      // Re-verify mount state before next schedule in case callback caused unmount
      if (isMountedRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [intervalMs],
  )

  useEffect(() => {
    isMountedRef.current = true
    if (!enabled) return

    lastTickRef.current = null
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      isMountedRef.current = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [enabled, tick])
}
