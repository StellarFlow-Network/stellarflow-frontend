/**
 * Cross-chain bridge transfer types for the automated refund/unwrap recovery
 * workflow. A "failed" transfer here means the destination-chain mint or
 * unwrap never completed — either the transfer timed out waiting on
 * validator attestations, or it fell short of the signature threshold the
 * bridge contract requires before it will release funds on the far side.
 */

export type BridgeChain = "stellar" | "ethereum" | "polygon" | "bsc";

export type BridgeFailureReason = "validator_timeout" | "threshold_not_met";

export type BridgeTransferStatus =
  /** Failure detected, refund not yet requested */
  | "failed"
  /** Refund claim submitted to the bridge contract, unlock in progress */
  | "refund_pending"
  /** Origin-chain funds released back to the sender */
  | "refunded";

/** One stage of the origin-chain unlock the refund progresses through. */
export type BridgeUnlockStage =
  | "claim_submitted"
  | "validator_attestation"
  | "origin_unlock"
  | "funds_returned";

export const BRIDGE_UNLOCK_STAGES: readonly BridgeUnlockStage[] = [
  "claim_submitted",
  "validator_attestation",
  "origin_unlock",
  "funds_returned",
] as const;

export interface BridgeTransferRecord {
  id: string;
  originChain: BridgeChain;
  destinationChain: BridgeChain;
  assetCode: string;
  amount: number;
  /** ISO-8601 timestamp the transfer was initiated */
  initiatedAt: string;
  status: BridgeTransferStatus;
  failureReason: BridgeFailureReason;
  /** Validator signatures required before the bridge can release funds. */
  signatureThreshold: number;
  /** Hash/tx id of the original locking transaction on the origin chain */
  originTxHash: string;
  /** Highest unlock stage reached so far, once a refund has been triggered */
  unlockStage: BridgeUnlockStage | null;
  /** Populated once `unlockStage` reaches "funds_returned" */
  refundTxHash?: string;
}

export type BridgeValidatorApprovalStatus = "approved" | "pending" | "timed_out";

export interface BridgeValidatorApproval {
  id: string;
  name: string;
  status: BridgeValidatorApprovalStatus;
}

export const FAILURE_REASON_LABELS: Record<BridgeFailureReason, string> = {
  validator_timeout:
    "Destination validators did not attest within the transfer window.",
  threshold_not_met:
    "Validator signatures fell short of the required quorum threshold.",
};
