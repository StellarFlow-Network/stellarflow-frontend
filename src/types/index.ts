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

/** Single price/size level in an order book side. `total` is the cumulative
 * size from the top of the book through this level (depth-chart friendly). */
export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
}

/** Live order book snapshot for one asset pair, pushed over the price WebSocket feed. */
export interface OrderBookSnapshot {
  assetPair: AssetSymbol;
  /** Highest-to-lowest priced buy levels. */
  bids: OrderBookLevel[];
  /** Lowest-to-highest priced sell levels. */
  asks: OrderBookLevel[];
  timestamp: number; // Unix timestamp
}
