"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NotificationPreferencesModal } from "./NotificationPreferencesModal";
import { TransactionDetailsModal } from "./TransactionDetailsModal";
import {
  parseNotificationDeepLink,
  type NotificationPreferences,
  type PushEventType,
} from "@/services/notifications";

interface DeepLinkState {
  txHash: string;
  type: PushEventType;
}

/**
 * Mounts push preference + transaction detail modals and watches
 * `?tx=&type=` deep links from notification clicks (#599).
 */
export function PushNotificationProvider({
  children,
  walletAddress,
}: {
  children: React.ReactNode;
  walletAddress?: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [deepLink, setDeepLink] = useState<DeepLinkState | null>(null);

  const openDeepLink = useCallback((txHash: string, type: PushEventType) => {
    setDeepLink({ txHash, type });
  }, []);

  // URL deep link from notification click / shared link
  useEffect(() => {
    const parsed = parseNotificationDeepLink(searchParams);
    if (parsed) {
      openDeepLink(parsed.txHash, parsed.type);
    }
  }, [searchParams, openDeepLink]);

  // Service worker postMessage fallback when navigate() is unavailable
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type !== "SF_PUSH_DEEP_LINK" || !data.url) return;
      try {
        const url = new URL(data.url, window.location.origin);
        const parsed = parseNotificationDeepLink(url.search);
        if (parsed) openDeepLink(parsed.txHash, parsed.type);
      } catch {
        /* ignore */
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [openDeepLink]);

  // Allow other UI (e.g. settings) to open the preferences modal
  useEffect(() => {
    const openPrefs = () => setPrefsOpen(true);
    window.addEventListener("sf:open-push-preferences", openPrefs);
    return () => window.removeEventListener("sf:open-push-preferences", openPrefs);
  }, []);

  const clearDeepLinkFromUrl = useCallback(() => {
    setDeepLink(null);
    if (!searchParams.get("tx")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tx");
    next.delete("type");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const handlePrefsSaved = useCallback((_prefs: NotificationPreferences) => {
    // Preferences are already persisted by the service; hook reserved for analytics.
  }, []);

  return (
    <>
      {children}
      <NotificationPreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        walletAddress={walletAddress}
        onSaved={handlePrefsSaved}
      />
      {deepLink && (
        <TransactionDetailsModal
          isOpen={Boolean(deepLink)}
          onClose={clearDeepLinkFromUrl}
          txHash={deepLink.txHash}
          type={deepLink.type}
        />
      )}
    </>
  );
}

/** Dispatch from any client component to open the preferences modal. */
export function openPushPreferencesModal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sf:open-push-preferences"));
  }
}

export default PushNotificationProvider;
