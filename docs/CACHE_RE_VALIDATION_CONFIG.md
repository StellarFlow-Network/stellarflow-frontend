# Dynamic Cache Re-validation Configuration

## Overview

This document describes the cache re-validation strategy implemented to prevent backend flooding with redundant data updates. All cache intervals enforce **minimum 5000ms (5 second) thresholds** to ensure realistic data-shift intervals while reducing request frequencies across static data pathways.

## Cache Strategy Architecture

### 1. Centralized Configuration (`src/config/cacheConfig.ts`)

All cache settings are now centralized in a single configuration file with five cache interval profiles:

| Profile | Stale Time | GC Time | Use Cases |
|---------|-----------|---------|-----------|
| **REAL_TIME** | 5s | 30m | Live prices, status updates (minimum threshold) |
| **SHORT_INTERVAL** | 10s | 30m | Frequently updated data (validator metrics, order books) |
| **MEDIUM_INTERVAL** | 30s | 1h | Corridor metrics, audit logs, performance data |
| **LONG_INTERVAL** | 5m | 24h | Governance proposals, configuration changes |
| **STATIC** | 1h | 7d | Network definitions, asset symbols, reference data |

### 2. Polling Intervals

Default polling intervals are enforced with automatic 5x multiplier for inactive users:

| Interval | Active User | Inactive User |
|----------|------------|---------------|
| REAL_TIME | 5s | 25s |
| SHORT_INTERVAL | 10s | 50s |
| MEDIUM_INTERVAL | 30s | 150s |
| LONG_INTERVAL | 60s | 300s |

**Inactivity Threshold**: 3 minutes of no user interaction (mouse/keyboard/scroll).

### 3. Next.js Fetch Cache Headers

All server-side fetch calls now include ISR revalidation tags corresponding to interval types:

```typescript
// 10-second revalidation (SHORT_INTERVAL)
await fetch(url, getFetchCacheOptions('SHORT_INTERVAL'))

// 30-second revalidation (MEDIUM_INTERVAL)
await fetch(url, getFetchCacheOptions('MEDIUM_INTERVAL'))
```

## Usage Guide

### React Query Hooks

Use cache configuration in custom React Query hooks:

```typescript
import { getCacheOptions } from '@/config/cacheConfig';

export function useMyData() {
  const cacheConfig = getCacheOptions('MEDIUM_INTERVAL');
  
  return useQuery({
    queryKey: ['my-data'],
    queryFn: async () => { /* ... */ },
    staleTime: cacheConfig.staleTime,    // 30 seconds
    gcTime: cacheConfig.gcTime,          // 1 hour
  });
}
```

### Server-Side Fetch Calls

Apply revalidation intervals to all fetch operations:

```typescript
import { getFetchCacheOptions } from '@/config/cacheConfig';

async function getMetrics() {
  return fetch('/api/metrics', 
    getFetchCacheOptions('SHORT_INTERVAL')  // 10-second revalidation
  );
}
```

### Polling Components

Use centralized polling intervals with automatic inactivity scaling:

```typescript
import { POLLING_INTERVALS, INACTIVITY_CONFIG } from '@/config/cacheConfig';

const { delayMultiplier } = useInactivityDelay({
  inactivityThreshold: INACTIVITY_CONFIG.threshold,
  inactiveMultiplier: INACTIVITY_CONFIG.inactiveMultiplier,
});

const effectiveInterval = POLLING_INTERVALS.MEDIUM_INTERVAL * delayMultiplier;
useRAFInterval(fetchData, effectiveInterval, enabled);
```

## Implementation Details

### Files Modified

1. **`src/config/cacheConfig.ts`** (NEW)
   - Centralized cache configuration with all intervals and profiles

2. **`src/app/lib/queryClient.ts`**
   - Updated to use `SHORT_INTERVAL` defaults (10s staleTime)
   - Maintains 30-minute cache persistence

3. **`src/app/lib/cacheProfiles.ts`**
   - Now derives from `cacheConfig.ts` for consistency
   - Supports scaling to new data types as needed

4. **`src/app/services/api.ts`**
   - Added `getFetchCacheOptions()` to all fetch calls
   - `getPrices()`: SHORT_INTERVAL (10s)
   - `getPortfolio()`: MEDIUM_INTERVAL (30s)

5. **`src/lib/api/proposals.ts`**
   - Updated to use centralized config
   - Maintains 60-second revalidation

6. **`src/app/components/PriceFeedCard.tsx`**
   - Updated to use `POLLING_INTERVALS.MEDIUM_INTERVAL` (30s)
   - Uses centralized `INACTIVITY_CONFIG` for consistency
   - Automatic 5x backoff when user inactive

7. **`src/app/hooks/useValidatorBatch.ts`**
   - Updated to use `getCacheOptions()` for dynamic configuration
   - Uses SHORT_INTERVAL (10s) for validator metrics

## Backend Impact

### Expected Improvements

1. **Reduced Request Volume**: 50-75% reduction in redundant API calls
   - Minimum 5-second stale time prevents request storms
   - Automatic 5x backoff for inactive users
   - Smart polling intervals based on data freshness requirements

2. **Lower Database Load**:
   - Short-interval data cached for 10-30 seconds
   - Medium-interval data cached for 30 seconds to 5 minutes
   - Batch queries for multiple validators in single request

3. **Improved User Experience**:
   - Data still updates every 5-30 seconds (user-visible)
   - WebSocket connections preferred for real-time updates
   - Graceful fallback to polling with extended intervals

### Monitoring Recommendations

Monitor these metrics to validate improvements:

- **API Request Count**: Should decrease by 50-75%
- **Average Response Time**: Should stabilize as load decreases
- **Cache Hit Rate**: Track via server-side logs
- **User-Perceived Latency**: Monitor via RUM (Real User Monitoring)

## Migration Guide

### For Existing Hooks

If you have existing hooks with hardcoded cache times:

```typescript
// Before
return useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 15_000,  // ❌ Magic number
  gcTime: 5 * 60 * 1000,
});

// After
const cacheConfig = getCacheOptions('MEDIUM_INTERVAL');
return useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: cacheConfig.staleTime,  // ✅ Centralized
  gcTime: cacheConfig.gcTime,
});
```

### For New Fetch Operations

Always include cache headers:

```typescript
// Always add cache options to fetch calls
const res = await fetch('/api/data', 
  getFetchCacheOptions('MEDIUM_INTERVAL')
);
```

## Configuration Adjustment Guide

### Increasing Cache Time for Specific Data

If a data type is changing too infrequently and causing unnecessary revalidations:

```typescript
// In cacheProfiles.ts
export const cacheProfiles = {
  mySlowData: getCacheOptions('LONG_INTERVAL'),  // 5 minutes
} as const;
```

### Custom Intervals

For data with unique requirements:

```typescript
const cacheConfig = getCacheOptions('MEDIUM_INTERVAL');
const customCache = {
  staleTime: Math.max(cacheConfig.staleTime, 45_000),  // Min 45s
  gcTime: 2 * 60 * 60 * 1000,  // 2 hours
};
```

**Important**: Never set `staleTime` below 5000ms to prevent request flooding.

## Troubleshooting

### Data Updates Feel Too Slow

- Check which cache profile is being used
- Reduce `staleTime` to the next shorter interval (but not below 5s)
- Verify WebSocket connection is active for real-time data

### Still Seeing Request Spikes

- Check if `useInactivityDelay` multiplier is applied
- Verify polling intervals are using `POLLING_INTERVALS` constants
- Review component's `refetchOnWindowFocus` setting

### Browser Cache Not Clearing

- Clear service worker cache: Chrome DevTools → Application → Cache Storage
- Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on macOS)
- Check if PWA `runtimeCaching` rules override ISR settings

## References

- [Next.js ISR Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [React Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Service Worker Caching Strategies](https://developers.google.com/web/tools/workbox/modules/workbox-strategies)
