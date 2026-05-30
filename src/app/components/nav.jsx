"use client";

import React, { memo, useCallback } from "react";
import OptimizedImage from "./OptimizedImage";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Wallet, Bell, CircleUser, LogOut } from "lucide-react";
import { useProgressBar } from "./TopLoadingBar";

// ─── Modal Dialog Components ───────────────────────────────────────────────

const ConnectWalletModal = React.memo(({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="bg-[#0c0f1d] border border-zinc-800 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(153,220,27,0.1),transparent_50%)] pointer-events-none" />
        <h2 className="text-xl font-bold mb-2 text-white">Connect Wallet</h2>
        <p className="text-xs text-zinc-400 mb-6">Select your preferred Stellar network wallet gateway to authorize credentials.</p>
        
        <div className="space-y-3">
          <button onClick={() => { alert("Freighter Wallet connected"); onClose(); }} className="w-full bg-zinc-900/60 border border-zinc-800 hover:border-[#99DC1B]/50 hover:bg-zinc-800/80 rounded-2xl py-3 px-4 font-semibold text-sm transition-all duration-300 flex items-center justify-between text-left">
            <span>Freighter Wallet</span>
            <span className="text-[10px] bg-[#99DC1B]/10 text-[#99DC1B] border border-[#99DC1B]/20 rounded-full px-2.5 py-0.5">Recommended</span>
          </button>
          
          <button onClick={() => { alert("Albedo Wallet connected"); onClose(); }} className="w-full bg-zinc-900/60 border border-zinc-800 hover:border-[#99DC1B]/50 hover:bg-zinc-800/80 rounded-2xl py-3 px-4 font-semibold text-sm transition-all duration-300 flex items-center justify-between text-left">
            <span>Albedo</span>
            <span className="text-[10px] text-zinc-500 font-normal">Web-based</span>
          </button>
        </div>

        <button onClick={onClose} className="mt-6 w-full py-2.5 text-xs text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 rounded-2xl hover:bg-zinc-900/60 transition-all font-semibold uppercase tracking-wider">
          Close Gateway
        </button>
      </div>
    </div>
  );
});
ConnectWalletModal.displayName = "ConnectWalletModal";

const AnomalyAlertsModal = React.memo(({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="bg-[#0c0f1d] border border-red-950/40 rounded-3xl p-6 max-w-md w-full mx-4 shadow-[0_24px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.1),transparent_50%)] pointer-events-none" />
        <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          System Anomaly Alerts
        </h2>
        <p className="text-xs text-zinc-400 mb-6">Real-time telemetry indicators indicating active consensus deviations or faults.</p>
        
        <div className="space-y-3 font-mono text-xs max-h-48 overflow-y-auto pr-1">
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl">
            <div className="flex justify-between text-red-400 font-bold mb-1">
              <span>CRITICAL_DEVIATION</span>
              <span>12:28:10</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">Binance Pan-Africa Relayer reported 540ms latency surge, exceeding the deviation threshold.</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl">
            <div className="flex justify-between text-yellow-400 font-bold mb-1">
              <span>WARN_FAILOVER</span>
              <span>12:30:45</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">Regional consensus failover active: Traffic routed to Frankfurt Secondary nodes.</p>
          </div>
        </div>

        <button onClick={onClose} className="mt-6 w-full py-2.5 text-xs text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 rounded-2xl hover:bg-zinc-900/60 transition-all font-semibold uppercase tracking-wider">
          Acknowledge & Close
        </button>
      </div>
    </div>
  );
});
AnomalyAlertsModal.displayName = "AnomalyAlertsModal";

// ─── Main Nav Component ─────────────────────────────────────────────────────

const Nav = memo(() => {
  const hasAnomaly = true;
  const router = useRouter();
  const pathname = usePathname();
  const { start, done } = useProgressBar();

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isAnomalyOpen, setIsAnomalyOpen] = useState(false);

  const handleConnectWallet = useCallback(async () => {
    start();
    await new Promise((resolve) => setTimeout(resolve, 600));
    done();
    setIsWalletOpen(true);
  }, [start, done]);

  const handleOpenAnomaly = useCallback(() => {
    setIsAnomalyOpen(true);
  }, []);

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
          <button
            onClick={handleConnectWallet}
            className="wallet-btn group flex min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4 py-2 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl active:scale-95 whitespace-nowrap"
          >
            <Wallet className="w-5 h-5 transition-transform group-hover:rotate-12" />
            <span className="truncate">
              Connect <span className="hidden md:inline">Wallet</span>
            </span>
          </button>

          <button
            aria-label="System anomaly alerts"
            className="relative p-2 rounded-xl hover:bg-zinc-800 transition-colors"
            onClick={handleOpenAnomaly}
          >
            <Bell className="w-6 h-6 text-slate-200" />
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
            <CircleUser className="w-6 h-6 text-slate-200" />
          </Link>

          <button
            aria-label="Sign out"
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
            onClick={() => alert("Sign out (implement)")}
          >
            <LogOut className="w-6 h-6 text-slate-200" />
          </button>
        </div>
      </div>

      {/* ─── State-Driven Modals (Clean mount/unmount via short-circuit rendering) ─── */}
      {isWalletOpen && <ConnectWalletModal onClose={() => setIsWalletOpen(false)} />}
      {isAnomalyOpen && <AnomalyAlertsModal onClose={() => setIsAnomalyOpen(false)} />}
    </main>
  );
});

Nav.displayName = "Nav";

export default Nav;
