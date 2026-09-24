"use client";

/**
 * useWallet.ts — Issue #519
 *
 * Freighter Wallet Connect & Re-authentication Hook.
 *
 * Responsibilities
 * ────────────────
 * 1. Detect and reflect Freighter extension connection state via
 *    `@stellar/freighter-api` polling (`WatchWalletChanges`).
 * 2. Persist the connected public key to localStorage so sessions survive
 *    page reloads.
 * 3. Detect session expiry (public key disappeared / extension de-authorised)
 *    and trigger graceful re-authentication.
 * 4. Surface account-switching: when Freighter reports a different public key
 *    the hook updates state and persists the new key atomically.
 *
 * Design notes
 * ────────────
 * - This hook is intentionally self-contained and does NOT depend on
 *   WalletProvider or WalletContext so it can be used from any subtree.
 * - All side-effects are cleaned up on unmount to prevent memory leaks.
 * - SSR-safe: all `window`/`localStorage` access is guarded by `typeof window`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isConnected,
  isAllowed,
  requestAccess,
  WatchWalletChanges,
} from "@stellar/freighter-api";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** localStorage key used to persist the connected public key. */
const STORAGE_KEY = "stellarflow.wallet.publicKey";

/**
 * Polling interval (ms) passed to `WatchWalletChanges`.
 * 3 000 ms is the library default; we use a slightly tighter 2 500 ms so
 * account-switches feel responsive while keeping extension round-trips low.
 */
const WATCH_INTERVAL_MS = 2_500;

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers (SSR-safe)
// ─────────────────────────────────────────────────────────────────────────────

function readPersistedKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writePersistedKey(publicKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, publicKey);
  } catch {
    // Private browsing / storage quota exceeded — fail silently.
  }
}

function clearPersistedKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type WalletConnectionStatus =
  | "idle"          // Initial state — not yet checked
  | "checking"      // In-flight Freighter query
  | "connected"     // Authorised and public key available
  | "disconnected"  // Extension present but not authorised / user disconnected
  | "unavailable"   // Freighter extension not installed
  | "error";        // Unexpected failure during connection attempt

export interface UseWalletReturn {
  /** Current connection lifecycle status. */
  status: WalletConnectionStatus;
  /** Stellar public key (G…) when `status === 'connected'`, otherwise `null`. */
  publicKey: string | null;
  /** Human-readable error description when `status === 'error'`. */
  error: string | null;
  /**
   * Whether the session was restored from localStorage on initial mount
   * (before Freighter has confirmed the key is still valid).
   */
  isRestored: boolean;
  /**
   * Initiate a connection: prompts the user to authorise the app in Freighter.
   * Resolves once connected or rejects with an error message.
   */
  connect: () => Promise<void>;
  /**
   * Disconnect: clears the persisted key and resets state.
   * Does not revoke Freighter authorisation — the user can reconnect without
   * re-authorising the app.
   */
  disconnect: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useWallet
 *
 * Self-contained hook for Freighter wallet integration.
 *
 * @example
 * ```tsx
 * const { status, publicKey, connect, disconnect } = useWallet();
 *
 * if (status === 'connected') {
 *   return <p>Connected: {publicKey}</p>;
 * }
 * return <button onClick={connect}>Connect Wallet</button>;
 * ```
 */
export function useWallet(): UseWalletReturn {
  // ── State ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<WalletConnectionStatus>("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  /** Guard against state updates after unmount. */
  const mountedRef = useRef(true);
  /** Reference to the active WatchWalletChanges instance. */
  const watcherRef = useRef<WatchWalletChanges | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Atomically set connected state + persist key. */
  const handleConnected = useCallback((key: string) => {
    if (!mountedRef.current) return;
    writePersistedKey(key);
    setPublicKey(key);
    setStatus("connected");
    setError(null);
    setIsRestored(false);
  }, []);

  /** Clear state + storage when the session ends. */
  const handleDisconnected = useCallback(() => {
    if (!mountedRef.current) return;
    clearPersistedKey();
    setPublicKey(null);
    setStatus("disconnected");
    setIsRestored(false);
  }, []);

  // ── Watcher management ───────────────────────────────────────────────────

  /**
   * Start `WatchWalletChanges` to receive account-switch / network-change
   * callbacks from Freighter in real time.
   *
   * The watcher fires only when a value actually changes, so it's safe to
   * run continuously once the user is connected.
   */
  const startWatcher = useCallback(() => {
    // Stop any existing watcher first.
    if (watcherRef.current) {
      watcherRef.current.stop();
      watcherRef.current = null;
    }

    const watcher = new WatchWalletChanges(WATCH_INTERVAL_MS);

    watcher.watch(({ address }) => {
      if (!mountedRef.current) return;

      if (address) {
        // Account switch: update state with the new public key.
        handleConnected(address);
      } else {
        // Address gone — session expired or user revoked access.
        handleDisconnected();
      }
    });

    watcherRef.current = watcher;
  }, [handleConnected, handleDisconnected]);

  const stopWatcher = useCallback(() => {
    if (watcherRef.current) {
      watcherRef.current.stop();
      watcherRef.current = null;
    }
  }, []);

  // ── Initial session check ────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    async function initialise(): Promise<void> {
      if (!mountedRef.current) return;

      // 1. Optimistically restore persisted key so the UI renders immediately
      //    without waiting for an async Freighter round-trip.
      const persisted = readPersistedKey();
      if (persisted) {
        setPublicKey(persisted);
        setStatus("checking");
        setIsRestored(true);
      } else {
        setStatus("checking");
      }

      // 2. Confirm Freighter is installed.
      let freighterInstalled = false;
      try {
        const result = await isConnected();
        freighterInstalled = Boolean(result?.isConnected);
      } catch {
        freighterInstalled = false;
      }

      if (!mountedRef.current) return;

      if (!freighterInstalled) {
        clearPersistedKey();
        setPublicKey(null);
        setStatus("unavailable");
        setIsRestored(false);
        return;
      }

      // 3. Check whether the app is already on the Allow List.
      let allowed = false;
      try {
        const result = await isAllowed();
        allowed = Boolean(result?.isAllowed);
      } catch {
        allowed = false;
      }

      if (!mountedRef.current) return;

      if (!allowed) {
        // Not authorised — clear any stale persisted key and wait for the
        // user to explicitly call `connect()`.
        clearPersistedKey();
        setPublicKey(null);
        setStatus("disconnected");
        setIsRestored(false);
        return;
      }

      // 4. Already authorised — fetch the current public key silently.
      try {
        const result = await requestAccess();
        if (!mountedRef.current) return;

        if (result.error || !result.address) {
          // Session expired (extension no longer returns an address).
          handleDisconnected();
          return;
        }

        handleConnected(result.address);
        startWatcher();
      } catch (err) {
        if (!mountedRef.current) return;
        clearPersistedKey();
        setPublicKey(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to fetch wallet address");
        setIsRestored(false);
      }
    }

    void initialise();

    return () => {
      mountedRef.current = false;
      stopWatcher();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only.

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * connect — request Freighter access.
   *
   * Calls `requestAccess()` which prompts the user if the app is not yet
   * on the Allow List, or resolves immediately if it is.
   */
  const connect = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    setStatus("checking");
    setError(null);

    // Ensure Freighter is installed before attempting connection.
    let freighterInstalled = false;
    try {
      const result = await isConnected();
      freighterInstalled = Boolean(result?.isConnected);
    } catch {
      freighterInstalled = false;
    }

    if (!mountedRef.current) return;

    if (!freighterInstalled) {
      setStatus("unavailable");
      setError("Freighter extension is not installed. Please install it from https://freighter.app");
      return;
    }

    try {
      const result = await requestAccess();

      if (!mountedRef.current) return;

      if (result.error) {
        setStatus("error");
        setError(result.error.message ?? "Wallet connection was declined.");
        return;
      }

      if (!result.address) {
        setStatus("disconnected");
        return;
      }

      handleConnected(result.address);
      startWatcher();
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unexpected error during wallet connection.");
    }
  }, [handleConnected, startWatcher]);

  /**
   * disconnect — clear session state without revoking Freighter authorisation.
   *
   * Clears localStorage and stops the watcher. The user can reconnect at any
   * time via `connect()` without re-authorising.
   */
  const disconnect = useCallback((): void => {
    stopWatcher();
    clearPersistedKey();
    if (!mountedRef.current) return;
    setPublicKey(null);
    setStatus("disconnected");
    setError(null);
    setIsRestored(false);
  }, [stopWatcher]);

  return {
    status,
    publicKey,
    error,
    isRestored,
    connect,
    disconnect,
  };
}

export default useWallet;
