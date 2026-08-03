/**
 * Pending-transaction rescue operations.
 *
 * When a submitted transaction sits unconfirmed in the ledger queue, the source
 * account's sequence number is held hostage: every later transaction the user
 * builds will be rejected with `tx_bad_seq` until the pending one clears. Two
 * escapes exist, both of which replace the queued entry by re-using its
 * sequence number with a higher fee bid:
 *
 *  1. **Speed up** — rebuild the *identical* operation payload (same source,
 *     same sequence, same operations, same preconditions) with a bumped base
 *     fee, re-sign it, and broadcast. Whichever copy stellar-core keeps, the
 *     user's intent executes.
 *  2. **Cancel** — broadcast a throwaway zero-value self-transfer on the same
 *     sequence number. Winning the replacement race burns the sequence number
 *     on a no-op, so the original operations never execute.
 *
 * stellar-core only evicts a queued transaction in favour of a replacement whose
 * fee bid is at least {@link MIN_REPLACEMENT_FEE_MULTIPLIER}× the original's, so
 * both paths clamp to that floor.
 *
 * The Stellar SDK and Freighter adapter are imported lazily inside each function
 * so they stay out of the initial dashboard bundle — the same convention used by
 * `transactionOps.ts` and `escrowOps.ts`.
 */

// Type-only import: erased at compile time, so the SDK stays lazily loaded.
import type { Transaction, xdr } from "@stellar/stellar-sdk";

/** A transaction pending longer than this is treated as stuck in the queue. */
export const STUCK_THRESHOLD_MS = 30_000;

/**
 * stellar-core refuses to replace a queued transaction unless the incoming bid
 * is at least this multiple of the fee it displaces.
 */
export const MIN_REPLACEMENT_FEE_MULTIPLIER = 10;

/** Fee multipliers offered in the UI, all at or above the replacement floor. */
export const FEE_MULTIPLIER_PRESETS = [10, 20, 50] as const;

export const STROOPS_PER_XLM = 10_000_000;

/**
 * Self-transfer amount used by the cancel path. Stellar rejects a payment of
 * literally `0`, so the smallest representable unit (1 stroop) stands in: it
 * leaves the account holding the same balance it started with, making the
 * transfer zero-value in effect while still burning the sequence number.
 */
export const CANCEL_SELF_TRANSFER_AMOUNT = "0.0000001";

export interface NetworkContext {
  /** Horizon REST base URL for the active network */
  horizonUrl: string;
  /** Network passphrase the original transaction was signed against */
  networkPassphrase: string;
}

export interface PendingTransactionRef {
  /** Hash of the original submission, used for confirmation polling */
  hash: string;
  /** Base64 XDR of the original signed transaction envelope */
  xdr: string;
  /** Epoch ms at which the envelope was handed to the network */
  submittedAt: number;
}

/** Fee and sequencing facts read back out of a pending envelope. */
export interface TransactionDetails {
  source: string;
  sequence: string;
  operationCount: number;
  /** Total fee bid of the envelope, in stroops (inclusion + Soroban resources) */
  totalFeeStroops: number;
  /**
   * Fixed Soroban resource fee component, in stroops; `0` for classic
   * transactions. This part of the bid pays for compute and ledger I/O, not for
   * queue priority, so bumping it would be wasted spend.
   */
  resourceFeeStroops: number;
  /** Portion of the bid that competes for ledger space, in stroops */
  inclusionFeeStroops: number;
  /** Per-operation inclusion fee — the figure a replacement actually bumps */
  baseFeeStroops: number;
  /** Upper timebound in epoch ms, or null when the envelope has none */
  maxTimeMs: number | null;
  /** True when a fee-bump wrapper was submitted rather than a plain envelope */
  isFeeBump: boolean;
  /** True when the envelope carries a Soroban resource footprint */
  isSoroban: boolean;
}

export interface ReplacementResult {
  txHash: string;
  /** Fee bid the replacement was broadcast with, in stroops */
  totalFeeStroops: number;
}

export type LedgerTxStatus = "pending" | "confirmed" | "failed";

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Renders a stroop amount as XLM with the SDK's 7-decimal precision. */
export function formatStroopsAsXlm(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
}

/** Renders an elapsed duration as `mm:ss`, or `h:mm:ss` past the hour mark. */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Clamps a requested fee multiplier to the replacement floor and returns the
 * resulting per-operation base fee in stroops.
 */
export function computeReplacementBaseFee(
  originalBaseFeeStroops: number,
  multiplier: number,
): number {
  const effective = Math.max(
    MIN_REPLACEMENT_FEE_MULTIPLIER,
    Number.isFinite(multiplier) ? multiplier : MIN_REPLACEMENT_FEE_MULTIPLIER,
  );
  return Math.ceil(originalBaseFeeStroops * effective);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger inspection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asks Horizon whether a submitted hash has landed yet.
 *
 * Uses the REST endpoint over plain `fetch` rather than the SDK so polling for
 * confirmation costs nothing in bundle size. Horizon answers 404 for a hash it
 * has not ingested, which is exactly the "still queued" case.
 */
export async function fetchLedgerTxStatus(
  horizonUrl: string,
  hash: string,
): Promise<LedgerTxStatus> {
  const response = await fetch(`${horizonUrl}/transactions/${hash}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (response.status === 404) {
    return "pending";
  }

  if (!response.ok) {
    throw new Error(`Horizon lookup failed with status ${response.status}.`);
  }

  const body: { successful?: boolean } = await response.json();
  return body.successful ? "confirmed" : "failed";
}

/**
 * Extracts the Soroban resource footprint from a transaction envelope.
 *
 * `TransactionBuilder.cloneFrom` does not carry this across, so any rebuilt
 * Soroban transaction has to be handed the footprint back explicitly or the
 * network rejects it for missing resources.
 */
function readSorobanFootprint(
  tx: Transaction,
): xdr.SorobanTransactionData | undefined {
  const envelope = tx.toEnvelope();
  // Only the v1 envelope shape carries the `ext` union that holds Soroban data.
  if (envelope.switch().name !== "envelopeTypeTx") {
    return undefined;
  }
  const footprint = envelope.v1().tx().ext().value() as
    | xdr.SorobanTransactionData
    | undefined;
  return footprint ?? undefined;
}

/**
 * Reads the fee, sequence, and timebound facts out of a signed envelope so the
 * UI can price a replacement without the caller having to track them.
 */
export async function inspectTransaction(
  xdr: string,
  networkPassphrase: string,
): Promise<TransactionDetails> {
  const { TransactionBuilder } = await import("@stellar/stellar-sdk");

  const parsed = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  // A fee-bump envelope wraps the inner transaction that actually holds the
  // operations and sequence number we need to replace.
  const isFeeBump = "innerTransaction" in parsed;
  const inner = isFeeBump ? parsed.innerTransaction : parsed;

  const totalFeeStroops = Number(parsed.fee);
  const operationCount = Math.max(1, inner.operations.length);
  const maxTime = inner.timeBounds?.maxTime;

  const footprint = readSorobanFootprint(inner);
  const resourceFeeStroops = footprint
    ? Number(footprint.resourceFee().toBigInt())
    : 0;
  // Guard against a malformed envelope claiming more resource fee than it bid.
  const inclusionFeeStroops = Math.max(0, totalFeeStroops - resourceFeeStroops);

  return {
    source: inner.source,
    sequence: inner.sequence,
    operationCount,
    totalFeeStroops,
    resourceFeeStroops,
    inclusionFeeStroops,
    baseFeeStroops: Math.ceil(inclusionFeeStroops / operationCount),
    maxTimeMs: maxTime && Number(maxTime) > 0 ? Number(maxTime) * 1000 : null,
    isFeeBump,
    isSoroban: footprint !== undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signing / submission plumbing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Horizon rejections carry the useful diagnosis in `extras.result_codes`;
 * the thrown Error's own message is a generic "Bad Request".
 */
function describeSubmitFailure(err: unknown, fallback: string): string {
  const codes = (
    err as {
      response?: {
        data?: {
          extras?: {
            result_codes?: { transaction?: string; operations?: string[] };
          };
        };
      };
    }
  )?.response?.data?.extras?.result_codes;

  if (codes?.transaction === "tx_bad_seq") {
    return "The pending transaction already cleared the queue — its sequence number is spent.";
  }
  if (codes?.transaction === "tx_insufficient_fee") {
    return `The network rejected this fee bid as too low to displace the queued transaction. Raise the multiplier above ${MIN_REPLACEMENT_FEE_MULTIPLIER}×.`;
  }
  if (codes?.transaction === "tx_too_late") {
    return "The original transaction's timebounds expired, so it can no longer be replaced.";
  }
  if (codes?.transaction) {
    const operations = codes.operations?.length
      ? ` (${codes.operations.join(", ")})`
      : "";
    return `Network rejected the submission: ${codes.transaction}${operations}.`;
  }

  return err instanceof Error ? err.message : fallback;
}

/** Resolves the connected Freighter address, failing loudly if unavailable. */
async function requireConnectedAddress(): Promise<string> {
  const { isConnected, getAddress } = await import("@stellar/freighter-api");

  if (!(await isConnected())) {
    throw new Error(
      "Freighter wallet is not connected. Please connect your wallet first.",
    );
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve public key from Freighter.");
  }

  return address;
}

/**
 * Sends an unsigned envelope through Freighter and on to Horizon, returning the
 * accepted hash.
 */
async function signAndSubmit(
  unsignedXdr: string,
  network: NetworkContext,
  signerAddress: string,
  failureFallback: string,
): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const { Horizon, TransactionBuilder } = await import("@stellar/stellar-sdk");

  const { signedTxXdr, error } = await signTransaction(unsignedXdr, {
    networkPassphrase: network.networkPassphrase,
    address: signerAddress,
  });

  if (error || !signedTxXdr) {
    throw new Error("Transaction signing failed or was canceled.");
  }

  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    network.networkPassphrase,
  );
  const server = new Horizon.Server(network.horizonUrl);

  try {
    const response = await server.submitTransaction(signedTx);
    return response.hash;
  } catch (err) {
    throw new Error(describeSubmitFailure(err, failureFallback));
  }
}

/** Guards against replacing an envelope whose timebounds have already lapsed. */
function assertReplaceable(details: TransactionDetails): void {
  if (details.maxTimeMs !== null && details.maxTimeMs <= Date.now()) {
    throw new Error(
      "The original transaction's timebounds have expired. It can no longer be replaced — build a fresh transaction instead.",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public operations
// ─────────────────────────────────────────────────────────────────────────────

export interface SpeedUpParams {
  pending: PendingTransactionRef;
  network: NetworkContext;
  /** Multiplier applied to the original per-operation base fee */
  feeMultiplier: number;
  /** Pre-read envelope facts; re-derived from the XDR when omitted */
  details?: TransactionDetails;
}

/**
 * Re-signs and broadcasts the identical transaction payload with a bumped base
 * fee.
 *
 * `TransactionBuilder.cloneFrom` reproduces the source, sequence number,
 * operations, memo, and preconditions verbatim — only the fee bid changes — so
 * the replacement executes exactly what the user originally authorised.
 */
export async function speedUpTransaction({
  pending,
  network,
  feeMultiplier,
  details,
}: SpeedUpParams): Promise<ReplacementResult> {
  const envelope =
    details ?? (await inspectTransaction(pending.xdr, network.networkPassphrase));
  assertReplaceable(envelope);

  const signerAddress = await requireConnectedAddress();
  if (signerAddress !== envelope.source) {
    throw new Error(
      "The connected wallet is not the source account of the pending transaction.",
    );
  }

  const { TimeoutInfinite, TransactionBuilder } = await import(
    "@stellar/stellar-sdk"
  );

  const original = TransactionBuilder.fromXDR(
    pending.xdr,
    network.networkPassphrase,
  );
  const inner = "innerTransaction" in original ? original.innerTransaction : original;

  const bumpedBaseFee = computeReplacementBaseFee(
    envelope.baseFeeStroops,
    feeMultiplier,
  );

  // cloneFrom rewinds the source account to `sequence - 1` internally, so the
  // rebuilt envelope re-claims the same sequence number the original holds.
  // The Soroban footprint has to be re-attached by hand — cloneFrom drops it —
  // and the builder re-adds its resource fee on top of the inclusion bid.
  const footprint = readSorobanFootprint(inner);
  const builder = TransactionBuilder.cloneFrom(inner, {
    fee: bumpedBaseFee.toString(),
    ...(footprint ? { sorobanData: footprint } : {}),
  });

  // cloneFrom copies the original timebounds; when the original had none, the
  // builder refuses to build until the infinite timeout is opted into
  // explicitly, so mirror the original's unbounded validity.
  if (!inner.timeBounds) {
    builder.setTimeout(TimeoutInfinite);
  }

  const replacement = builder.build();

  const txHash = await signAndSubmit(
    replacement.toXDR(),
    network,
    signerAddress,
    "Failed to broadcast the fee-bumped transaction.",
  );

  return {
    txHash,
    totalFeeStroops:
      bumpedBaseFee * envelope.operationCount + envelope.resourceFeeStroops,
  };
}

export interface CancelParams {
  pending: PendingTransactionRef;
  network: NetworkContext;
  /** Multiplier applied to the original per-operation base fee */
  feeMultiplier: number;
  /** Pre-read envelope facts; re-derived from the XDR when omitted */
  details?: TransactionDetails;
}

/**
 * Replaces the pending execution with a zero-value self-transfer.
 *
 * The cancel envelope claims the *same* sequence number as the stuck
 * transaction, so at most one of the two can ever be applied. Winning the
 * replacement race spends the sequence number on a payment that returns the
 * funds to their own account, leaving the original operations unexecuted.
 */
export async function cancelPendingTransaction({
  pending,
  network,
  feeMultiplier,
  details,
}: CancelParams): Promise<ReplacementResult> {
  const envelope =
    details ?? (await inspectTransaction(pending.xdr, network.networkPassphrase));
  assertReplaceable(envelope);

  const signerAddress = await requireConnectedAddress();
  if (signerAddress !== envelope.source) {
    throw new Error(
      "The connected wallet is not the source account of the pending transaction.",
    );
  }

  const { Account, Asset, Operation, TransactionBuilder } = await import(
    "@stellar/stellar-sdk"
  );

  const bumpedBaseFee = computeReplacementBaseFee(
    envelope.baseFeeStroops,
    feeMultiplier,
  );

  // The builder increments the account's sequence before building, so seed it
  // one below the pending transaction's sequence to land on the same number.
  const previousSequence = (BigInt(envelope.sequence) - BigInt(1)).toString();
  const account = new Account(envelope.source, previousSequence);

  const cancelTx = new TransactionBuilder(account, {
    fee: bumpedBaseFee.toString(),
    networkPassphrase: network.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: envelope.source,
        asset: Asset.native(),
        amount: CANCEL_SELF_TRANSFER_AMOUNT,
      }),
    )
    .setTimeout(60)
    .build();

  const txHash = await signAndSubmit(
    cancelTx.toXDR(),
    network,
    signerAddress,
    "Failed to broadcast the cancellation transaction.",
  );

  return { txHash, totalFeeStroops: bumpedBaseFee };
}
