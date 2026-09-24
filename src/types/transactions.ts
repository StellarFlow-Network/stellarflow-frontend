/**
 * Shared transaction history types for swaps, liquidity provision, and
 * remittance settlements — the three activity kinds surfaced in the user's
 * transaction history table and exported for tax/accounting purposes.
 */

export type TransactionType = "swap" | "liquidity" | "remittance";

export type TransactionStatus = "completed" | "pending" | "failed";

export interface TransactionRecord {
  id: string;
  /** ISO-8601 timestamp, e.g. "2026-06-12T14:03:22Z". */
  date: string;
  type: TransactionType;
  sentAmount: number;
  sentCurrency: string;
  receivedAmount: number;
  receivedCurrency: string;
  fee: number;
  feeCurrency: string;
  txHash: string;
  status: TransactionStatus;
}
