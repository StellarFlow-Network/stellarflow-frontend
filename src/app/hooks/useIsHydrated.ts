'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that returns true only after the component has hydrated on the client.
 * Use this to delay rendering of time/date values or locale-dependent content
 * until the client has fully mounted.
 * 
 * This prevents hydration mismatches caused by:
 * - Locale-dependent formatting (toLocaleDateString, toLocaleTimeString, etc.)
 * - Time-based calculations that differ between server and client
 * - Regional timezone conversions
 * 
 * @example
 * ```tsx
 * const isHydrated = useIsHydrated();
 * 
 * return (
 *   <div>
 *     {isHydrated ? (
 *       new Date(timestamp).toLocaleDateString()
 *     ) : (
 *       'Loading...'
 *     )}
 *   </div>
 * );
 * ```
 */
export function useIsHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
