import { getFetchCacheOptions, REVALIDATE_INTERVALS } from '@/config/cacheConfig'

/**
 * API service layer with enforced cache re-validation periods.
 * All endpoints implement minimum 5-second revalidation to prevent backend flooding.
 */
export const api = {
  /**
   * Fetches current price data with 10-second cache.
   * Prevents excessive requests to price data endpoints during high activity.
   */
  async getPrices() {
    const res = await fetch('/api/prices', getFetchCacheOptions('SHORT_INTERVAL'))
    if (!res.ok) throw new Error('Failed to fetch prices')
    return res.json()
  },

  /**
   * Fetches portfolio data with 30-second cache.
   * Reduces database queries for portfolio aggregations that change infrequently.
   */
  async getPortfolio() {
    const res = await fetch('/api/portfolio', getFetchCacheOptions('MEDIUM_INTERVAL'))
    if (!res.ok) throw new Error('Failed to fetch portfolio')
    return res.json()
  },
}