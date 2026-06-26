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
} as const;

export type CacheProfile = keyof typeof cacheProfiles;

export function getCacheProfile(name: CacheProfile) {
  return cacheProfiles[name];
}
