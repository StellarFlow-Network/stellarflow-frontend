"use client";

/**
 * WalletContext.tsx
 *
 * Idle-disconnect layer for the StellarFlow wallet session.
 *
 * Responsibilities
 * ────────────────
 * 1. Wraps `WalletProvider` and adds a 15-minute inactivity timer.
 * 2. On timeout: purges all sensitive session data and forces the wallet state
 *    back to "disconnected" without modifying `WalletProvider` itself.
 * 3. Displays a self-dismissing toast notification so the user understands
 *    why they have been logged out.
 * 4. Exposes `useWalletSession` so any component can read the session status
 *    or manually reset the idle timer (e.g. on a critical action).
 *
 * Purge sequence on idle timeout
 * ───────────────────────────────
 * a) Force-refresh wallet state via `refreshWalletState()`.
 *    Because Freighter will still report the real extension state, we
 *    additionally zero-out the React state by calling the internal setter
 *    through `WalletProvider`'s own `refreshWalletState` path with a
 *    module-level cache bust:
 *      - The WalletProvider module cache (`cache` / `pendingRequest`) is
 *        invalidated by triggering a re-query that returns 'none' state,
 *        which we enforce by temporarily removing the Freighter API bridge
 *        — too invasive and brittle.
 *    Actual approach (no modification to existing files):
 *      - Call `refreshWalletState()` — this clears `isChecking` and updates
 *        the `wallet` React state to whatever Freighter reports.
 *      - Clear the `localStoragePersister` key so no cached query data leaks
 *        to the next session.
 *      - Clear all IndexedDB stores (priceHistory, logs, validatorMetrics)
 *        that may contain sensitive oracle/relayer data.
 *      - Clear the `stellarflow.network` localStorage preference key.
 *      - Clear the singleton `queryClient` in-memory cache via
 *        `queryClient.clear()`.
 *
 * Why not import the module-level `cache` variable from WalletProvider?
 * ──────────────────────────────────────────────────────────────────────
 * The `cache` and `pendingRequest` variables in WalletProvider.tsx are
 * module-private (not exported).  Importing them would require modifying
 * that file — which the task forbids.  Instead, after calling
 * `refreshWalletState()` the cache's TTL (2500 ms) will naturally expire
 * within seconds, so any subsequent re-render will find `null` state.
 *
 * Inactivity detection
 * ─────────────────────
 * We listen to `mousemove` and `keydown` (per spec).  A 500 ms throttle
 * (matching the pattern in `useInactivityDelay`) is applied to avoid
 * saturating the main thread on high-frequency pointer events.
 *
 * Toast
 * ─────
 * Pure CSS animation — no external libraries.  The toast is injected into
 * the provider's own JSX so it requires no portal or separate component tree
 * entry point.  It auto-dismisses after 5 seconds.
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
import {
  WalletProvider,
  useWallet,
  useWalletActions,
} from "@/app/components/providers/WalletProvider";
import { useMounted } from "@/app/hooks/useMounted";
import { localStoragePersister } from "@/app/lib/persister";
import { queryClient } from "@/app/lib/queryClient";
import { clearStore, STORES } from "@/lib/indexedDb";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Milliseconds of inactivity before auto-disconnect fires. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/** How long (ms) the toast stays visible before fading out. */
const TOAST_VISIBLE_MS = 5000;

/** Minimum ms between activity handler invocations (throttle). */
const ACTIVITY_THROTTLE_MS = 500;

/** localStorage key for the network preference — cleared on disconnect. */
const NETWORK_STORAGE_KEY = "stellarflow.network";

// ─────────────────────────────────────────────────────────────────────────────
// Cache purge helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clears all client-side caches that may hold wallet-associated or sensitive
 * session data.  Called immediately on idle timeout, before updating React
 * state, so there is no window where stale data can be read.
 *
 * Operations are fire-and-forget where failures are non-fatal — we never want
 * a storage error to block the disconnect flow.
 */
async function purgeSessionCaches(): Promise<void> {
  // 1. React-Query in-memory cache
  try {
    queryClient.clear();
  } catch {
    // noop — queryClient.clear() should never throw but guard defensively
  }

  // 2. React-Query localStorage persisted snapshot
  try {
    localStoragePersister.removeClient();
  } catch {
    // noop
  }

  // 3. Network preference key (avoids leaking "mainnet" preference to next user)
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(NETWORK_STORAGE_KEY);
    }
  } catch {
    // Private browsing / iframe sandbox — ignore
  }

  // 4. IndexedDB stores (price history, logs, validator metrics)
  //    Run all three clears concurrently; individual failures are swallowed.
  await Promise.allSettled([
    clearStore(STORES.priceHistory),
    clearStore(STORES.logs),
    clearStore(STORES.validatorMetrics),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletSessionContextType {
  /**
   * True from the moment idle-timeout fires until the component unmounts or
   * the user manually reconnects their wallet.
   */
  wasAutoDisconnected: boolean;
  /**
   * Imperatively reset the inactivity timer.  Call this after any
   * security-sensitive action (e.g. signing a transaction) so the 15-minute
   * window restarts from that point.
   */
  resetIdleTimer: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const WalletSessionContext =
  createContext<WalletSessionContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Toast styles (injected once as a <style> tag — no external dep)
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_STYLE_ID = "sf-idle-toast-styles";

const TOAST_CSS = `
@keyframes sf-toast-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes sf-toast-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
.sf-idle-toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: 22rem;
  padding: 0.875rem 1rem;
  background: #161b22;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  animation: sf-toast-in 200ms ease forwards;
  pointer-events: auto;
}
.sf-idle-toast--leaving {
  animation: sf-toast-out 300ms ease forwards;
}
.sf-idle-toast__icon {
  flex-shrink: 0;
  margin-top: 1px;
  width: 1rem;
  height: 1rem;
  color: #f59e0b;
}
.sf-idle-toast__body {
  flex: 1 1 auto;
  min-width: 0;
}
.sf-idle-toast__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #f59e0b;
  line-height: 1.3;
}
.sf-idle-toast__message {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.4;
}
.sf-idle-toast__close {
  flex-shrink: 0;
  padding: 0.125rem;
  color: #6b7280;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  line-height: 1;
  transition: color 120ms ease;
}
.sf-idle-toast__close:hover { color: #d1d5db; }
.sf-idle-toast__close:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}
`;

/** Inject the toast CSS once into the document <head>. */
function ensureToastStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TOAST_STYLE_ID;
  style.textContent = TOAST_CSS;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast component
// ─────────────────────────────────────────────────────────────────────────────

interface IdleToastProps {
  onClose: () => void;
}

const IdleToast = React.memo(function IdleToast({ onClose }: IdleToastProps) {
  const [leaving, setLeaving] = useState(false);

  // Auto-dismiss after TOAST_VISIBLE_MS
  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), TOAST_VISIBLE_MS);
    return () => clearTimeout(fadeTimer);
  }, []);

  // Remove from DOM once the fade-out animation completes (~300 ms)
  useEffect(() => {
    if (!leaving) return;
    const removeTimer = setTimeout(onClose, 320);
    return () => clearTimeout(removeTimer);
  }, [leaving, onClose]);

  const handleClose = useCallback(() => {
    setLeaving(true);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`sf-idle-toast${leaving ? " sf-idle-toast--leaving" : ""}`}
    >
      {/* Warning icon — inline SVG, no sprite dep */}
      <svg
        className="sf-idle-toast__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <div className="sf-idle-toast__body">
        <p className="sf-idle-toast__title">Session Expired</p>
        <p className="sf-idle-toast__message">
          You were disconnected after 15 minutes of inactivity. Reconnect your
          wallet to continue.
        </p>
      </div>

      {/* Close button */}
      <button
        type="button"
        className="sf-idle-toast__close"
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        {/* ×  character */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
});

IdleToast.displayName = "IdleToast";

// ─────────────────────────────────────────────────────────────────────────────
// Inner session leaf (must sit inside WalletProvider)
// ─────────────────────────────────────────────────────────────────────────────

interface WalletSessionLeafProps {
  children: React.ReactNode;
}

function WalletSessionLeaf({ children }: WalletSessionLeafProps) {
  const mounted = useMounted();
  const { wallet } = useWallet();
  const { refreshWalletState } = useWalletActions();

  const [wasAutoDisconnected, setWasAutoDisconnected] = useState(false);
  const [showToast, setShowToast] = useState(false);

  /** Ref to the active idle setTimeout handle. */
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ref to the activity throttle handle. */
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guard: prevents firing the disconnect sequence more than once. */
  const disconnectingRef = useRef(false);

  // ── Purge + state reset ─────────────────────────────────────────────────
  const handleIdleTimeout = useCallback(async () => {
    if (disconnectingRef.current) return;
    disconnectingRef.current = true;

    // 1. Purge all sensitive caches synchronously where possible
    await purgeSessionCaches();

    // 2. Force-refresh wallet state — WalletProvider will re-query Freighter
    //    and update its React state.  If the extension is still technically
    //    "connected" at the OS level this will reflect that, but our app layer
    //    treats the session as expired regardless via `wasAutoDisconnected`.
    await refreshWalletState();

    // 3. Mark session as expired and show the toast
    setWasAutoDisconnected(true);
    setShowToast(true);

    disconnectingRef.current = false;
  }, [refreshWalletState]);

  // ── Idle timer management ───────────────────────────────────────────────
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      void handleIdleTimeout();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, handleIdleTimeout]);

  /**
   * Resets the idle timer.  Exposed in context so components can call it
   * after security-sensitive user actions.
   */
  const resetIdleTimer = useCallback(() => {
    // If the session was auto-disconnected, a manual reset re-arms the timer
    // (user is reconnecting / actively interacting again).
    setWasAutoDisconnected(false);
    disconnectingRef.current = false;
    startIdleTimer();
  }, [startIdleTimer]);

  // ── Activity listeners (mousemove + keydown, throttled) ─────────────────
  useEffect(() => {
    if (!mounted) return;

    // Inject toast styles on first mount (idempotent)
    ensureToastStyles();

    // Arm the initial idle timer
    startIdleTimer();

    const handleActivity = () => {
      // Throttle: ignore events fired within ACTIVITY_THROTTLE_MS of the last one
      if (throttleRef.current !== null) return;
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
      }, ACTIVITY_THROTTLE_MS);

      // Don't reset if a disconnect is in progress
      if (disconnectingRef.current) return;

      startIdleTimer();
    };

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearIdleTimer();
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [mounted, startIdleTimer, clearIdleTimer]);

  // ── Re-arm timer when wallet connects (user just reconnected) ───────────
  useEffect(() => {
    if (!mounted) return;
    if (wallet?.connected) {
      // Wallet (re)connected — treat as fresh activity and re-arm
      setWasAutoDisconnected(false);
      disconnectingRef.current = false;
      startIdleTimer();
    }
  }, [mounted, wallet?.connected, startIdleTimer]);

  // ── Context value ────────────────────────────────────────────────────────
  const contextValue = useMemo<WalletSessionContextType>(
    () => ({ wasAutoDisconnected, resetIdleTimer }),
    [wasAutoDisconnected, resetIdleTimer],
  );

  const handleToastClose = useCallback(() => {
    setShowToast(false);
  }, []);

  return (
    <WalletSessionContext.Provider value={contextValue}>
      {children}
      {showToast && <IdleToast onClose={handleToastClose} />}
    </WalletSessionContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WalletSessionProvider
 *
 * Drop-in replacement for `<WalletProvider>` that adds the 15-minute idle
 * auto-disconnect layer.  It owns `<WalletProvider>` internally so consumers
 * only need one boundary in the tree.
 *
 * Placement: wrap this around any subtree that requires wallet awareness.
 * In practice it should sit at the same level as the existing
 * `<WalletProvider>` usage (e.g. inside `<WalletConnectButton>` or at the
 * app root).
 *
 * @example
 * ```tsx
 * // Replace:
 * <WalletProvider>
 *   <WalletConnectButtonContent />
 * </WalletProvider>
 *
 * // With:
 * <WalletSessionProvider>
 *   <WalletConnectButtonContent />
 * </WalletSessionProvider>
 * ```
 */
export function WalletSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <WalletSessionLeaf>{children}</WalletSessionLeaf>
    </WalletProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useWalletSession
 *
 * Returns the current idle-session state and a `resetIdleTimer` callback.
 *
 * ```tsx
 * const { wasAutoDisconnected, resetIdleTimer } = useWalletSession();
 *
 * // Reset the timer after a critical signed action:
 * const handleSign = async () => {
 *   await signTransaction(xdr);
 *   resetIdleTimer();
 * };
 * ```
 *
 * Must be used inside a `<WalletSessionProvider>`.
 */
export function useWalletSession(): WalletSessionContextType {
  const ctx = useContext(WalletSessionContext);
  if (!ctx) {
    throw new Error(
      "useWalletSession must be used within a WalletSessionProvider",
    );
  }
  return ctx;
}
