"use client";

import React from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { BridgeUnlockStepper } from "@/components/bridge/BridgeUnlockStepper";
import { BridgeSignatureStatus } from "@/components/bridge/BridgeSignatureStatus";
import type { RefundProgress } from "@/hooks/useBridgeRefunds";
import {
  FAILURE_REASON_LABELS,
  type BridgeTransferRecord,
} from "@/types/bridge";

const CHAIN_LABELS: Record<BridgeTransferRecord["originChain"], string> = {
  stellar: "Stellar",
  ethereum: "Ethereum",
  polygon: "Polygon",
  bsc: "BNB Chain",
};

function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export interface BridgeRefundCardProps {
  transfer: BridgeTransferRecord;
  progress?: RefundProgress;
  onTriggerRefund: (transfer: BridgeTransferRecord) => void;
}

export function BridgeRefundCard({
  transfer,
  progress,
  onTriggerRefund,
}: BridgeRefundCardProps) {
  const isRefunded = transfer.status === "refunded";
  const isInProgress = Boolean(progress) && !progress?.isDone;
  const canTrigger = transfer.status === "failed" && !progress;

  const currentStage = progress?.currentStage ?? transfer.unlockStage;
  const stageCompleted = progress?.stageCompleted ?? isRefunded;
  const signatureStatus = progress
    ? {
        gatheredSignatures: progress.gatheredSignatures,
        requiredSignatures: progress.requiredSignatures,
        validators: progress.validators,
      }
    : {
        gatheredSignatures: isRefunded ? 3 : 0,
        requiredSignatures: transfer.signatureThreshold,
        validators: [],
      };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-100">
              {transfer.amount.toLocaleString()} {transfer.assetCode}
            </span>
            <span className="text-xs text-gray-600">
              {CHAIN_LABELS[transfer.originChain]} →{" "}
              {CHAIN_LABELS[transfer.destinationChain]}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-gray-600">
            {shortHash(transfer.originTxHash)} · {formatDate(transfer.initiatedAt)}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isRefunded
              ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
              : isInProgress
                ? "border-blue-500/40 bg-blue-950/20 text-blue-400"
                : "border-rose-500/40 bg-rose-950/20 text-rose-400"
          }`}
        >
          <Icon
            id={
              isRefunded
                ? ICON_IDS.checkCircle
                : isInProgress
                  ? ICON_IDS.refreshCcw
                  : ICON_IDS.alertTriangle
            }
            size={11}
          />
          {isRefunded ? "Refunded" : isInProgress ? "Refund In Progress" : "Bridge Failed"}
        </span>
      </div>

      {!isRefunded && !isInProgress && (
        <p className="mt-3 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2 text-xs text-gray-400">
          {FAILURE_REASON_LABELS[transfer.failureReason]}
        </p>
      )}

      {progress?.error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-300"
        >
          {progress.error}
        </div>
      )}

      <BridgeSignatureStatus {...signatureStatus} />

      {(currentStage || isInProgress) && (
        <div className="mt-4">
          <BridgeUnlockStepper
            currentStage={currentStage}
            stageCompleted={stageCompleted}
          />
        </div>
      )}

      {isRefunded && transfer.refundTxHash && (
        <p className="mt-3 font-mono text-[11px] text-emerald-500">
          Refund tx: {shortHash(transfer.refundTxHash)}
        </p>
      )}

      {canTrigger && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onTriggerRefund(transfer)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Icon id={ICON_IDS.unlock} size={14} />
            Trigger Refund
          </button>
        </div>
      )}
    </div>
  );
}

export default BridgeRefundCard;
