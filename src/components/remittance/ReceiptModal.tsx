"use client";

import React, { useState } from "react";
import { downloadRemittanceReceiptPdf } from "@/lib/remittanceReceiptPdf";

export interface ReceiptData {
  transactionHash: string;
  anchorReference: string;
  anchorName?: string;
  amountSent: string;
  amountReceived: string;
  exchangeRate: string;
  fees: string;
  timestamp: string;
  senderName?: string;
  recipientName?: string;
  recipientAddress?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData;
}

/**
 * Printable / downloadable receipt for a completed remittance payout.
 *
 * The visible card doubles as the print layout: `.receipt-print-area` is the
 * only thing left visible by the `@media print` rule below, so clicking
 * "Print" hands the browser's native print dialog a clean receipt without a
 * separate render pass. "Download PDF" renders the same data through jsPDF
 * client-side (see `remittanceReceiptPdf.ts`) — both actions run entirely in
 * the browser, so there's no server round-trip or SSR hydration risk.
 */
export function ReceiptModal({ isOpen, onClose, receiptData }: ReceiptModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
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

  const alias = receiptData.recipientAddress
    ? contacts.find(c => c.address === receiptData.recipientAddress)?.alias
    : null;

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadRemittanceReceiptPdf(receiptData);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:relative print:z-auto print:bg-transparent print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area { position: absolute; inset: 0; box-shadow: none !important; }
          .receipt-no-print { display: none !important; }
        }
      `}</style>

      <div className="receipt-print-area w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Transaction Complete
          </h2>
          <button
            onClick={onClose}
            className="receipt-no-print text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label="Close receipt"
          >
            &times;
          </button>
        </div>

        <div className="mb-8 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your cross-border payment was successful. You can print or download
            the official receipt for your records.
          </p>
          <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-900">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {receiptData.anchorName && (
                <>
                  <span className="text-gray-500">Anchor:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {receiptData.anchorName}
                  </span>
                </>
              )}
              <span className="text-gray-500">Reference:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {receiptData.anchorReference}
              </span>
              <span className="text-gray-500">Recipient Name:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {receiptData.recipientName || "—"}
              </span>
              <span className="text-gray-500">Recipient Address:</span>
              <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                {alias ? (
                  <span className="inline-flex items-center bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-blue-500/20">
                    {alias}
                  </span>
                ) : (
                  receiptData.recipientAddress ? `${receiptData.recipientAddress.slice(0, 6)}...${receiptData.recipientAddress.slice(-6)}` : "—"
                )}
              </span>
              <span className="text-gray-500">Amount Sent:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {receiptData.amountSent}
              </span>
              <span className="text-gray-500">Amount Received:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {receiptData.amountReceived}
              </span>
              <span className="text-gray-500">Exchange Rate:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {receiptData.exchangeRate}
              </span>
            </div>
          </div>
        </div>

        <div className="receipt-no-print flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/30"
          >
            Print
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloading ? "Generating PDF..." : "Download Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReceiptModal;
