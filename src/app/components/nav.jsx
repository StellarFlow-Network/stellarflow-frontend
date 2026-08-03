"use client";

import React, { memo, useCallback } from "react";
import OptimizedImage from "./OptimizedImage";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useProgressBar } from "./TopLoadingBar";
import dynamic from "next/dynamic";
import MobileMenu from "@/components/navigation/MobileMenu";

// Lazily load the wallet connect button + WalletProvider.
// WalletProvider pulls in the entire wallet context + @stellar/freighter-api
// browser extension bridge; deferring it keeps that code out of the initial
// nav chunk and off the critical path for first contentful paint.
const WalletConnectButton = dynamic(
  () => import("./WalletConnectButton"),
  {
    ssr: false,
    // Static placeholder that matches the button's shape to avoid layout shift
    loading: () => (
      <div className="wallet-btn flex min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4 py-2 rounded-2xl text-sm sm:text-base whitespace-nowrap opacity-60 pointer-events-none">
        <Icon id={ICON_IDS.wallet} size={18} />
        <span className="truncate">Connect Wallet</span>
      </div>
    ),
  }
);

// RPC health pill polls Horizon/Soroban on an interval — keep it out of the
// initial nav chunk and off the critical path for first contentful paint.
const RpcHealthIndicator = dynamic(
  () => import("@/components/rpc/RpcHealthIndicator").then((m) => m.RpcHealthIndicator),
  { ssr: false, loading: () => null },
);

const Nav = memo(() => {
  const hasAnomaly = true;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <main className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-nowrap items-center justify-between gap-3">
        {/* Left Side: Logo + Title */}
        <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden">
          <MobileMenu />
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
          <RpcHealthIndicator className="hidden sm:block" />
          <WalletConnectButton />

          <button
            aria-label="System anomaly alerts"
            className="relative p-2 rounded-xl hover:bg-zinc-800 transition-colors high-frequency-badge hidden md:inline-flex"
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
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors hidden md:inline-flex"
          >
            <Icon id={ICON_IDS.user} size={20} className="text-slate-200" />
          </Link>

          <button
            aria-label="Sign out"
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors hidden md:inline-flex"
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
