/**
 * Global TypeScript Interfaces for StellarFlow
 */

import type { AssetSymbol } from '@/config/assetSymbols'

export interface Relayer {
  readonly id: string;
  readonly address: string;
  readonly shortenedAddress?: string; // Pre-computed via data transformation
  name: string;
  status: 'active' | 'inactive' | 'pending';
  lastHeartbeat: string; // ISO 8601 string
  region?: string;
}

export interface Contract {
  readonly id: string;
  readonly address: string;
  readonly shortenedAddress?: string; // Pre-computed via data transformation
  label: string;
  type: 'oracle' | 'anchor' | 'market';
  version: string;
  wasmHash: string;
  deployedAt: string; // ISO 8601 string
  metadata: unknown; // Using unknown as per guardrail (no 'any')
}

export interface PriceData {
  readonly id: string;
  /** Interned asset pair symbol, e.g. "NGN-XLM". Use AssetSymbol constants for comparisons. */
  assetPair: AssetSymbol;
  price: number;
  decimals: number;
  source: string;
  timestamp: number; // Unix timestamp
  confidenceScore: number;
  metadata?: unknown; // Using unknown as per guardrail (no 'any')
}
