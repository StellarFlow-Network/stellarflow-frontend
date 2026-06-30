import { getFetchCacheOptions, REVALIDATE_INTERVALS } from '@/config/cacheConfig'

/**
 * API service layer with enforced cache re-validation periods.
 * All endpoints implement minimum 5-second revalidation to prevent backend flooding.
 */
// Centralized In-Flight Request Pool (Deduplication)
// Intercepts parallel requests for the exact same URL and serves them from a single promise
// Centralized In-Flight Request Pool (Deduplication)
const inFlightRequests = new Map<string, Promise<unknown>>();

async function pooledFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)! as Promise<T>;
  }

  const requestPromise = (async () => {
    const res = await fetch(url, options);

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    return (await res.json()) as T;
  })();

  inFlightRequests.set(url, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(url);
  }
}
export const api = {
  /**
   * Fetches current price data with 10-second cache.
   * Prevents excessive requests to price data endpoints during high activity.
   */
  async getPrices(): Promise<unknown> {
    return pooledFetch('/api/prices', getFetchCacheOptions('SHORT_INTERVAL'))
  },

  /**
   * Fetches portfolio data with 30-second cache.
   * Reduces database queries for portfolio aggregations that change infrequently.
   */
  async getPortfolio():Promise<unknown> {
    return pooledFetch('/api/portfolio', getFetchCacheOptions('MEDIUM_INTERVAL'))
  },
}