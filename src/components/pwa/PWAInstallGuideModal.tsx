"use client";

import { Download, Home, Share2, WifiOff, Bell, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "stellarflow-pwa-install-guide-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function mobilePlatform() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
  const android = /Android/i.test(ua) && /Chrome|CriOS/i.test(ua) && !/EdgA|OPR/i.test(ua);
  return ios ? "ios" : android ? "android" : null;
}

/** Shows a native install action on Android and concise Add to Home Screen steps on iOS Safari. */
export function PWAInstallGuideModal() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "true") return;
    const detectedPlatform = mobilePlatform();
    if (!detectedPlatform) return;
    setPlatform(detectedPlatform);

    if (detectedPlatform === "ios") setOpen(true);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (detectedPlatform === "android") setOpen(true);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "true");
    setOpen(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setOpen(false);
  }, [deferredPrompt]);

  if (!open || !platform) return null;
  const ios = platform === "ios";

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/70 p-4 sm:items-center sm:justify-center" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" className="w-full max-w-md rounded-2xl border border-emerald-400/20 bg-neutral-950 p-6 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><Download size={24} /></div>
          <button type="button" onClick={dismiss} className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Close install guide"><X size={20} /></button>
        </div>
        <h2 id="pwa-install-title" className="mt-4 text-xl font-bold text-white">Take StellarFlow with you</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-300">Install the app for faster access, offline account viewing, and timely transfer notifications.</p>

        <ol className="mt-5 space-y-3 text-sm text-neutral-200">
          {ios ? <>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300">1</span><span>Tap <Share2 className="mx-1 inline text-blue-300" size={16} /> <strong>Share</strong> in Safari.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300">2</span><span>Select <Home className="mx-1 inline text-blue-300" size={16} /> <strong>Add to Home Screen</strong>.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-300">3</span><span>Tap <strong>Add</strong> to finish.</span></li>
          </> : <>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">1</span><span>Tap <strong>Install StellarFlow App</strong> below.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">2</span><span>Confirm the browser installation prompt.</span></li>
          </>}
        </ol>
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-white/[.04] p-3 text-xs text-neutral-300"><span className="flex items-center gap-2"><WifiOff size={16} className="text-emerald-300" />Offline access</span><span className="flex items-center gap-2"><Bell size={16} className="text-emerald-300" />Transfer alerts</span></div>
        {ios ? <button type="button" onClick={dismiss} className="mt-5 w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">Got it</button> : <button type="button" onClick={install} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-neutral-950 hover:bg-emerald-300"><Download size={18} />Install StellarFlow App</button>}
      </section>
    </div>
  );
}

export default PWAInstallGuideModal;
