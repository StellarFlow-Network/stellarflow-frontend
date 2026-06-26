import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getCachedHistory, getCachedHistorySync, setCachedHistory } from '../lib/historySync';
import { getCacheOptions } from '@/config/cacheConfig';

/**
 * Type representing the validator metric payload returned by the backend.
 * Adjust fields to match the actual API response shape.
 */
export interface ValidatorMetric {
  address: string;
  // Example fields – extend as needed
  price: number;
  confidenceScore: number;
  source: string;
  timestamp: number;
}

/**
 * React Query hook that batches validator address lookups into a single network request.
 * Implements minimum 10-second cache intervals to prevent backend flooding.
 *
 * @param addresses - Array of validator account addresses to fetch.
 * @returns Query result containing an array of {@link ValidatorMetric} objects.
 */
export function useValidatorBatch(
  addresses: string[],
): UseQueryResult<ValidatorMetric[], Error> {
  // Stable query key – addresses array is stringified to ensure proper caching.
  const normalizedAddresses = [...addresses].sort();
  const queryKey = ['validators', normalizedAddresses.join(',')];
  const historyKey = `validators:${normalizedAddresses.join(',')}`;
  const initialData = getCachedHistorySync<ValidatorMetric[]>(historyKey) ?? undefined;

  return useQuery<ValidatorMetric[], Error>({
    queryKey,
    queryFn: async () => {
      if (normalizedAddresses.length === 0) return [];

      const cached = await getCachedHistory<ValidatorMetric[]>(historyKey);
      if (cached && cached.length > 0) {
        return cached;
      }

      const url = `/api/validators?ids=${normalizedAddresses.map(encodeURIComponent).join(',')}`;
  // Use SHORT_INTERVAL (10s) to prevent excessive validator metric lookups
  // while keeping data reasonably fresh for status monitoring.
  const cacheConfig = getCacheOptions('SHORT_INTERVAL');

  return useQuery<ValidatorMetric[], Error>({
    queryKey,
    queryFn: async () => {
      if (addresses.length === 0) return [];
      const url = `/api/validators?ids=${addresses.map(encodeURIComponent).join(',')}`;
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch validator metrics: ${res.status}`);
      }
      const data: ValidatorMetric[] = await res.json();
      await setCachedHistory(historyKey, data);
      return data;
    },
    initialData,
    // Do not refetch on window focus to keep data stable during rapid UI interactions.
    refetchOnWindowFocus: false,
    // Keep previous data while loading new batched results.
    keepPreviousData: true,
    // Stale time can be tuned; using 30 seconds as a sensible default.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
  });
}
