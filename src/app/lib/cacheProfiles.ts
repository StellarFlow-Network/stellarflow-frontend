import { getCacheOptions } from '@/config/cacheConfig'

/**
 * Predefined cache profiles for different data freshness requirements.
 * All profiles enforce minimum 5000ms staleTime to prevent backend flooding.
 */
export const cacheProfiles = {
  // Frequently updated metrics that should stay fresh but not cause excessive requests
  corridorMetrics: getCacheOptions('MEDIUM_INTERVAL'),

  // Periodic audit checks that don't need constant updates
  validatorAudit: getCacheOptions('MEDIUM_INTERVAL'),

  // Settlement history for swaps/liquidity/remittances — changes on user
  // action rather than a timer, so a medium staleness window is sufficient.
  transactionHistory: getCacheOptions('MEDIUM_INTERVAL'),

  // Aggregate wallet/LP/vault balances backing the portfolio dashboard.
  portfolioSummary: getCacheOptions('MEDIUM_INTERVAL'),
} as const;

export type CacheProfile = keyof typeof cacheProfiles;

export function getCacheProfile(name: CacheProfile) {
  return cacheProfiles[name];
}
