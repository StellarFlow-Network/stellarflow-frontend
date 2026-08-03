"use client";

import React, { useMemo } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type { PushEventType } from "@/services/notifications";

export interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: string;
  type: PushEventType;
  meta?: Record<string, string | number | boolean | null>;
}

const TYPE_LABELS: Record<PushEventType, string> = {
  swap: "Swap executed",
  limit_order: "Limit order filled",
  remittance: "Remittance payout completed",
  governance: "Governance vote confirmed",
};

export function TransactionDetailsModal({
  isOpen,
  onClose,
  txHash,
  type,
  meta,
}: TransactionDetailsModalProps) {
  const explorerUrl = useMemo(
    () => `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    [txHash],
  );

  const entries = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta).filter(([, v]) => v !== undefined && v !== null);
  }, [meta]);

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction details"
      size="md"
    >
      <div className="space-y-4 text-gray-200">
        <div className="flex items-start gap-3 rounded-xl border border-gray-800 bg-[#0d1117] px-4 py-3">
          <Icon id={ICON_IDS.checkCircle} size={22} className="mt-0.5 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">{TYPE_LABELS[type]}</p>
            <p className="mt-1 text-xs text-gray-500">
              Opened from a push notification deep link.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Transaction hash
          </p>
          <p className="break-all rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2 font-mono text-xs text-gray-300">
            {txHash}
          </p>
        </div>

        {entries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Details
            </p>
            <dl className="space-y-2 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2">
              {entries.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 text-sm">
                  <dt className="text-gray-500">{key}</dt>
                  <dd className="text-right font-mono text-gray-200">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            View on StellarExpert
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default TransactionDetailsModal;
