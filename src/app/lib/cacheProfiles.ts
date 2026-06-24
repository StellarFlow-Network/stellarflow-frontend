export const cacheProfiles = {
  corridorMetrics: {
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  },

  validatorAudit: {
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  },
} as const;

export type CacheProfile = keyof typeof cacheProfiles;

export function getCacheProfile(name: CacheProfile) {
  return cacheProfiles[name];
}
