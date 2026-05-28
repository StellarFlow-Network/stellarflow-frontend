'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface UseErrorTimeoutOptions {
  /**
   * Timeout in milliseconds before automatically clearing the error.
   * Set to 0 to disable auto-clear (error must be manually cleared).
   * @default 5000
   */
  timeoutMs?: number
}

export interface UseErrorTimeoutReturn {
  error: string | null
  setError: (error: string | null) => void
  clearError: () => void
}

/**
 * Hook for managing error state with automatic timeout clearing.
 *
 * This prevents stale error states from lingering in the application and causing
 * unnecessary fallback checks or misleading error displays.
 *
 * @example
 * const { error, setError } = useErrorTimeout({ timeoutMs: 5000 })
 *
 * try {
 *   await fetchData()
 * } catch (err) {
 *   setError('Failed to fetch')  // Auto-clears after 5 seconds
 * }
 */
export function useErrorTimeout({
  timeoutMs = 5000,
}: UseErrorTimeoutOptions = {}): UseErrorTimeoutReturn {
  const [error, setErrorState] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store timeoutMs in ref so it's always accessible in callbacks
  const timeoutMsRef = useRef(timeoutMs)
  useEffect(() => {
    timeoutMsRef.current = timeoutMs
  }, [timeoutMs])

  // Clear any pending timeout (used internally)
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Set error and schedule auto-clear
  const setError = useCallback(
    (newError: string | null) => {
      clearPendingTimeout()

      if (newError === null) {
        setErrorState(null)
        return
      }

      setErrorState(newError)

      // Only schedule auto-clear if timeoutMs > 0
      if (timeoutMsRef.current > 0) {
        timeoutRef.current = setTimeout(() => {
          setErrorState(null)
          timeoutRef.current = null
        }, timeoutMsRef.current)
      }
    },
    [clearPendingTimeout],
  )

  // Explicit clear function
  const clearError = useCallback(() => {
    clearPendingTimeout()
    setErrorState(null)
  }, [clearPendingTimeout])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout()
    }
  }, [clearPendingTimeout])

  return { error, setError, clearError }
}
