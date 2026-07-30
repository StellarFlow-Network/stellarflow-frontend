"use client";

/**
 * useReAuth.ts
 *
 * Re-authentication hook for graceful Freighter session expiry handling.
 *
 * Problem
 * ───────
 * A user's in-app Freighter session can expire in two ways:
 *   1. Idle timeout — `WalletSessionProvider` (WalletContext.tsx) disconnects
 *      after 15 minutes of inactivity.
 *   2. Account switch — the user switches Freighter accounts externally while
 *      the app is open; `FreighterWalletContext` detects the mismatch and
 *      raises `sessionExpired`.
 *
 * In both cases, any component attempting a privileged action (signing a
 * transaction, fetching wallet-gated data) should call `requireAuth()` first.
 * `requireAuth()` will:
 *   a) Return immediately when the session is valid.
 *   b) Trigger a seamless Freighter `requestAccess()` re-prompt and resolve
 *      with the new public key when the session has expired.
 *   c) Reject (throw) if the user cancels the re-auth dialog.
 *
 * Usage
 * ─────
 * ```tsx
 * const { requireAuth, isReAuthing, reAuthError } = useReAuth();
 *
 * const handleSign = async () => {
 *   try {
 *     const address = await requireAuth();
 *     await signTransaction(xdr, { address: address.publicKey });
 *   } catch {
 *     // user cancelled re-auth — handle gracefully
 *   }
 * };
 * ```
 *
 * Toast notifications
 * ───────────────────
 * Uses the existing `ToastQueue` infrastructure (`addToast` via `useToast`).
 * Success: `status: "confirmed"` — auto-dismisses after 5 s.
 * Failure: `status: "failed"` — persists until user dismisses.
 *
 * Requirements
 * ────────────
 * Must be rendered inside `<FreighterWalletProvider>` and `<ToastProvider>`.
 */

import { useCallback, useRef, useState } from "react";
import {
  useFreighterWalletState,
  useFreighterWalletActions,
} from "@/context/FreighterWalletContext";
import { useToast } from "@/components/ui/ToastQueue";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The resolved value of a successful `requireAuth()` call.
 */
export interface ReAuthSuccess {
  /** The Stellar public key confirmed by the extension. */
  publicKey: string;
  /**
   * `true` when a Freighter re-auth dialog was shown;
   * `false` when the session was already valid.
   */
  wasReAuthenticated: boolean;
}

export interface UseReAuthReturn {
  /**
   * Ensure the wallet session is active before performing a privileged action.
   *
   * - Session valid → resolves immediately with `{ publicKey, wasReAuthenticated: false }`.
   * - Session expired or disconnected → triggers Freighter `requestAccess()`,
   *   resolves with `{ publicKey, wasReAuthenticated: true }` on success.
   * - User cancels / Freighter error → rejects with `Error`.
   */
  requireAuth: () => Promise<ReAuthSuccess>;

  /**
   * `true` while a re-authentication request is in flight.
   * Use to disable buttons or show spinners.
   */
  isReAuthing: boolean;

  /**
   * Last re-authentication error message, null when no error or after clearing.
   */
  reAuthError: string | null;

  /**
   * Programmatically clear the `reAuthError`.  Call when dismissing error UI.
   */
  clearReAuthError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useReAuth
 *
 * Re-authentication hook that gracefully handles Freighter session expiry.
 * Call `requireAuth()` before any wallet-gated operation.
 *
 * Must be rendered inside `<FreighterWalletProvider>` and `<ToastProvider>`.
 */
export function useReAuth(): UseReAuthReturn {
  const { publicKey, sessionExpired, status } = useFreighterWalletState();
  const { connect, clearSessionExpired, refresh } = useFreighterWalletActions();
  const { addToast } = useToast();

  const [isReAuthing, setIsReAuthing] = useState(false);
  const [reAuthError, setReAuthError] = useState<string | null>(null);

  /**
   * Deduplicate concurrent calls — if re-auth is already in flight, all
   * callers share the same promise rather than opening multiple Freighter
   * popups.
   */
  const inflightRef = useRef<Promise<ReAuthSuccess> | null>(null);

  const clearReAuthError = useCallback(() => {
    setReAuthError(null);
  }, []);

  const requireAuth = useCallback((): Promise<ReAuthSuccess> => {
    // ── Fast path: session is valid ─────────────────────────────────────────
    const sessionIsValid =
      status === "connected" && publicKey !== null && !sessionExpired;

    if (sessionIsValid) {
      return Promise.resolve({
        publicKey: publicKey as string,
        wasReAuthenticated: false,
      });
    }

    // ── Deduplicate concurrent calls ────────────────────────────────────────
    if (inflightRef.current) {
      return inflightRef.current;
    }

    // ── Re-auth flow ────────────────────────────────────────────────────────
    const reAuthPromise: Promise<ReAuthSuccess> = (async (): Promise<ReAuthSuccess> => {
      setIsReAuthing(true);
      setReAuthError(null);

      try {
        // Trigger Freighter requestAccess() (shows popup if needed)
        const newAddress = await connect();

        if (!newAddress) {
          const errMsg =
            "Re-authentication was cancelled or denied by Freighter.";
          setReAuthError(errMsg);
          addToast({
            title: "Authentication Required",
            description: errMsg,
            status: "failed",
          });
          throw new Error(errMsg);
        }

        // Sync state: refresh network, clear sessionExpired flag
        await refresh();
        clearSessionExpired();

        addToast({
          title: "Session Restored",
          description: `Wallet reconnected: ${newAddress.slice(0, 4)}…${newAddress.slice(-4)}`,
          status: "confirmed",
        });

        return { publicKey: newAddress, wasReAuthenticated: true };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Re-authentication failed.";

        setReAuthError(msg);

        // Only show toast when the error was NOT the "cancelled" toast we
        // already emitted above to avoid a duplicate notification.
        if (!(err instanceof Error && err.message.includes("cancelled or denied"))) {
          addToast({
            title: "Authentication Failed",
            description: msg,
            status: "failed",
          });
        }

        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setIsReAuthing(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = reAuthPromise;
    return reAuthPromise;
  }, [
    publicKey,
    sessionExpired,
    status,
    connect,
    clearSessionExpired,
    refresh,
    addToast,
  ]);

  return { requireAuth, isReAuthing, reAuthError, clearReAuthError };
}

export default useReAuth;
