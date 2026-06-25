"use client";

import React, { memo, useCallback } from "react";
import OptimizedImage from "./OptimizedImage";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Icon, ICON_IDS } from "@/components/icons";
import { useProgressBar } from "./TopLoadingBar";
import { useWallet, useWalletStatus, useWalletActions } from "../hooks/useWalletState";

const WalletConnectButton = memo(() => {
  const { wallet } = useWallet();
  const { isChecking } = useWalletStatus();
  const { refreshWalletState } = useWalletActions();
  const { start, done } = useProgressBar();

  const walletLabel = wallet?.connected
    ? wallet.publicKey
      ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}`
      : "Wallet connected"
    : "Connect Wallet";

  const handleConnectWallet = useCallback(async () => {
    start();
    const state = await refreshWalletState();
    done();

    if (state?.connected) {
      alert(`Connected wallet: ${state.publicKey ?? "unknown"}`);
    } else {
      alert("No active Stellar wallet detected. Please connect your extension.");
    }
  }, [refreshWalletState, start, done]);

  return (
    <button
      onClick={handleConnectWallet}
      disabled={isChecking}
      className="wallet-btn group flex min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4 py-2 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl active:scale-95 whitespace-nowrap"
    >
      <Icon id={ICON_IDS.wallet} size={18} className="transition-transform group-hover:rotate-12" />
      <span className="truncate">{walletLabel}</span>
    </button>
  );
});
WalletConnectButton.displayName = "WalletConnectButton";

const Nav = memo(() => {
  const hasAnomaly = true;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <main className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-nowrap items-center justify-between gap-3">
        {/* Left Side: Logo + Title */}
        <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden">
          {/* StellarFlow Logo — optimized WebP with next/image (Issue #46) */}
          <div className="shrink-0" style={{ aspectRatio: "1 / 1", width: 48, height: 48 }}>
            <OptimizedImage
              src="/sf.webp"
              alt="StellarFlow Logo"
              width={48}
              height={48}
              className="rounded-full object-contain"
              priority
              quality={90}
              sizes="48px"
            />
          </div>

          {/* Title */}
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tighter leading-none">
            Impact Oracle: <span className="text-[#99DC1B]">Africa</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WalletConnectButton />

          <button
            aria-label="System anomaly alerts"
            className="relative p-2 rounded-xl hover:bg-zinc-800 transition-colors high-frequency-badge"
            onClick={() =>
              alert("View current system anomalies (implement dashboard logic)")
            }
          >
            <Icon id={ICON_IDS.bell} size={20} className="text-slate-200" />
            {hasAnomaly && (
              <span className="absolute -top-1 -right-1 inline-flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
              </span>
            )}
          </button>

          <Link
            href="/admin/settings"
            prefetch={false}
            onFocus={() => router.prefetch('/admin/settings')}
            onMouseEnter={() => {
              if (pathname !== '/admin/settings') router.prefetch('/admin/settings')
            }}
            onPointerEnter={() => {
              if (pathname !== '/admin/settings') router.prefetch('/admin/settings')
            }}
            aria-label="Admin settings"
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <Icon id={ICON_IDS.user} size={20} className="text-slate-200" />
          </Link>

          <button
            aria-label="Sign out"
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
            onClick={() => alert("Sign out (implement)")}
          >
            <Icon id={ICON_IDS.logOut} size={20} className="text-slate-200" />
          </button>
        </div>
      </div>
    </main>
  );
});

Nav.displayName = "Nav";

export default Nav;
