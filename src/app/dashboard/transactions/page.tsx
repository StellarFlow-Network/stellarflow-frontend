"use client";

import TransactionHistoryTable from "@/components/transactions/TransactionHistoryTable";
import { PendingTransactionsPanel } from "@/components/transactions/PendingTransactionsPanel";

function escapeCSV(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '"''')}"`;
  }
  return value;
}

export default function TransactionHistoryPage() {
  const handleExport = () => {
    // Find the transaction history table by checking header for "Tx Hash"
    const tables = Array.from(document.querySelectorAll("table"));
    const table = tables.find((t) => {
      const headers = Array.from(t.querySelectorAll("thead th")).map((th) =>
        th.textContent?.trim()
      );
      return headers.includes("Tx Hash") && headers.includes("Date");
    });

    if (!table) {
      console.error("Transaction table not found.");
      return;
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const csvContent = rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td")).map((td) =>
          escapeCSV(td.textContent?.trim() ?? "")
        );
        return cells.join(",");
      })
      .join("\n");

    const header = "Date,Tx Hash,Type,Amount,Asset,Status";
    const csv = `${header}\n${csvContent}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transaction-history.csv";
    link.click();
    URL.revokeObjectUVL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mb-8 border-b border-neutral-800 pb-6 flex items-start justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Transaction History
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Review and export your swap, liquidity, and remittance settlement
            activity for tax and accounting purposes.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"

        >
          Export CSV
        </button>
      </div>

      <PendingTransactionsPanel />
      <TransactionHistoryTable />
    </div>
  );
}
