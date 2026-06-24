/**
 * Asset Symbol Registry
 *
 * Single source-of-truth for all asset pair identifiers used across the
 * StellarFlow oracle feed.  Declaring them `as const` interns each string at
 * module-load time so every import site receives the **same object reference**
 * rather than an independent copy — eliminating redundant string encodings and
 * reducing lookup comparisons to O(1) reference equality checks, analogous to
 * Soroban `Symbol` primitives on-chain.
 *
 * Usage:
 *   import { ASSET_SYMBOLS, ASSET_SYMBOL_LIST, AssetSymbol } from '@/config/assetSymbols'
 */

// ─── Interned symbol map ───────────────────────────────────────────────────────

export const ASSET_SYMBOLS = {
  NGN_XLM: 'NGN-XLM',
  USD_XLM: 'USD-XLM',
  EUR_XLM: 'EUR-XLM',
} as const;

// ─── Derived types ─────────────────────────────────────────────────────────────

/** Union of all valid asset pair identifiers. */
export type AssetSymbol = (typeof ASSET_SYMBOLS)[keyof typeof ASSET_SYMBOLS];

/** Ordered list for iteration — identical to `Object.values(ASSET_SYMBOLS)` but typed. */
export const ASSET_SYMBOL_LIST = [
  ASSET_SYMBOLS.NGN_XLM,
  ASSET_SYMBOLS.USD_XLM,
  ASSET_SYMBOLS.EUR_XLM,
] as const satisfies readonly AssetSymbol[];

// ─── Per-symbol base prices (used by the price-simulation layer) ───────────────

/**
 * Base prices keyed by interned symbol.  Replaces inline chained ternaries
 * e.g. `assetId === 'NGN-XLM' ? 750 : assetId === 'USD-XLM' ? 0.12 : 0.13`
 * with a single O(1) map lookup.
 */
export const ASSET_BASE_PRICES: Record<AssetSymbol, number> = {
  [ASSET_SYMBOLS.NGN_XLM]: 750,
  [ASSET_SYMBOLS.USD_XLM]: 0.12,
  [ASSET_SYMBOLS.EUR_XLM]: 0.13,
};

/**
 * Decimal precision per asset pair.  Mirrors the decimals field emitted by
 * the oracle contract.
 */
export const ASSET_DECIMALS: Record<AssetSymbol, number> = {
  [ASSET_SYMBOLS.NGN_XLM]: 2,
  [ASSET_SYMBOLS.USD_XLM]: 6,
  [ASSET_SYMBOLS.EUR_XLM]: 6,
};
