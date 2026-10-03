"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import { useRAFInterval } from "@/app/hooks/useRAFInterval";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";
import { formatCountdown, validatePreimageHex } from "@/lib/hexValidation";

export interface ClaimEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Soroban HTLC contract address */
  contractId: string;
  /** Escrow amount shown in the modal summary */
  amount: string;
  /** Asset symbol for the escrowed funds (e.g. XLM) */
  assetSymbol?: string;
  /**
   * Unix timestamp (ms) when the lock window expires and refund becomes eligible.
   * The countdown displays time remaining until this moment.
   */
  refundEligibleAt: number;
  onClaimSuccess?: (txHash: string) => void;
  onClaimError?: (error: Error) => void;
}

export function ClaimEscrowModal({
  isOpen,
  onClose,
  contractId,
  amount,
  assetSymbol = "XLM",
  refundEligibleAt,
  onClaimSuccess,
  onClaimError,
}: ClaimEscrowModalProps) {
  const { addToast, updateToast } = useToast();
  const [preimage, setPreimage] = useState("");
  const [touched, setTouched] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, refundEligibleAt - Date.now()),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const validation = useMemo(() => validatePreimageHex(preimage), [preimage]);
  const lockExpired = remainingMs <= 0;
  const canSubmit =
    validation.valid && !lockExpired && !isSubmitting && txHash === null;

  const updateRemaining = useCallback(() => {
    setRemainingMs(Math.max(0, refundEligibleAt - Date.now()));
  }, [refundEligibleAt]);

  useEffect(() => {
    if (!isOpen) return;
    const initialSyncTimer = window.setTimeout(updateRemaining, 0);
    return () => window.clearTimeout(initialSyncTimer);
  }, [isOpen, updateRemaining]);

  useRAFInterval(updateRemaining, 1000, isOpen);

  const handleClose = useCallback(() => {
    setPreimage("");
    setTouched(false);
    setSubmitError(null);
    setTxHash(null);
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setSubmitError(null);

    const result = validatePreimageHex(preimage);
    if (!result.valid || lockExpired) {
      return;
    }

    setIsSubmitting(true);
    const toastId = addToast({
      title: "Escrow claim submitted",
      description: "Submitting your HTLC claim to the network.",
      status: "submitted",
    });

    try {
      updateToast(toastId, {
        status: "processing",
        title: "Escrow claim processing",
        description: "Your claim transaction is being prepared and sent.",
      });
      const { claimEscrow } = await import("@/lib/escrowOps");
      const { txHash: hash } = await claimEscrow({
        contractId,
        preimageHex: result.normalized,
      });

      setTxHash(hash);
      updateToast(toastId, {
        status: "confirmed",
        title: "Escrow claim confirmed",
        description: "Your claim was confirmed on-chain.",
        txHash: hash,
      });
      onClaimSuccess?.(hash);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to claim escrow funds.");
      setSubmitError(error.message);
      updateToast(toastId, {
        status: "failed",
        title: "Escrow claim failed",
        description: error.message,
      });
      onClaimError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Claim HTLC Escrow"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-gray-500">
                Escrowed Amount
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-100">
                {amount}{" "}
                <span className="text-sm font-normal text-gray-400">
                  {assetSymbol}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase font-bold text-gray-500">
                Contract
              </p>
              <p className="mt-1 font-mono text-xs text-gray-400">
                {contractId.slice(0, 6)}...{contractId.slice(-6)}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg border p-4 ${
            lockExpired
              ? "border-red-500/40 bg-red-950/20"
              : remainingMs < 3_600_000
                ? "border-yellow-500/40 bg-yellow-950/10"
                : "border-emerald-500/30 bg-emerald-950/10"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon
              id={lockExpired ? ICON_IDS.unlock : ICON_IDS.lock}
              size={16}
              className={lockExpired ? "text-red-400" : "text-emerald-400"}
            />
            <p className="text-xs uppercase font-bold tracking-wider text-gray-400">
              {lockExpired ? "Lock Window Expired" : "Claim Window Remaining"}
            </p>
          </div>
          <p
            className={`font-mono text-2xl font-bold tabular-nums ${
              lockExpired
                ? "text-red-400"
                : remainingMs < 3_600_000
                  ? "text-yellow-400"
                  : "text-emerald-400"
            }`}
            aria-live="polite"
            aria-atomic="true"
          >
            {lockExpired ? "00:00:00" : formatCountdown(remainingMs)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {lockExpired
              ? "Refund is now eligible. Pre-image claims can no longer release these funds."
              : "Submit the secret pre-image before this timer expires to release escrowed funds."}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="htlc-preimage"
            className="text-xs uppercase font-bold text-gray-500"
          >
            Secret Pre-Image (Hex)
          </label>
          <textarea
            id="htlc-preimage"
            value={preimage}
            onChange={(event) => setPreimage(event.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            spellCheck={false}
            autoComplete="off"
            placeholder="Enter the raw hex pre-image (e.g. 0xabc123...)"
            disabled={lockExpired || isSubmitting || txHash !== null}
            className="w-full resize-none rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            aria-invalid={touched && !validation.valid}
            aria-describedby="htlc-preimage-help htlc-preimage-error"
          />
          <p id="htlc-preimage-help" className="text-xs text-gray-500">
            Must be a valid even-length hexadecimal string. Optional{" "}
            <code className="text-gray-400">0x</code> prefix is supported.
          </p>
          {touched && validation.error && (
            <p
              id="htlc-preimage-error"
              className="text-xs text-red-400"
              role="alert"
            >
              {validation.error}
            </p>
          )}
        </div>

        {submitError && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {submitError}
          </div>
        )}

        {txHash && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            Claim submitted successfully. Transaction:{" "}
            <span className="font-mono break-all">{txHash}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {txHash ? "Close" : "Cancel"}
          </button>
          {!txHash && (
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Submitting Claim..." : "Release Escrow Funds"}
            </button>
          )}
        </div>
      </form>
    </OptimizedDialog>
  );
}

export default ClaimEscrowModal;
