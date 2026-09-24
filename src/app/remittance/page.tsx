"use client";

import React, { useState } from "react";
import { FxRateTicker, FxComparisonTable, FiatOnRampModal } from "@/components/remittance";
import { useOptionalWallet, useOptionalWalletActions } from "@/app/components/providers/WalletProvider";
import { CreditCard, Wallet } from "lucide-react";

export default function RemittancePage() {
  const walletState = useOptionalWallet();
  const walletActions = useOptionalWalletActions();
  const wallet = walletState?.wallet;
  const [isOnRampOpen, setIsOnRampOpen] = useState(false);

  const walletAddress = wallet?.publicKey || "";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      <div className="mb-8 border-b border-neutral-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Remittance & FX Corridors
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Live fiat conversion rates and a fee comparison against traditional money transfer
            operators for StellarFlow&apos;s cross-border remittance corridors.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!walletAddress) {
              alert("Please connect your Stellar wallet first to fund your account.");
              return;
            }
            setIsOnRampOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 shrink-0"
        >
          <CreditCard size={18} />
          <span>Fund Account / Buy Crypto</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl-grid-cols-3">
        <div className="xl-col-span-1">
          <FxRateTicker />
        </div>
        <div className="xl-col-span-2">
          <FxComparisonTable />
        </div>
      </div>

      {isOnRampOpen && walletAddress && (
        <FiatOnRampModal
          isOpen={isOnRampOpen}
          onClose={() => setIsOnRampOpen(false)}
          walletAddress={walletAddress}
          assetCode="XLM"
          onRefreshBalance={async () => {
            await walletActions?.refreshWalletState();
          }}
        />
      )}
    </div>
  );
}

