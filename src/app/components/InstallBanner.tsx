"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "stellarflow-install-banner-dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt" as keyof WindowEventMap, handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt" as keyof WindowEventMap, handler as EventListener);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  if (dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-xl border border-[#1b2a3b] bg-[#0a0f1e]/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#39ff14]/10">
          <span className="text-lg font-bold text-[#39ff14]">SF</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            Install StellarFlow App
          </p>
          <p className="truncate text-xs text-zinc-400">
            Add to home screen for the best experience
          </p>
        </div>

        <button
          onClick={handleInstall}
          className="rounded-lg bg-[#39ff14] px-3 py-1.5 text-xs font-semibold text-[#0a0f1e] transition-colors hover:bg-[#39ff14]/90"
        >
          Install
        </button>

        <button
          onClick={handleDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Dismiss install banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
