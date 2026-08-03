"use client";

import React, { useEffect, useState } from "react";

export default function OfflinePage() {
  const [online, setOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (online) return;
    const timer = setInterval(() => {
      setOnline(navigator.onLine);
    }, 5000);
    return () => clearInterval(timer);
  }, [online]);

  const handleRetry = () => {
    setRetrying(true);
    setOnline(navigator.onLine);
    setTimeout(() => setRetrying(false), 3000);
  };

  if (online && !retrying) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#39ff14]/10">
            <span className="text-2xl text-[#39ff14]">✓</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">
            You&rsquo;re back online
          </h1>
          <p className="mb-6 text-zinc-400">
            Connection restored. Redirecting you back...
          </p>
          <a
            href="/"
            className="inline-block rounded-lg bg-[#39ff14] px-6 py-2.5 text-sm font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90"
          >
            Go to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-zinc-700">
          <span className="text-3xl text-zinc-500">&#9679;&#9679;&#9679;</span>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-white">
          You&rsquo;re offline
        </h1>
        <p className="mb-8 text-zinc-400">
          Network connection lost. StellarFlow will resume automatically when
          you&rsquo;re back online.
        </p>

        <div className="mb-8 rounded-xl border border-[#1b2a3b] bg-[#0a0f1e]/80 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Network Status</span>
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
              Disconnected
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-full origin-left animate-pulse rounded-full bg-gradient-to-r from-red-500/40 to-red-500/80" />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Auto-reconnecting every 5 seconds...
          </p>
        </div>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mb-4 w-full rounded-lg border border-[#39ff14]/30 bg-[#39ff14]/5 px-6 py-2.5 text-sm font-semibold text-[#39ff14] transition-colors hover:bg-[#39ff14]/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retrying ? "Checking..." : "Retry Connection"}
        </button>

        <a
          href="/"
          className="block text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
        >
          Try going to Dashboard anyway
        </a>
      </div>
    </main>
  );
}
