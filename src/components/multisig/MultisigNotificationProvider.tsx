"use client";

/**
 * MultisigNotificationProvider (#962)
 *
 * Watches the realtime channel for multisig envelopes that are waiting on the
 * connected wallet's signature and keeps a live queue of them, so the top-bar
 * badge can show how many transactions are blocked on this co-signer.
 *
 * Event sources (all funnel into the same reducer):
 *  1. `/ws` realtime frames relayed by {@link WebSocketManager}
 *     (`multisig_signature_request` / `multisig_signature_resolved`),
 *  2. the in-app bus (`sf:multisig-signature-request`) — used by the multisig
 *     page when a co-ordinator submits an envelope, and by other tabs through
 *     the mirrored localStorage queue,
 *  3. the service worker, which re-broadcasts a push while a tab is open.
 *
 * New requests also raise a browser notification (opt-in, see the
 * "Multisig Signature Requests" preference) deep linking into the approval
 * drawer. The queue is persisted so a reload does not lose the counter.
 *
 * Subscribe-only by design: the provider deliberately does not call
 * `WebSocketManager.addConsumer()`, so mounting it globally does not force a
 * socket connection on pages that never needed one. When the app has a live
 * realtime channel (any page using `useSocket`) the frames arrive here too.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useOptionalWallet } from "@/app/components/providers/WalletProvider";
import { loadPreferences } from "@/services/notifications";
import { WebSocketManager } from "@/utils/WebSocketManager";
import {
  DEMO_CO_SIGNER_PUBLIC_KEY,
  buildDemoSignatureRequests,
  buildMultisigApprovalDeepLink,
  filterPendingSignatureRequests,
  isAwaitingSignature,
  isMultisigDemoMode,
  isRequestTargetingSigner,
  loadCachedSignatureRequests,
  markSignatureRequestResolved,
  mergeSignatureRequests,
  notifySignerOfSignatureRequest,
  parseMultisigSocketEvent,
  publishSignatureResolution,
  removeSignatureRequest,
  saveCachedSignatureRequests,
  subscribeToServiceWorkerSignatureRequests,
  subscribeToSignatureRequestEvents,
  type MultisigSignatureRequest,
} from "@/services/multisigNotifications";

export interface MultisigNotificationContextValue {
  /** Every tracked envelope, resolved ones included. */
  requests: MultisigSignatureRequest[];
  /** Envelopes still waiting on this signer, newest first. */
  pendingRequests: MultisigSignatureRequest[];
  /** Badge counter — what the top-bar pill renders. */
  pendingCount: number;
  /**
   * Public key the queue is scoped to. Falls back to the demo co-signer key
   * while {@link MultisigNotificationProviderProps.enableDemoSeed} is on and no
   * wallet has ever connected, matching the demo envelopes on `/multisig`.
   */
  signerPublicKey: string | null;
  /** Record a local approval so the badge drops without waiting for the server. */
  acknowledgeRequest: (requestId: string, collectedWeight?: number) => void;
  /** Forget an envelope (executed, rejected or expired). */
  dismissRequest: (requestId: string) => void;
  /** Open the multisig approval drawer, optionally focused on one envelope. */
  openApprovalDrawer: (requestId?: string | null) => void;
}

const MultisigNotificationContext =
  createContext<MultisigNotificationContextValue | null>(null);

export interface MultisigNotificationProviderProps {
  children: React.ReactNode;
  /** Override the tracked signer; defaults to the connected wallet's key. */
  signerPublicKey?: string | null;
  /**
   * Seed the demo envelopes from `buildDemoSignatureRequests` when the queue is
   * empty, so the counter is exercisable before the backend streams real
   * requests. Defaults to the app-wide demo mode (`!NEXT_PUBLIC_API_URL`), so a
   * configured backend never shows fabricated pending transactions.
   */
  enableDemoSeed?: boolean;
  /** Raise browser push alerts for incoming requests. Defaults to true. */
  enablePushAlerts?: boolean;
}

export function MultisigNotificationProvider({
  children,
  signerPublicKey,
  enableDemoSeed,
  enablePushAlerts = true,
}: MultisigNotificationProviderProps) {
  const router = useRouter();
  const wallet = useOptionalWallet();
  const demoSeed = enableDemoSeed ?? isMultisigDemoMode();

  const [requests, setRequests] = useState<MultisigSignatureRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Ids we have already surfaced (hydrated, pushed or merged) so a re-broadcast
  // of the same envelope never fires a second notification.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const signerKeyRef = useRef<string | null>(null);

  const walletPublicKey = wallet?.wallet?.publicKey ?? null;

  const resolvedSignerPublicKey = useMemo(() => {
    if (signerPublicKey) return signerPublicKey;
    if (walletPublicKey) return walletPublicKey;
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("stellarflow.wallet.publicKey");
    } catch {
      return null;
    }
  }, [signerPublicKey, walletPublicKey]);

  // With no wallet at all the queue is scoped to the same placeholder key the
  // demo envelopes on `/multisig` use, so the badge is exercisable before the
  // backend streams real requests. Turn off via `enableDemoSeed={false}`.
  const trackedSignerPublicKey =
    resolvedSignerPublicKey ?? (demoSeed ? DEMO_CO_SIGNER_PUBLIC_KEY : null);

  // Keep the ref the realtime handlers read in sync before the hydration effect
  // below runs (effects fire in declaration order).
  useEffect(() => {
    signerKeyRef.current = trackedSignerPublicKey;
  }, [trackedSignerPublicKey]);

  // Hydrate from the mirrored queue, falling back to the demo seed.
  useEffect(() => {
    if (!trackedSignerPublicKey) {
      setRequests([]);
      setHydrated(true);
      return;
    }

    const cached = loadCachedSignatureRequests().filter((request) =>
      isRequestTargetingSigner(request, trackedSignerPublicKey),
    );
    const initial =
      cached.length > 0
        ? cached
        : demoSeed
          ? buildDemoSignatureRequests(trackedSignerPublicKey)
          : [];

    seenIdsRef.current = new Set(initial.map((request) => request.id));
    setRequests(initial);
    setHydrated(true);
  }, [trackedSignerPublicKey, demoSeed]);

  // Mirror the queue so reloads (and other tabs) keep the same counter.
  useEffect(() => {
    if (!hydrated || !signerKeyRef.current) return;
    saveCachedSignatureRequests(requests);
  }, [requests, hydrated]);

  const ingest = useCallback(
    (incoming: MultisigSignatureRequest[]) => {
      const signer = signerKeyRef.current;
      const targeted = incoming.filter((request) =>
        isRequestTargetingSigner(request, signer),
      );
      if (targeted.length === 0) return;

      const prefs = enablePushAlerts ? loadPreferences() : null;

      for (const request of targeted) {
        if (seenIdsRef.current.has(request.id)) continue;
        seenIdsRef.current.add(request.id);
        if (prefs && isAwaitingSignature(request, signer)) {
          // Fire-and-forget: a blocked or unsupported notification must never
          // stop the in-app badge from updating.
          void notifySignerOfSignatureRequest(request, prefs);
        }
      }

      setRequests((prev) => mergeSignatureRequests(prev, targeted));
    },
    [enablePushAlerts],
  );

  const resolveLocally = useCallback((requestId: string) => {
    // Allow a future re-request of the same envelope to alert again.
    seenIdsRef.current.delete(requestId);
    setRequests((prev) => removeSignatureRequest(prev, requestId));
  }, []);

  // In-app bus + cross-tab storage sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    return subscribeToSignatureRequestEvents({
      onRequest: (request) => ingest([request]),
      onResolution: resolveLocally,
    });
  }, [ingest, resolveLocally]);

  // Service-worker relay for pushes that land while a tab is open.
  useEffect(
    () =>
      subscribeToServiceWorkerSignatureRequests((request) => ingest([request])),
    [ingest],
  );

  // Realtime channel — passive subscription, no consumer registration.
  useEffect(() => {
    const manager = WebSocketManager.getInstance();
    const onMessage = (message: unknown) => {
      const parsed = parseMultisigSocketEvent(message);
      if (!parsed) return;
      if (parsed.request) ingest([parsed.request]);
      else if (parsed.resolvedRequestId) resolveLocally(parsed.resolvedRequestId);
    };

    manager.subscribeToMultisigEvents(onMessage);
    return () => manager.unsubscribeFromMultisigEvents(onMessage);
  }, [ingest, resolveLocally]);

  const acknowledgeRequest = useCallback(
    (requestId: string, collectedWeight?: number) => {
      setRequests((prev) =>
        markSignatureRequestResolved(prev, requestId, "approved", collectedWeight),
      );
      publishSignatureResolution(requestId);
    },
    [],
  );

  const openApprovalDrawer = useCallback(
    (requestId?: string | null) => {
      router.push(buildMultisigApprovalDeepLink(requestId));
    },
    [router],
  );

  const pendingRequests = useMemo(
    () => filterPendingSignatureRequests(requests, trackedSignerPublicKey),
    [requests, trackedSignerPublicKey],
  );

  const value = useMemo<MultisigNotificationContextValue>(
    () => ({
      requests,
      pendingRequests,
      pendingCount: pendingRequests.length,
      signerPublicKey: trackedSignerPublicKey,
      acknowledgeRequest,
      dismissRequest: resolveLocally,
      openApprovalDrawer,
    }),
    [
      requests,
      pendingRequests,
      trackedSignerPublicKey,
      acknowledgeRequest,
      resolveLocally,
      openApprovalDrawer,
    ],
  );

  return (
    <MultisigNotificationContext.Provider value={value}>
      {children}
    </MultisigNotificationContext.Provider>
  );
}

/** Context hook. Throws when no provider is mounted, unlike the optional variant. */
export function useMultisigNotifications(): MultisigNotificationContextValue {
  const context = useContext(MultisigNotificationContext);
  if (!context) {
    throw new Error(
      "useMultisigNotifications must be used within a MultisigNotificationProvider",
    );
  }
  return context;
}

/**
 * Same value, but `null` instead of a throw when the provider is absent — lets
 * globally-mounted UI degrade quietly outside the provider.
 */
export function useOptionalMultisigNotifications(): MultisigNotificationContextValue | null {
  return useContext(MultisigNotificationContext);
}

export { DEMO_CO_SIGNER_PUBLIC_KEY };

export default MultisigNotificationProvider;
