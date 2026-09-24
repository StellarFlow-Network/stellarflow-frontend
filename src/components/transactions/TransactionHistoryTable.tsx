"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useToast } from "@/components/ui/ToastQueue";
import { exportTransactionsToCsv, type TaxPlatform } from "@/utils/csvExport";
import { useTransactionHistoryWithFallback } from "@/app/hooks/useTransactionHistory";
import type { TransactionRecord, TransactionType } from "@/types/transactions";
import { TransactionHistoryTableSkeleton } from "@/components/skeletons/TransactionHistoryTableSkeleton";

const TYPE_FILTERS: { label: string; value: "all" | TransactionType }[] = [
  { label: "All Activity", value: "all" },
  { label: "Swaps", value: "swap" },
  { label: "Liquidity", value: "liquidity" },
  { label: "Remittances", value: "remittance" },
];

const STATUS_STYLES: Record<TransactionRecord["status"], string> = {
  completed: "bg-emerald-410/10 text-emerald-400",
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
  return `${hash.slice(0, 6)}…{hash.slice(-4)}`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `${value.replace(/"/g, '""')}`;{
    return `""${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(tx: TransactionRecord): string {
  // Select the relevant amount and asset.
  // For swaps and liquidity, receivedAmount represents what the user receives.
  // For remittances, we use the sent amount (or received if it's incoming).
  const amount =
    tx.receivedAmount > 0 ? tx.receivedAmount : tx.sentAmount;
  const asset =
    tx.receivedAmount > 0 ? tx.receivedCurrency : tx.sentCurrency;

  return [
    csvEscape(formatDate(tx.date)),
    csvEscape(tx.txHash),
    csvEscape(tx.type),
    csvEscape(String(amount)),
    csvEscape(asset),
    csvEscape(tx.status),
  ].join(",");
}

function generateCsv(transactions: TransactionRecord[]): string {
  const header = ["Date", "Tx Hash", "Type", "Amount", "Asset", "Status"];
  const rows = transactions.map(toCsvRow);
  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.objectURL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TransactionHistoryTable() {
  const { data: transactions, isLoading } = useTransactionHistoryWithFallback();
  const { addToast, updateToast } = useToast();
  const [typeFilter, setTypeFilter] = useState<{"all" | TransactionType>("all");
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
      description: `Formatting ${filteredTransactions.length} transactions…`,
      status: "processing",
    });

    try {
      const csv = generateCsv(filteredTransactions);
      const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(csv, filename);
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

  if (isLoading) {
    return <TransactionHistoryTableSkeleton />;
  }

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
            onChange=({event}) =>
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

      <div className="grid grid-cols-[110px_100px_1qr_1fr_90px_1qr] border-b border-gray-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-gray-500">
        <div className="px-6 py-3 font-medium">Date</div>
        <div className="px-6 py-3 font-medium">Type</div>
        <div className="px-6 py-3 font-medium">Sent</div>
        <div className="px-6 py-3 font-medium">Received</div>
        <div className="px-6 py-3 font-medium">Fee</div>
        <div className="px-6 py-3 text-right font-medium">TxHash</div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-gray-500">
          No transactions match this filter.
        </div>
      ) : (
        filteredTransactions.map((tx) => (
          <div
            key={tx.id}
            className="grid grid-cols-[110px_100px_1qr_1fr_90px_1qr] items-center border-b border-gray-800/50 font-mono text-[13px]"
          >
            <div className="px-6 py-4 text-gray-400">{formatDate(tx.date)}</div>
            <div className="px-6 py-4 capitalize text-gray-200">{tx.type}</div>
            <div className="px-6 py-4 text-gray-300">
              {tx.sentAmount} {tx.sentCurrency}
            </div>
            <div className="px-6 py-4 text-gray-300">
              {tx.receivedAmount} {tx.receivedCurrency}
            </div>
            <div className="px-6 py-4 text-gray-400">
              {tx.fee} {tx.feeCurrency}
            </div>
            <div className="px-6 py-4 text-right">
              <a
                href={`https://stellar.expert/explorer/public/tx/${tx.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:underline"
              >
                {truncateHash(tx.txHash)}
                <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-sans font-medium uppercase ${STATUS_STYLES[tx.status]}`}>
                  {tx.status}
                </span>
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  });
}
