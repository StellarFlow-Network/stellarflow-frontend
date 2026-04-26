/**
 * Global TypeScript Interfaces for StellarFlow
 */

export interface Relayer {
  readonly id: string;
  readonly address: string;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  lastHeartbeat: string; // ISO 8601 string
  region?: string;
}

export interface Contract {
  readonly id: string;
  readonly address: string;
  label: string;
  type: 'oracle' | 'anchor' | 'market';
  version: string;
  wasmHash: string;
  deployedAt: string; // ISO 8601 string
  metadata: unknown; // Using unknown as per guardrail (no 'any')
}

export interface PriceData {
  readonly id: string;
  assetPair: string; // e.g., "NGN/XLM"
  price: number;
  decimals: number;
  source: string;
  timestamp: number; // Unix timestamp
  confidenceScore: number;
  metadata?: unknown; // Using unknown as per guardrail (no 'any')
}

export type TransactionStatus = 'success' | 'failed' | 'pending';

export interface StellarTransactionEvent {
  readonly id: string;
  readonly hash: string;
  readonly ledger: number;
  readonly timestamp: string; // ISO 8601 string
  readonly sourceAccount: string;
  readonly contractAddress: string;
  readonly functionName: string;
  readonly status: TransactionStatus;
  readonly gasUsed: number;
  readonly memo?: string;
}
