import { QueryClient } from '@tanstack/react-query'
import { getCacheOptions } from '@/config/cacheConfig'

// Use SHORT_INTERVAL as default to balance freshness with request reduction.
// This enforces a minimum 10-second cache to prevent backend flooding.
const defaultCacheConfig = getCacheOptions('SHORT_INTERVAL')

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: defaultCacheConfig.staleTime,
      gcTime: defaultCacheConfig.gcTime,
      refetchOnWindowFocus: false,   // Prevent refetch on window focus
      refetchOnReconnect: true,      // Refetch when reconnecting after network loss
      retry: 2,
    },
  },
})