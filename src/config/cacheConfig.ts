/**
 * Centralized cache configuration following realistic data-shift intervals.
 * All cache retention periods enforce minimum 5000ms (5 second) thresholds
 * to prevent backend flooding with redundant data updates.
 */

/**
 * Cache configuration for dynamic data with different freshness requirements.
 * All intervals are in milliseconds with minimum 5000ms enforcement.
 */
export const CACHE_INTERVALS = {
  /**
   * Real-time or near-real-time data (prices, status updates, metrics).
   * Minimum 5 seconds to prevent excessive requests to volatile data endpoints.
   */
  REAL_TIME: {
    staleTime: 5_000,        // Data considered fresh for 5 seconds
    gcTime: 30 * 60 * 1000,  // Cache persists for 30 minutes
  },

  /**
   * Short-interval data (prices, order books, validator status).
   * Suitable for frequently updated data that changes every 10-15 seconds.
   */
  SHORT_INTERVAL: {
    staleTime: 10_000,       // Data considered fresh for 10 seconds
    gcTime: 30 * 60 * 1000,  // Cache persists for 30 minutes
  },

  /**
   * Medium-interval data (corridor metrics, audit logs, performance data).
   * Suitable for data that updates every 30-60 seconds.
   */
  MEDIUM_INTERVAL: {
    staleTime: 30_000,       // Data considered fresh for 30 seconds
    gcTime: 60 * 60 * 1000,  // Cache persists for 1 hour
  },

  /**
   * Long-interval data (static configurations, governance proposals, contracts).
   * Suitable for data that rarely changes or updates infrequently.
   */
  LONG_INTERVAL: {
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // Cache persists for 24 hours
  },

  /**
   * Static data (network definitions, asset symbols, reference data).
   * Suitable for data that changes very rarely or only on deployment.
   */
  STATIC: {
    staleTime: 60 * 60 * 1000, // Data considered fresh for 1 hour
    gcTime: 7 * 24 * 60 * 60 * 1000, // Cache persists for 7 days
  },
} as const;

/**
 * Next.js fetch revalidation intervals (seconds) for server-side data.
 * Enforces minimum 5-second thresholds for ISR (Incremental Static Regeneration).
 */
export const REVALIDATE_INTERVALS = {
  REAL_TIME: 5,           // Revalidate every 5 seconds
  SHORT_INTERVAL: 10,     // Revalidate every 10 seconds
  MEDIUM_INTERVAL: 30,    // Revalidate every 30 seconds
  LONG_INTERVAL: 300,     // Revalidate every 5 minutes
  STATIC: 3600,           // Revalidate every 1 hour
} as const;

/**
 * Polling intervals (milliseconds) for fallback data refresh when WebSocket is unavailable.
 * All intervals respect inactive user state with 5x multiplier.
 */
export const POLLING_INTERVALS = {
  REAL_TIME: 5_000,       // Poll every 5 seconds (25s when inactive)
  SHORT_INTERVAL: 10_000, // Poll every 10 seconds (50s when inactive)
  MEDIUM_INTERVAL: 30_000, // Poll every 30 seconds (150s when inactive)
  LONG_INTERVAL: 60_000,  // Poll every 60 seconds (300s when inactive)
} as const;

/**
 * Inactivity delay configuration for reducing request frequency when user is idle.
 * Keeps the application responsive while conserving backend resources.
 */
export const INACTIVITY_CONFIG = {
  threshold: 3 * 60 * 1000,  // 3 minutes of user inactivity
  activeMultiplier: 1,       // Normal speed when user is active
  inactiveMultiplier: 5,     // 5x slower polling when user is inactive
} as const;

/**
 * Get Next.js fetch cache options for a given interval type.
 *
 * @param intervalType - One of the REVALIDATE_INTERVALS keys
 * @returns Next.js fetch cache configuration object
 *
 * @example
 * const response = await fetch(url, getFetchCacheOptions('MEDIUM_INTERVAL'));
 */
export function getFetchCacheOptions(
  intervalType: keyof typeof REVALIDATE_INTERVALS = 'MEDIUM_INTERVAL',
) {
  return {
    next: {
      revalidate: REVALIDATE_INTERVALS[intervalType],
    },
  };
}

/**
 * Get React Query cache options for client-side data fetching.
 *
 * @param intervalType - One of the CACHE_INTERVALS keys
 * @returns React Query defaultOptions configuration object
 *
 * @example
 * const { staleTime, gcTime } = getCacheOptions('SHORT_INTERVAL');
 * useQuery({ queryKey: [...], queryFn: ..., staleTime, gcTime })
 */
export function getCacheOptions(
  intervalType: keyof typeof CACHE_INTERVALS = 'MEDIUM_INTERVAL',
) {
  return CACHE_INTERVALS[intervalType];
}

/**
 * Get polling interval adjusted for user inactivity state.
 *
 * @param baseInterval - Base polling interval in milliseconds
 * @param isInactive - Whether user is currently inactive
 * @returns Adjusted polling interval in milliseconds
 *
 * @example
 * const effectiveInterval = getAdjustedPollingInterval(
 *   POLLING_INTERVALS.SHORT_INTERVAL,
 *   userIsInactive
 * );
 */
export function getAdjustedPollingInterval(
  baseInterval: number,
  isInactive: boolean,
): number {
  const multiplier = isInactive
    ? INACTIVITY_CONFIG.inactiveMultiplier
    : INACTIVITY_CONFIG.activeMultiplier;
  return baseInterval * multiplier;
}
