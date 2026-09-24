"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS, type IconId } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";
import {
  NETWORK_CONFIGS,
  useOptionalNetwork,
} from "@/app/components/providers/NetworkProvider";
import { usePendingTransaction } from "@/hooks/usePendingTransaction";
import {
  CANCEL_SELF_TRANSFER_AMOUNT,
  FEE_MULTIPLIER_PRESETS,
  MIN_REPLACEMENT_FEE_MULTIPLIER,
  STUCK_THRESHOLD_MS,
  cancelPendingTransaction,
  computeReplacementBaseFee,
  formatElapsed,
  formatStroopsAsXlm,
  inspectTransaction,
  speedUpTransaction,
  type NetworkContext,
  type PendingTransactionRef,
  type TransactionDetails,
} from "@/lib/txSpeedUpOps";

type Mode = "speedUp" | "cancel";

/** Envelope inspection result, tagged with the XDR it was derived from. */
interface InspectionState {
  xdr: string;
  details: TransactionDetails | null;
  error: string | null;
}

type Tone = "neutral" | "warn" | "good" | "bad";

/** Copy and styling for the lifecycle state the watched transaction is in. */
interface StatusPhase {
  tone: Tone;
  icon: IconId;
  label: string;
  note: string;
  /** False once a replacement lands and the pending clock stops meaning anything */
  showTimer: boolean;
}

const TONE_STYLES: Record<
  Tone,
  { container: string; icon: string; value: string }
> = {
  neutral: {
    container: "border-gray-800 bg-[#0d1117]",
    icon: "text-gray-500",
    value: "text-gray-100",
  },
  warn: {
    container: "border-amber-500/40 bg-amber-950/20",
    icon: "text-amber-400",
    value: "text-amber-400",
  },
  good: {
    container: "border-emerald-500/40 bg-emerald-950/20",
    icon: "text-emerald-400",
    value: "text-gray-100",
  },
  bad: {
    container: "border-rose-500/40 bg-rose-950/20",
    icon: "text-rose-400",
    value: "text-gray-100",
  },
};

export interface TxSpeedUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The stuck submission: hash, signed XDR, and when it was broadcast */
  pending: PendingTransactionRef;
  /** Short label for the stuck transaction, e.g. "Swap 250 XLM → USDC" */
  description?: string;
  /**
   * Overrides the network the replacement is signed and submitted against.
   * Defaults to the `NetworkProvider` selection when one is mounted, otherwise
   * to testnet.
   */
  network?: NetworkContext;
  /** Fired after a replacement envelope is accepted by Horizon */
  onReplaced?: (result: { txHash: string; mode: Mode }) => void;
  onError?: (error: Error) => void;
}

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
}

export function TxSpeedUpModal({
  isOpen,
  onClose,
  pending,
  description,
  network,
  onReplaced,
  onError,
}: TxSpeedUpModalProps) {
  const networkContext = useOptionalNetwork();
  const config: NetworkContext =
    network ?? networkContext?.config ?? NETWORK_CONFIGS.testnet;
  const { addToast, updateToast } = useToast();

  const [mode, setMode] = useState<Mode>("speedUp");
  const [multiplier, setMultiplier] = useState<number>(
    MIN_REPLACEMENT_FEE_MULTIPLIER,
  );
  const [inspection, setInspection] = useState<InspectionState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [replacementHash, setReplacementHash] = useState<string | null>(null);

  const { status, elapsedMs, isStuck, msUntilStuck, error: pollError, refresh } =
    usePendingTransaction({
      hash: pending.hash,
      submittedAt: pending.submittedAt,
      horizonUrl: config.horizonUrl,
      enabled: isOpen && replacementHash === null,
    });

  // Read fee/sequence facts out of the envelope once the modal opens; the SDK
  // import this triggers is why it is deferred until then. The result is tagged
  // with the XDR it describes so a new envelope invalidates it by derivation.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const xdr = pending.xdr;

    inspectTransaction(xdr, config.networkPassphrase)
      .then((parsed) => {
        if (!cancelled) setInspection({ xdr, details: parsed, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setInspection({
          xdr,
          details: null,
          error:
            err instanceof Error
              ? err.message
              : "Could not decode the pending transaction envelope.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, pending.xdr, config.networkPassphrase]);

  const details = inspection?.xdr === pending.xdr ? inspection.details : null;
  const detailsError = inspection?.xdr === pending.xdr ? inspection.error : null;

  const replacementFee = useMemo(() => {
    if (!details) return null;
    const baseFee = computeReplacementBaseFee(details.baseFeeStroops, multiplier);
    return {
      baseFee,
      // The Soroban resource fee is fixed cost that rides along unchanged; only
      // the per-operation inclusion bid scales with the multiplier.
      speedUpTotal: baseFee * details.operationCount + details.resourceFeeStroops,
      // Cancellation is a single classic payment, so it carries no resource fee.
      cancelTotal: baseFee,
    };
  }, [details, multiplier]);

  const explorerBase =
    config.networkPassphrase === NETWORK_CONFIGS.mainnet.networkPassphrase
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  const handleClose = useCallback(() => {
    setMode("speedUp");
    setMultiplier(MIN_REPLACEMENT_FEE_MULTIPLIER);
    setSubmitError(null);
    setCancelArmed(false);
    setReplacementHash(null);
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  const runReplacement = useCallback(
    async (target: Mode) => {
      setIsSubmitting(true);
      setSubmitError(null);

      const isSpeedUp = target === "speedUp";
      const toastId = addToast({
        title: isSpeedUp ? "Fee bump submitted" : "Cancellation submitted",
        description: isSpeedUp
          ? `Re-broadcasting the transaction at ${multiplier}× the original fee bid.`
          : "Replacing the pending transaction with a zero-value self-transfer.",
        status: "submitted",
      });

      try {
        updateToast(toastId, {
          status: "processing",
          title: isSpeedUp ? "Fee bump processing" : "Cancellation processing",
          description: "Awaiting your signature and network acceptance.",
        });

        const params = {
          pending,
          network: {
            horizonUrl: config.horizonUrl,
            networkPassphrase: config.networkPassphrase,
          },
          feeMultiplier: multiplier,
          details: details ?? undefined,
        };

        const { txHash } = isSpeedUp
          ? await speedUpTransaction(params)
          : await cancelPendingTransaction(params);

        setReplacementHash(txHash);
        updateToast(toastId, {
          status: "confirmed",
          title: isSpeedUp ? "Fee bump accepted" : "Transaction cancelled",
          description: isSpeedUp
            ? "The higher-fee copy replaced the queued transaction."
            : "The pending execution was replaced on the same sequence number.",
          txHash,
        });
        onReplaced?.({ txHash, mode: target });
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error(
                isSpeedUp
                  ? "Failed to speed up the transaction."
                  : "Failed to cancel the transaction.",
              );
        setSubmitError(error.message);
        updateToast(toastId, {
          status: "failed",
          title: isSpeedUp ? "Fee bump failed" : "Cancellation failed",
          description: error.message,
        });
        onError?.(error);
      } finally {
        setIsSubmitting(false);
        setCancelArmed(false);
      }
    },
    [
      addToast,
      updateToast,
      pending,
      config.horizonUrl,
      config.networkPassphrase,
      multiplier,
      details,
      onReplaced,
      onError,
    ],
  );

  const handlePrimaryAction = () => {
    if (mode === "speedUp") {
      void runReplacement("speedUp");
      return;
    }
    // Cancellation spends the sequence number on a no-op, so require a second
    // deliberate click before broadcasting.
    if (!cancelArmed) {
      setCancelArmed(true);
      return;
    }
    void runReplacement("cancel");
  };

  const alreadyResolved = status === "confirmed" || status === "failed";
  const isReplaced = replacementHash !== null;
  const canAct =
    isStuck && !isSubmitting && !alreadyResolved && details !== null && !detailsError;

  // Single source of truth for the status card so its four states aren't
  // re-derived at every JSX attribute.
  const phase: StatusPhase = isReplaced
    ? {
        tone: "good",
        icon: ICON_IDS.checkCircle,
        label: "Replacement Broadcast",
        note: "The replacement claimed the same sequence number. Whichever copy the network kept, this account is unblocked.",
        showTimer: false,
      }
    : alreadyResolved
      ? {
          tone: status === "confirmed" ? "good" : "bad",
          icon: status === "confirmed" ? ICON_IDS.checkCircle : ICON_IDS.xCircle,
          label: status === "confirmed" ? "Confirmed On Ledger" : "Failed On Ledger",
          note: "This transaction is no longer in the queue — no replacement is needed.",
          showTimer: true,
        }
      : isStuck
        ? {
            tone: "warn",
            icon: ICON_IDS.alertTriangle,
            label: "Stuck In Ledger Queue",
            note: `Unconfirmed for more than ${STUCK_THRESHOLD_MS / 1000}s. Replace it with a higher fee bid to unblock the account's sequence number.`,
            showTimer: true,
          }
        : {
            tone: "neutral",
            icon: ICON_IDS.clock,
            label: "Ledger Pending Time",
            note: `Rescue options unlock after ${STUCK_THRESHOLD_MS / 1000}s of pending time (${Math.ceil(msUntilStuck / 1000)}s remaining).`,
            showTimer: true,
          };

  const tone = TONE_STYLES[phase.tone];

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Accelerate Pending Transaction"
      size="xl"
    >
      <div className="space-y-5">
        {/* Pending-time detection */}
        <div className={`rounded-lg border p-4 ${tone.container}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Icon id={phase.icon} size={14} className={tone.icon} />
                <p className="text-xs uppercase font-bold tracking-wider text-gray-500">
                  {phase.label}
                </p>
              </div>
              {phase.showTimer && (
                <p
                  className={`mt-1 font-mono text-2xl font-bold tabular-nums ${tone.value}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {formatElapsed(elapsedMs)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={alreadyResolved || isReplaced}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon id={ICON_IDS.refreshCcw} size={12} />
              Recheck
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500">{phase.note}</p>

          {pollError && (
            <p className="mt-2 text-xs text-amber-400/80">{pollError}</p>
          )}
        </div>

        {/* Original envelope summary */}
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-gray-800 bg-[#0d1117] p-4 text-sm">
          {description && (
            <div className="col-span-2">
              <dt className="text-xs uppercase font-bold text-gray-500">
                Transaction
              </dt>
              <dd className="mt-1 text-gray-200">{description}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase font-bold text-gray-500">Hash</dt>
            <dd className="mt-1 font-mono text-xs text-gray-300">
              {shortHash(pending.hash)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase font-bold text-gray-500">Sequence</dt>
            <dd className="mt-1 font-mono text-xs text-gray-300">
              {details ? details.sequence : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase font-bold text-gray-500">
              Operations
            </dt>
            <dd className="mt-1 font-mono text-xs text-gray-300">
              {details ? details.operationCount : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase font-bold text-gray-500">
              Current Fee Bid
            </dt>
            <dd className="mt-1 font-mono text-xs text-gray-300">
              {details
                ? `${formatStroopsAsXlm(details.totalFeeStroops)} XLM`
                : "—"}
            </dd>
          </div>
          {details?.isSoroban && (
            <div className="col-span-2 border-t border-gray-800 pt-3">
              <dt className="text-xs uppercase font-bold text-gray-500">
                Soroban Resource Fee
              </dt>
              <dd className="mt-1 text-xs text-gray-400">
                <span className="font-mono text-gray-300">
                  {formatStroopsAsXlm(details.resourceFeeStroops)} XLM
                </span>{" "}
                is fixed compute cost and rides along unchanged — only the{" "}
                <span className="font-mono text-gray-300">
                  {formatStroopsAsXlm(details.inclusionFeeStroops)} XLM
                </span>{" "}
                inclusion bid competes for ledger space.
              </dd>
            </div>
          )}
        </dl>

        {detailsError && (
          <div
            className="rounded-lg border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-300"
            role="alert"
          >
            {detailsError}
          </div>
        )}

        {/* Mode selection */}
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border border-gray-800 bg-[#0d1117] p-1"
          role="tablist"
          aria-label="Rescue strategy"
        >
          {(
            [
              { id: "speedUp" as Mode, label: "Speed Up", icon: ICON_IDS.zap },
              { id: "cancel" as Mode, label: "Cancel", icon: ICON_IDS.xCircle },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => {
                setMode(tab.id);
                setCancelArmed(false);
                setSubmitError(null);
              }}
              disabled={isSubmitting || replacementHash !== null}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                mode === tab.id
                  ? tab.id === "cancel"
                    ? "bg-rose-600/20 text-rose-300"
                    : "bg-blue-600/20 text-blue-300"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <Icon id={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-gray-500">
          {mode === "speedUp"
            ? "Re-signs and broadcasts the identical payload — same source, sequence, and operations — with a higher base fee so validators prefer it over the queued copy."
            : `Broadcasts a ${CANCEL_SELF_TRANSFER_AMOUNT} XLM self-transfer on the same sequence number. If it wins the replacement race, the queued operations never execute.`}
        </p>

        {/* Fee bid selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="tx-fee-multiplier"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Fee Bid Multiplier
            </label>
            <span className="text-xs text-gray-500">
              minimum {MIN_REPLACEMENT_FEE_MULTIPLIER}× to displace
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {FEE_MULTIPLIER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMultiplier(preset)}
                disabled={isSubmitting || replacementHash !== null}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  multiplier === preset
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {preset}×
              </button>
            ))}
          </div>

          <input
            id="tx-fee-multiplier"
            type="number"
            min={MIN_REPLACEMENT_FEE_MULTIPLIER}
            step={1}
            value={multiplier}
            onChange={(event) => setMultiplier(Number(event.target.value))}
            onBlur={() =>
              setMultiplier((current) =>
                Number.isFinite(current) && current >= MIN_REPLACEMENT_FEE_MULTIPLIER
                  ? Math.floor(current)
                  : MIN_REPLACEMENT_FEE_MULTIPLIER,
              )
            }
            disabled={isSubmitting || replacementHash !== null}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 font-mono text-sm text-gray-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            aria-describedby="tx-fee-preview"
          />

          <div
            id="tx-fee-preview"
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5 text-sm"
          >
            <span className="text-gray-400">New fee bid</span>
            <span className="font-mono font-semibold text-emerald-400">
              {replacementFee
                ? `${formatStroopsAsXlm(
                    mode === "speedUp"
                      ? replacementFee.speedUpTotal
                      : replacementFee.cancelTotal,
                  )} XLM`
                : "—"}
            </span>
          </div>
        </div>

        {submitError && (
          <div
            className="rounded-lg border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-300"
            role="alert"
          >
            {submitError}
          </div>
        )}

        {replacementHash && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2.5 text-sm text-emerald-300">
            <p>
              Replacement broadcast as{" "}
              <span className="font-mono break-all">
                {shortHash(replacementHash)}
              </span>
            </p>
            <a
              href={`${explorerBase}/tx/${replacementHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#CBF34D] hover:underline"
            >
              View on Stellar Expert
              <Icon id={ICON_IDS.externalLink} size={12} strokeWidth={2.5} />
            </a>
          </div>
        )}

        {cancelArmed && !isSubmitting && (
          <div
            className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-300"
            role="alert"
          >
            This burns the sequence number on a no-op — the original transaction
            will never execute. Click again to confirm.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {replacementHash ? "Close" : "Dismiss"}
          </button>
          {!replacementHash && (
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!canAct}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                mode === "cancel"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting
                ? mode === "speedUp"
                  ? "Broadcasting Fee Bump..."
                  : "Broadcasting Cancellation..."
                : !isStuck && !alreadyResolved
                  ? `Available in ${Math.ceil(msUntilStuck / 1000)}s`
                  : mode === "speedUp"
                    ? `Re-broadcast at ${multiplier}× Fee`
                    : cancelArmed
                      ? "Confirm Cancellation"
                      : "Cancel Transaction"}
            </button>
          )}
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default TxSpeedUpModal;
