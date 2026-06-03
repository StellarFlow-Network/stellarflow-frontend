import { useQuery, UseQueryResult } from '@tanstack/react-query';

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
 *
 * @param addresses - Array of validator account addresses to fetch.
 * @returns Query result containing an array of {@link ValidatorMetric} objects.
 */
export function useValidatorBatch(
  addresses: string[],
): UseQueryResult<ValidatorMetric[], Error> {
  // Stable query key – addresses array is stringified to ensure proper caching.
  const queryKey = ['validators', addresses.sort().join(',')];

  return useQuery<ValidatorMetric[], Error>(
    queryKey,
    async () => {
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
      return data;
    },
    {
      // Do not refetch on window focus to keep data stable during rapid UI interactions.
      refetchOnWindowFocus: false,
      // Keep previous data while loading new batched results.
      keepPreviousData: true,
      // Stale time can be tuned; using 30 seconds as a sensible default.
      staleTime: 30_000,
    },
  );
}
