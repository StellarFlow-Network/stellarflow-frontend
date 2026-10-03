"use client";

import React, { useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";
import { useRemittancePayoutsWithFallback } from "@/app/hooks/useRemittancePayouts";
import { exportRemittancePayoutsToCsv } from "@/utils/remittanceCsvExport";
import { ReceiptModal, type ReceiptData } from "@/components/remittance/ReceiptModal";
import type { RemittancePayoutRecord } from "@/types/remittancePayout";

const STATUS_STYLES: Record<RemittancePayoutRecord["status"], string> = {
  completed: "bg-emerald-400/10 text-emerald-400",
  pending: "bg-yellow-500/10 text-yellow-500",
  failed: "bg-red-500/10 text-red-500",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toReceiptData(payout: RemittancePayoutRecord): ReceiptData {
  return {
    transactionHash: payout.transactionHash,
    anchorReference: payout.anchorReference,
    anchorName: payout.anchorName,
    amountSent: `${payout.amountSent.toLocaleString()} ${payout.sentCurrency}`,
    amountReceived: `${payout.amountReceived.toLocaleString()} ${payout.receivedCurrency}`,
    exchangeRate: payout.exchangeRate,
    fees: `${payout.fee} ${payout.feeCurrency}`,
    timestamp: payout.date,
    senderName: payout.senderName,
    recipientName: payout.recipientName,
    recipientAddress: payout.recipientAddress,
  };
}

export interface RemittanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Remittance payout history for local business accounting: lists settled
 * transfers with a one-click PDF receipt per row and a CSV statement export
 * covering the whole list (transaction reference, exchange rate, and anchor
 * details on every line).
 */
export function RemittanceHistoryModal({
  isOpen,
  onClose,
}: RemittanceHistoryModalProps) {
  const { data: payouts, isLoading } = useRemittancePayoutsWithFallback();
  const { addToast, updateToast } = useToast();
  const [activeReceipt, setActiveReceipt] = useState<RemittancePayoutRecord | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stellarflow-contacts");
      if (saved) {
        try {
          setContacts(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse contacts", e);
        }
      }
    }
  }, [isOpen]);

  const getAlias = (address?: string) => {
    if (!address) return null;
    const contact = contacts.find(c => c.address === address);
    return contact ? contact.alias : null;
  };

  if (!isOpen) return null;

  const handleExportCsv = async () => {
    if (isExporting || payouts.length === 0) return;
    setIsExporting(true);
    const toastId = addToast({
      title: "Preparing CSV statement",
      description: `Formatting ${payouts.length} remittance payouts…`,
      status: "processing",
    });

    try {
      await exportRemittancePayoutsToCsv(payouts);
      updateToast(toastId, {
        title: "Statement ready",
        description: `${payouts.length} payouts downloaded as CSV.`,
        status: "confirmed",
      });
    } catch {
      updateToast(toastId, {
        title: "Export failed",
        description: "Could not generate the CSV statement. Please try again.",
        status: "failed",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Remittance history"
      >
        <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] text-gray-100 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 p-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                Remittance History
              </h2>
              <p className="text-sm text-gray-500">
                Printable receipts and accounting statements for your payouts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting || payouts.length === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon id={ICON_IDS.fileText} size={14} />
                {isExporting ? "Exporting…" : "Export CSV Statement"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close remittance history"
                className="rounded-lg border border-gray-700 p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              >
                <Icon id={ICON_IDS.xCircle} size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="px-6 py-16 text-center text-sm text-gray-500">
                Loading remittance history…
              </div>
            ) : payouts.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-gray-500">
                No remittance payouts yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-800/60">
                {payouts.map((payout) => (
                  <li
                    key={payout.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200">
                          {payout.amountSent.toLocaleString()} {payout.sentCurrency}{" "}
                          → {payout.amountReceived.toLocaleString()}{" "}
                          {payout.receivedCurrency}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[payout.status]}`}
                        >
                          {payout.status}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
                        <span>{payout.anchorName}</span>
                        <span>·</span>
                        <span>{formatDate(payout.date)}</span>
                        <span>·</span>
                        <span>{payout.recipientName}</span>
                        {payout.recipientAddress && (
                          <>
                            <span>·</span>
                            {getAlias(payout.recipientAddress) ? (
                              <span className="inline-flex items-center bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-blue-500/20">
                                {getAlias(payout.recipientAddress)}
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-gray-600">
                                ({payout.recipientAddress.slice(0, 6)}...{payout.recipientAddress.slice(-6)})
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveReceipt(payout)}
                      disabled={payout.status !== "completed"}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-blue-500/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon id={ICON_IDS.download} size={12} />
                      Receipt
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {activeReceipt && (
        <ReceiptModal
          isOpen
          onClose={() => setActiveReceipt(null)}
          receiptData={toReceiptData(activeReceipt)}
        />
      )}
    </>
  );
}

export default RemittanceHistoryModal;
