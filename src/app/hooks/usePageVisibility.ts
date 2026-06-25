'use client'

import { useSyncExternalStore } from 'react'

/**
 * A centralized hook that returns the current visibility status of the page.
 * Returns `true` if the page is visible, `false` otherwise.
 * 
 * Uses `useSyncExternalStore` for efficient updates and SSR compatibility.
 */
export function usePageVisibility(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof document === 'undefined') return () => {}

      document.addEventListener('visibilitychange', onStoreChange)
      return () => {
        document.removeEventListener('visibilitychange', onStoreChange)
      }
    },
    () => (typeof document !== 'undefined' ? document.visibilityState === 'visible' : true),
    () => true, // Server-side default
  )
}
