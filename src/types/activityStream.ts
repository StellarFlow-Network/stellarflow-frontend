/**
 * Activity Stream Type Definitions (Issue #1205)
 *
 * Provides normalized domain models, status encodings, and pagination contracts
 * for the multi-wallet transaction activity feed.
 */

/** Supported transaction activity categories */
export type ActivityTransactionType =
  | "swap"
  | "deposit"
  | "borrow"
  | "remittance"
  | "bridge";

/** Supported transaction execution states on the Stellar ledger */
export type ActivityTransactionStatus = "completed" | "pending" | "failed";

/**
 * Normalized transaction record displayed in the unified multi-wallet stream.
 */
export interface StreamTransaction {
  /** Unique transaction or event identifier */
  id: string;
  /** Stellar transaction hash (64 hex characters) */
  txHash: string;
  /** Public key of the wallet account that owns or executed this transaction */
  walletAddress: string;
  /** Optional human-friendly label for the wallet (e.g., 'Main Vault', 'Treasury') */
  walletLabel?: string;
  /** Unix epoch timestamp in milliseconds for O(1) sorting and comparisons */
  timestamp: number;
  /** ISO-8601 representation of the timestamp for formatting */
  date: string;
  /** Transaction category */
  type: ActivityTransactionType;
  /** Lifecycle status */
  status: ActivityTransactionStatus;
  /** Outgoing / primary amount */
  primaryAmount: number | string;
  /** Primary asset symbol or code (e.g., 'XLM', 'USDC', 'NGN') */
  primaryAsset: string;
  /** Incoming / secondary amount (for swaps, remittances, or loan collateral) */
  secondaryAmount?: number | string;
  /** Secondary asset symbol or code */
  secondaryAsset?: string;
  /** Network transaction fee charged */
  fee?: number | string;
  /** Asset fee was paid in (usually XLM) */
  feeAsset?: string;
  /** Optional transaction memo */
  memo?: string;
  /** Target counterparty, anchor or contract ID */
  counterparty?: string;
}

/**
 * Paginated response structure for infinite scrolling queries.
 */
export interface PaginatedActivityResponse {
  /** Array of transactions for the requested page */
  transactions: StreamTransaction[];
  /** Next page identifier or null if no further pages exist */
  nextPage: number | null;
  /** Boolean flag indicating if more records are available */
  hasMore: boolean;
  /** Optional total count of matching transactions */
  totalCount?: number;
}

/**
 * Filter configuration for the multi-wallet stream.
 */
export type ActivityTypeFilter = "all" | ActivityTransactionType;

/**
 * Account descriptor accepted by MultiWalletActivityStream.
 */
export interface ConnectedAccountDescriptor {
  publicKey: string;
  label?: string;
}

/**
 * Props for the MultiWalletActivityStream component.
 */
export interface MultiWalletActivityStreamProps {
  /**
   * Connected wallet accounts to aggregate transactions across.
   * Accepts objects with publicKey/label or plain public key strings.
   * If omitted or empty, falls back to demo multi-wallet accounts.
   */
  accounts?: Array<ConnectedAccountDescriptor | string>;
  /** Number of transactions loaded per pagination batch (default: 10) */
  pageSize?: number;
  /** Poll a supplied fetchPage data source for new activity (default: 30 seconds). Set to 0 to disable. */
  refreshIntervalMs?: number;
  /** Initial transaction category filter */
  initialTypeFilter?: ActivityTypeFilter;
  /** Initial wallet account filter (publicKey or 'all') */
  initialAccountFilter?: string;
  /** Optional custom data fetcher for tests or backend overriding */
  fetchPage?: (
    page: number,
    pageSize: number,
    accounts: string[],
    typeFilter: ActivityTypeFilter,
    accountFilter: string
  ) => Promise<PaginatedActivityResponse>;
  /** Optional CSS class names for the outer container */
  className?: string;
}
