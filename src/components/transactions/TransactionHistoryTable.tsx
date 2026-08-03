"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";
import { exportTransactionsToCsv } from "@/utils/csvExport";
import { useTransactionHistoryWithFallback } from "@/app/hooks/useTransactionHistory";
import type { TransactionRecord, TransactionType } from "@/types/transactions";

const TYPE_FILTERS: { label: string; value: "all" | TransactionType }[] = [
  { label: "All Activity", value: "all" },
  { label: "Swaps", value: "swap" },
  { label: "Liquidity", value: "liquidity" },
  { label: "Remittances", value: "remittance" },
];

const STATUS_STYLES: Record<TransactionRecord["status"], string> = {
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

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export default function TransactionHistoryTable() {
  const { data: transactions, isLoading } = useTransactionHistoryWithFallback();
  const { addToast, updateToast } = useToast();
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [isExporting, setIsExporting] = useState(false);

  const filteredTransactions = useMemo(
    () =>
      typeFilter === "all"
        ? transactions
        : transactions.filter((tx) => tx.type === typeFilter),
    [transactions, typeFilter],
  );

  const handleExport = async () => {
    if (isExporting || filteredTransactions.length === 0) return;

    setIsExporting(true);
    const toastId = addToast({
      title: "Preparing CSV export",
      description: `Formatting ${filteredTransactions.length} transactions for download…`,
      status: "processing",
    });

    try {
      await exportTransactionsToCsv(filteredTransactions);
      updateToast(toastId, {
        title: "Export ready",
        description: `${filteredTransactions.length} transactions downloaded as CSV.`,
        status: "confirmed",
      });
    } catch {
      updateToast(toastId, {
        title: "Export failed",
        description: "Could not generate the CSV file. Please try again.",
        status: "failed",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] text-gray-100">
      <div className="flex flex-col gap-4 border-b border-gray-800 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Transaction History</h2>
          <p className="text-sm text-gray-500">
            Swaps, liquidity provision, and remittance settlements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "all" | TransactionType)
            }
            className="rounded-md border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
          >
            {TYPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || filteredTransactions.length === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#161b22] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon id={ICON_IDS.download} size={16} />
            {isExporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[110px_100px_1fr_1fr_90px_1fr] border-b border-gray-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-gray-500">
        <div className="px-6 py-3 font-medium">Date</div>
        <div className="px-6 py-3 font-medium">Type</div>
        <div className="px-6 py-3 font-medium">Sent</div>
        <div className="px-6 py-3 font-medium">Received</div>
        <div className="px-6 py-3 font-medium">Fee</div>
        <div className="px-6 py-3 text-right font-medium">TxHash</div>
      </div>

      {isLoading ? (
        <div className="px-6 py-16 text-center text-sm text-gray-500">
          Loading transaction history…
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-gray-500">
          No transactions match this filter.
        </div>
      ) : (
        filteredTransactions.map((tx) => (
          <div
            key={tx.id}
            className="grid grid-cols-[110px_100px_1fr_1fr_90px_1fr] items-center border-b border-gray-800/50 font-mono text-[13px]"
          >
            <div className="px-6 py-4 text-gray-400">{formatDate(tx.date)}</div>
            <div className="px-6 py-4 capitalize text-gray-200">{tx.type}</div>
            <div className="px-6 py-4 text-gray-200">
              {tx.sentAmount.toLocaleString()} {tx.sentCurrency}
            </div>
            <div className="px-6 py-4 text-gray-200">
              {tx.receivedAmount.toLocaleString()} {tx.receivedCurrency}
            </div>
            <div className="px-6 py-4 text-gray-400">
              {tx.fee} {tx.feeCurrency}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[tx.status]}`}
              >
                {tx.status}
              </span>
              <span className="text-blue-500">{truncateHash(tx.txHash)}</span>
            </div>
          </div>
        ))
      )}

      <div className="flex items-center justify-between border-t border-gray-800 p-4 text-sm text-gray-500">
        <span>
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </span>
      </div>
    </div>
  );
}
