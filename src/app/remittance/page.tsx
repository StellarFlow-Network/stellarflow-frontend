"use client";

import React, { useState } from "react";
import { CorridorStatusMap, FxRateTicker, FxComparisonTable, FiatOnRampModal, SEP24InteractiveModal, type RemittanceCorridor } from "@/components/remittance";
import { RedeemNoteForm } from "@/components/remittance/RedeemNoteForm";
import { ShieldedDepositModal } from "@/components/remittance/ShieldedDepositModal";
import { useOptionalWallet, useOptionalWalletActions } from "@/app/components/providers/WalletProvider";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, CreditCard, LockKeyhole, Send, ShieldAlert } from "lucide-react";
import type { SEP24Operation } from "@/lib/sep24Interactive";

export default function RemittancePage() {
  const walletState = useOptionalWallet();
  const walletActions = useOptionalWalletActions();
  const wallet = walletState?.wallet;
  const [isOnRampOpen, setIsOnRampOpen] = useState(false);
  const [isSEP24Open, setIsSEP24Open] = useState(false);
  const [isShieldedDepositOpen, setIsShieldedDepositOpen] = useState(false);
  const [sep24Operation, setSEP24Operation] = useState<SEP24Operation>("deposit");
  const [selectedCorridor, setSelectedCorridor] = useState<RemittanceCorridor | null>(null);

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!walletAddress) {
                alert("Please connect your Stellar wallet first to fund your account.");
                return;
              }
              setIsOnRampOpen(true);
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-violet-500 active:scale-95"
          >
            <CreditCard size={18} />
            <span>Fund Account</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSEP24Operation("deposit");
              setIsSEP24Open(true);
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-lime-300/25 bg-lime-300/[0.07] px-4 text-sm font-medium text-lime-200 transition-colors hover:bg-lime-300/15"
          >
            <ArrowDownToLine size={17} /> SEP-24 Deposit
          </button>
          <button
            type="button"
            onClick={() => {
              setSEP24Operation("withdrawal");
              setIsSEP24Open(true);
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/5"
          >
            <ArrowUpFromLine size={17} /> SEP-24 Withdraw
          </button>
          <Link
            href="/remittance/send"
            data-testid="remittance-send-cta"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300"
          >
            <Send size={17} /> Send Money
          </Link>
        </div>
      </div>

      {selectedCorridor && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-400/30 bg-blue-400/10 p-4">
          <p className="text-sm text-blue-100">Remittance wizard ready for <strong>{selectedCorridor.destinationCountry}</strong>. Continue to choose funding and payout details.</p>
          <button type="button" onClick={() => setIsOnRampOpen(true)} className="rounded-lg bg-blue-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-blue-300">Continue transfer</button>
        </div>
      )}

      <div className="mb-6">
        <CorridorStatusMap onCorridorSelect={setSelectedCorridor} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl-grid-cols-3">
        <div className="xl-col-span-1">
          <FxRateTicker />
        </div>
        <div className="xl-col-span-2">
          <FxComparisonTable />
        </div>
      </div>

      <section aria-labelledby="private-remittance-title" className="mt-12 space-y-5">
        <header className="flex flex-col justify-between gap-4 border-b border-neutral-800 pb-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-lime-300">Privacy tools</p>
            <h2 id="private-remittance-title" className="text-2xl font-semibold tracking-tight text-white">
              Shielded remittance
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
              Create and verify a private recovery note on this device. A checksum protects note integrity; a live ZK prover and shielded pool are required to move funds privately.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 text-neutral-300">
              <ShieldAlert size={14} /> Public transfer · network-visible
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/[0.06] px-3 text-amber-200">
              <LockKeyhole size={14} /> Shielded pool · not connected
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="flex flex-col items-start rounded-xl border border-white/10 bg-[#101713] p-5 text-white sm:p-6">
            <div className="mb-4 flex w-full items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">Deposit</p>
                <h3 className="mt-1 text-lg font-semibold">Create a recovery note</h3>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">
                Local note only
              </span>
            </div>
            <p className="mb-5 max-w-lg text-sm leading-relaxed text-white/60">
              Generate a random secret and its commitment, then keep an encrypted or offline backup. This does not deposit XLM or create a zero-knowledge proof.
            </p>
            <button
              type="button"
              onClick={() => setIsShieldedDepositOpen(true)}
              className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-lime-200"
            >
              <LockKeyhole size={17} /> Create deposit note
            </button>
          </div>

          <RedeemNoteForm />
        </div>
      </section>

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
      <SEP24InteractiveModal
        isOpen={isSEP24Open}
        onClose={() => setIsSEP24Open(false)}
        account={walletAddress}
        assetCode="XLM"
        initialOperation={sep24Operation}
        onRefresh={async () => {
          await walletActions?.refreshWalletState();
        }}
      />
    </div>
  );
}

