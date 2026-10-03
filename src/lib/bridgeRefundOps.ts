/**
 * Bridge refund recovery operations.
 *
 * When a cross-chain transfer's destination-side mint never completes —
 * either the validator set timed out attesting to the lock, or attestations
 * came in under the required signature threshold — funds sit locked in the
 * origin-chain bridge contract. Recovering them is a claim-and-unlock flow:
 * the user submits a refund claim referencing the original lock transaction,
 * the bridge contract re-checks (or re-collects) validator attestations, and
 * once satisfied it releases the original deposit back to the sender on the
 * origin chain.
 *
 * No bridge indexer exists yet, so `fetchFailedBridgeTransfers` and
 * `triggerBridgeRefund` are mocked here against the shape a real bridge
 * contract client would return — swap them for real calls once the indexer
 * and contract bindings land, without touching the UI that consumes them.
 */
import type {
  BridgeTransferRecord,
  BridgeUnlockStage,
  BridgeValidatorApproval,
} from "@/types/bridge";
import { BRIDGE_UNLOCK_STAGES } from "@/types/bridge";

const MOCK_TRANSFERS: BridgeTransferRecord[] = [
  {
    id: "bridge-tx-2201",
    originChain: "ethereum",
    destinationChain: "stellar",
    assetCode: "USDC",
    amount: 1500,
    initiatedAt: "2026-08-24T10:12:00Z",
    status: "failed",
    failureReason: "validator_timeout",
    signatureThreshold: 3,
    originTxHash:
      "0x7f9a3c1e2b4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    unlockStage: null,
  },
  {
    id: "bridge-tx-2198",
    originChain: "polygon",
    destinationChain: "stellar",
    assetCode: "USDC",
    amount: 320.5,
    initiatedAt: "2026-08-22T18:44:00Z",
    status: "failed",
    failureReason: "threshold_not_met",
    signatureThreshold: 3,
    originTxHash:
      "0x3b6a9f4e7d2c1e0f8a5b4c9d3e7f2a1b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f",
    unlockStage: null,
  },
  {
    id: "bridge-tx-2144",
    originChain: "bsc",
    destinationChain: "stellar",
    assetCode: "XLM",
    amount: 4800,
    initiatedAt: "2026-08-18T07:05:00Z",
    status: "refunded",
    failureReason: "validator_timeout",
    signatureThreshold: 3,
    originTxHash:
      "0x9d1a2b3c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    unlockStage: "funds_returned",
    refundTxHash:
      "0x1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
  },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Scans account activity for bridge transfers stuck in a failed state. */
export async function fetchFailedBridgeTransfers(): Promise<
  BridgeTransferRecord[]
> {
  await delay(400);
  return MOCK_TRANSFERS.map((t) => ({ ...t }));
}

export interface RefundProgressUpdate {
  stage: BridgeUnlockStage;
  /** True once this stage has completed */
  completed: boolean;
  message: string;
  gatheredSignatures: number;
  requiredSignatures: number;
  validators: BridgeValidatorApproval[];
}

const STAGE_MESSAGES: Record<BridgeUnlockStage, string> = {
  claim_submitted: "Refund claim submitted to the bridge contract.",
  validator_attestation:
    "Collecting validator attestations for the unlock request.",
  origin_unlock: "Origin-chain contract unlocking the deposited funds.",
  funds_returned: "Funds returned to the sender on the origin chain.",
};

/**
 * Drives a mock refund claim through the four unlock stages, invoking
 * `onProgress` as each one starts and completes. Resolves with the
 * origin-chain refund transaction hash once the unlock finishes.
 */
export async function triggerBridgeRefund(
  transfer: BridgeTransferRecord,
  onProgress: (update: RefundProgressUpdate) => void,
): Promise<string> {
  const validators: BridgeValidatorApproval[] = [
    { id: "validator-1", name: "Atlas", status: "pending" },
    { id: "validator-2", name: "Meridian", status: "pending" },
    { id: "validator-3", name: "Northstar", status: "pending" },
    { id: "validator-4", name: "Aegis", status: "pending" },
    { id: "validator-5", name: "Helios", status: "pending" },
  ];
  let gatheredSignatures = 0;

  for (const stage of BRIDGE_UNLOCK_STAGES) {
    onProgress({
      stage,
      completed: false,
      message: STAGE_MESSAGES[stage],
      gatheredSignatures,
      requiredSignatures: transfer.signatureThreshold,
      validators: validators.map((validator) => ({ ...validator })),
    });
    await delay(1_100);
    if (stage === "validator_attestation") {
      validators[0].status = "approved";
      validators[1].status = "approved";
      validators[2].status = "approved";
      gatheredSignatures = 3;
      if (transfer.failureReason === "validator_timeout") {
        validators[4].status = "timed_out";
      }
    }
    onProgress({
      stage,
      completed: true,
      message: STAGE_MESSAGES[stage],
      gatheredSignatures,
      requiredSignatures: transfer.signatureThreshold,
      validators: validators.map((validator) => ({ ...validator })),
    });
  }

  return `0x${transfer.originTxHash.slice(2, 10)}refund${Date.now().toString(16)}`;
}
