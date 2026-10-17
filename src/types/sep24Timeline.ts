/**
 * SEP-24 Interactive Transaction Timeline Type Definitions (Issue #1198)
 *
 * Defines contracts for historical SEP-24 deposit and withdrawal events,
 * itemized processing step logs, anchor partner descriptors, and dynamic polling callbacks.
 */

export type SEP24OperationKind = "deposit" | "withdrawal";

export type SEP24StepStatus = "completed" | "in_progress" | "pending" | "failed";

export type SEP24OverallStatus =
  | "completed"
  | "pending_user_transfer_start"
  | "pending_anchor"
  | "pending_stellar"
  | "pending_external"
  | "failed"
  | "no_market";

/**
 * Anchor partner details powering verified branding and trust badges.
 */
export interface AnchorPartnerInfo {
  name: string;
  domain: string;
  code: string;
  region?: string;
  badgeColor?: string;
}

/**
 * An itemized processing log representing one specific stage of a SEP-24 transfer.
 */
export interface SEP24ProcessingStepLog {
  id: string;
  stepKey: string;
  title: string;
  description: string;
  status: SEP24StepStatus;
  /** ISO-8601 or formatted timestamp string */
  timestamp: string;
  /** Optional Stellar transaction hash (if this step committed on-chain) */
  txHash?: string;
  /** Optional banking rail / external reference */
  externalRef?: string;
  /** Optional error message if the step failed */
  errorMessage?: string;
}

/**
 * A historical SEP-24 interactive deposit or withdrawal transaction record.
 */
export interface SEP24HistoricalTransaction {
  id: string;
  operation: SEP24OperationKind;
  status: SEP24OverallStatus;
  anchor: AnchorPartnerInfo;
  amountIn: number | string;
  assetIn: string;
  amountOut: number | string;
  assetOut: string;
  fee?: number | string;
  feeAsset?: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
  /** Direct link to the anchor's web receipt or interactive portal */
  moreInfoUrl?: string;
  stellarTxHash?: string;
  externalRef?: string;
  account?: string;
  stepLogs: SEP24ProcessingStepLog[];
}

/**
 * Component props for SEP24TransactionTimeline.
 */
export interface SEP24TransactionTimelineProps {
  /**
   * List of historical SEP-24 transactions to present.
   * If omitted, sample fixtures are shown and visibly labeled. An empty array
   * renders an empty timeline.
   */
  transactions?: SEP24HistoricalTransaction[];
  /** Initially selected transaction ID */
  initialSelectedId?: string;
  /** Polling interval (in ms) when onPollStatus is supplied (default: 4000ms) */
  pollInterval?: number;
  /**
   * Optional external poller function invoked to retrieve updated status
   * for an active transaction.
   */
  onPollStatus?: (
    transactionId: string
  ) => Promise<Partial<SEP24HistoricalTransaction> | null>;
  /** Callback fired whenever a transaction transitions to a new status */
  onStatusChange?: (transaction: SEP24HistoricalTransaction) => void;
  /** Optional custom CSS classes for the container */
  className?: string;
}
