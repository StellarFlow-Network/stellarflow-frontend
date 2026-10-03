"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import PortfolioSummary from "@/components/analytics/PortfolioSummary";
import { ReceiveAssetModal } from "@/components/portfolio/ReceiveAssetModal";
import { WalletProvider } from "@/app/components/providers/WalletProvider";

/**
 * The Receive affordance needs the active Stellar public key, which lives in
 * `WalletProvider`. The dashboard routes sit outside the nav bar that normally
 * mounts it, so wrap just this subtree rather than the whole page.
 */
function ReceiveButton() {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <WalletProvider>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-100 transition-colors hover:border-neutral-600 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Download size={16} aria-hidden />
        Receive
      </button>

      <ReceiveAssetModal isOpen={isOpen} onClose={close} />
    </WalletProvider>
  );
}

export default function PortfolioTrackerPage() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Portfolio Tracker
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Aggregate net worth, allocation, and yield performance across your
            wallet, liquidity pools, and vaults.
          </p>
        </div>

        <ReceiveButton />
      </div>

      <PortfolioSummary />
    </div>
  );
}
