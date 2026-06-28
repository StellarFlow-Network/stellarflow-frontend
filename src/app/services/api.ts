import { getFetchCacheOptions, REVALIDATE_INTERVALS } from '@/config/cacheConfig'

/**
 * API service layer with enforced cache re-validation periods.
 * All endpoints implement minimum 5-second revalidation to prevent backend flooding.
 */
// Centralized In-Flight Request Pool (Deduplication)
// Intercepts parallel requests for the exact same URL and serves them from a single promise
const inFlightRequests = new Map<string, Promise<any>>();

async function pooledFetch(url: string, options?: RequestInit) {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url);
  }

  const requestPromise = (async () => {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
  })();

  inFlightRequests.set(url, requestPromise);

  try {
    return await requestPromise;
  } finally {
    // Clear from pool once resolved so subsequent requests trigger a fresh fetch
    inFlightRequests.delete(url);
  }
}

export const api = {
  /**
   * Fetches current price data with 10-second cache.
   * Prevents excessive requests to price data endpoints during high activity.
   */
  async getPrices() {
    return pooledFetch('/api/prices', getFetchCacheOptions('SHORT_INTERVAL'))
  },

  /**
   * Fetches portfolio data with 30-second cache.
   * Reduces database queries for portfolio aggregations that change infrequently.
   */
  async getPortfolio() {
    return pooledFetch('/api/portfolio', getFetchCacheOptions('MEDIUM_INTERVAL'))
  },
}