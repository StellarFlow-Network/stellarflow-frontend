/**
 * Precomputed className variants to avoid repeated string composition in loops.
 * This eliminates template literal parsing and conditional evaluation on each render.
 */

// --- Consumer Tier Variants ---
export const CONSUMER_TIER_VARIANTS = {
  Enterprise: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  Developer: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  Staging: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
} as const;

export const CONSUMER_TIER_BADGE_CLASS = 'px-2 py-0.5 rounded text-xs font-semibold';

// --- Consumer Status Variants ---
export const CONSUMER_STATUS_TEXT_VARIANTS = {
  active: 'text-green-400',
  expired: 'text-red-400',
  paused: 'text-yellow-500',
} as const;

export const CONSUMER_STATUS_DOT_VARIANTS = {
  active: 'bg-green-400',
  expired: 'bg-red-400',
  paused: 'bg-yellow-500',
} as const;

// --- Staker Health Factor Variants ---
export const STAKER_HEALTH_BAR_VARIANTS = {
  healthy: 'bg-emerald-500', // > 85%
  warning: 'bg-yellow-500',   // 70-85%
  critical: 'bg-red-500',     // < 70%
} as const;

export const getHealthBarColor = (healthFactor: number): string => {
  if (healthFactor > 85) return STAKER_HEALTH_BAR_VARIANTS.healthy;
  if (healthFactor > 70) return STAKER_HEALTH_BAR_VARIANTS.warning;
  return STAKER_HEALTH_BAR_VARIANTS.critical;
};

// --- Staker Slashing Variants ---
export const STAKER_SLASHING_NO_EVENTS = 'bg-gray-800 text-gray-400';
export const STAKER_SLASHING_WITH_EVENTS = 'bg-red-500/10 text-red-400 border border-red-500/10';

// --- Relayer Status Variants (RelayerStatusTable component) ---
export const RELAYER_STATUS_BADGE_VARIANTS = {
  Online: 'bg-[#39FF14]/10 text-[#39FF14]',
  Offline: 'bg-red-500/10 text-red-400',
  Syncing: 'bg-yellow-500/10 text-yellow-400',
} as const;

export const RELAYER_STATUS_DOT_VARIANTS = {
  Online: 'bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.6)]',
  Offline: 'bg-red-400',
  Syncing: 'bg-yellow-400',
} as const;

// --- Relayer Status Variants (Relayers page inline table) ---
export const RELAYERS_PAGE_STATUS_VARIANTS = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  lagging: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  offline: 'bg-red-500/10 text-red-500 border-red-500/20',
} as const;

// --- Contract Health Status Variants ---
export const CONTRACT_HEALTH_ICON_VARIANTS = {
  safe: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
} as const;

// --- Consumer Balance Alert ---
export const getBalanceColorClass = (balanceXLM: number): string => {
  return balanceXLM < 200 ? 'text-yellow-500 font-bold' : 'text-gray-300';
};
