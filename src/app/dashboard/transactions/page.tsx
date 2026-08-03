"use client";

import TransactionHistoryTable from "@/components/transactions/TransactionHistoryTable";

export default function TransactionHistoryPage() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mb-8 border-b border-neutral-800 pb-6">
        <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Transaction History
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Review and export your swap, liquidity, and remittance settlement
          activity for tax and accounting purposes.
        </p>
      </div>

      <TransactionHistoryTable />
    </div>
  );
}
