"use client";

/**
 * FreighterWalletContext.tsx
 *
 * Freighter-native wallet connection layer for StellarFlow.
 *
 * Responsibilities
 * ────────────────
 * 1. Tracks Freighter extension connection state via `isConnected()` and
 *    `getAddress()` from @stellar/freighter-api.
 * 2. Persists the connected public key in encrypted localStorage so the
 *    session survives page reloads.
 * 3. Listens for account switches and network changes via `WatchWalletChanges`
 *    (polling-based watcher bundled with freighter-api).
 * 4. Exposes `connect()` to trigger `requestAccess()` and `disconnect()` to
 *    clear the session without touching the Freighter extension itself.
 * 5. Raises a `sessionExpired` flag when the stored public key can no longer
 *    be confirmed by the extension (used by `useReAuth` to trigger re-auth).
 *
 * Architecture
 * ────────────
 * This context is intentionally *separate* from the existing `WalletProvider`
 * (which bridges legacy window.stellar / window.Freighter extension objects).
 * Both can coexist: `WalletProvider` stays as-is; this context layers on top
 * with the official @stellar/freighter-api surface.
 *
 * The public-facing `FreighterWalletProvider` must wrap the app subtree that
 * needs wallet awareness.  `WalletSessionProvider` (idle-timeout layer) from
 * src/context/WalletContext.tsx should be nested *inside* this provider so it
 * can call the Freighter-aware `disconnect()`.
 *
 * Storage key
 * ───────────
 * `stellarflow.freighter.publicKey` — encrypted via src/utils/storage.ts
 *
 * Account switch / network change detection
 * ─────────────────────────────────────────
 * `WatchWalletChanges` polls Freighter every `WATCH_POLL_MS` milliseconds.
 * When the watcher fires with a different address the context updates state
 * and re-persists.  On network mismatch it also refreshes state so UI layers
 * downstream can react.
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
  isConnected,
  getAddress,
  requestAccess,
  getNetwork,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { setItem, getItem, removeItem } from "@/utils/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** localStorage key for the persisted public key (encrypted). */
const STORAGE_KEY = "stellarflow.freighter.publicKey";

/** localStorage key for the persisted network passphrase. */
const STORAGE_NETWORK_KEY = "stellarflow.freighter.network";

/**
 * Polling interval passed to WatchWalletChanges constructor (milliseconds).
 * 3 s balances responsiveness against extension round-trip cost.
 */
const WATCH_POLL_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Connection lifecycle states. */
export type FreighterConnectionStatus =
  | "idle"         // Initial state — not yet checked
  | "checking"     // Actively querying the extension
  | "connected"    // Extension returned a valid address
  | "disconnected" // Extension not connected / no address
  | "error";       // Unexpected error during query

export interface FreighterWalletState {
  /** Stellar public key (G…), null when not connected. */
  publicKey: string | null;
  /** Current network name, e.g. "TESTNET" or "PUBLIC". */
  network: string | null;
  /** Granular connection lifecycle state. */
  status: FreighterConnectionStatus;
  /**
   * True when the persisted public key can no longer be confirmed by the
   * extension — indicates the session has expired or the user switched
   * accounts without explicit re-auth in-app.
   */
  sessionExpired: boolean;
  /** Last error message, null when status !== 'error'. */
  error: string | null;
}

export interface FreighterWalletActions {
  /**
   * Request Freighter access.  If already connected, resolves immediately
   * with the current address.  On success, persists the public key.
   */
  connect: () => Promise<string | null>;
  /**
   * Clear the in-app session.  Does NOT call Freighter's disconnect API
   * (the extension manages its own connection).  Removes persisted key and
   * sets status to 'disconnected'.
   */
  disconnect: () => void;
  /**
   * Re-query the extension and refresh state.  Call this after a transaction
   * to confirm the active account hasn't changed.
   */
  refresh: () => Promise<void>;
  /**
   * Acknowledge the `sessionExpired` flag, typically after the user has
   * completed re-authentication via `useReAuth`.
   */
  clearSessionExpired: () => void;
}

export interface FreighterWalletContextValue {
  state: FreighterWalletState;
  actions: FreighterWalletActions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const FreighterWalletContext =
  createContext<FreighterWalletContextValue | null>(null);

FreighterWalletContext.displayName = "FreighterWalletContext";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Validates that a value looks like a Stellar public key (G + 55 base32 chars). */
function isValidPublicKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^G[A-Z2-7]{55}$/.test(value)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function FreighterWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [publicKey, setPublicKey] = useState<string | null>(() => {
    // Hydrate from encrypted storage synchronously on first render.
    // This runs only on the client (components with "use client" directive).
    if (typeof window === "undefined") return null;
    return getItem<string>(STORAGE_KEY, isValidPublicKey) ?? null;
  });
  const [network, setNetwork] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return getItem<string>(STORAGE_NETWORK_KEY, (v): v is string => typeof v === "string") ?? null;
  });
  const [status, setStatus] = useState<FreighterConnectionStatus>("idle");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Guard against state updates after unmount. */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Ref to the active WatchWalletChanges instance. */
  const watcherRef = useRef<WatchWalletChanges | null>(null);

  // ── Core refresh logic ───────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    if (typeof window === "undefined") return;

    setStatus("checking");
    setError(null);

    try {
      const connResult = await isConnected();
      if (connResult.error) {
        if (!mountedRef.current) return;
        setStatus("error");
        setError(connResult.error.message ?? "Freighter connection check failed");
        return;
      }

      if (!connResult.isConnected) {
        if (!mountedRef.current) return;
        setStatus("disconnected");
        setPublicKey(null);
        removeItem(STORAGE_KEY);
        return;
      }

      // Extension is connected — fetch the active address
      const addrResult = await getAddress();
      if (!mountedRef.current) return;

      if (addrResult.error || !addrResult.address) {
        setStatus("disconnected");
        setPublicKey(null);
        removeItem(STORAGE_KEY);
        return;
      }

      const newAddress = addrResult.address;

      // Detect account switch: persisted key differs from live key
      const persisted = getItem<string>(STORAGE_KEY, isValidPublicKey);
      if (persisted && persisted !== newAddress) {
        // The user switched accounts externally — flag session as expired so
        // the app can prompt re-authentication before performing sensitive ops.
        setSessionExpired(true);
      }

      setPublicKey(newAddress);
      setItem(STORAGE_KEY, newAddress);
      setStatus("connected");

      // Fetch network name
      const netResult = await getNetwork();
      if (mountedRef.current && !netResult.error) {
        const networkName = netResult.network ?? null;
        setNetwork(networkName);
        if (networkName) {
          setItem(STORAGE_NETWORK_KEY, networkName);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Unexpected error querying Freighter"
      );
    }
  }, []);

  // ── connect ──────────────────────────────────────────────────────────────

  const connect = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    setStatus("checking");
    setError(null);

    try {
      // First check if already allowed to avoid spurious permission dialogs
      const addrResult = await getAddress();

      if (!addrResult.error && addrResult.address) {
        const addr = addrResult.address;
        if (!mountedRef.current) return null;
        setPublicKey(addr);
        setItem(STORAGE_KEY, addr);
        setStatus("connected");
        setSessionExpired(false);
        await refresh(); // also fetch network
        return addr;
      }

      // Need to request access (shows Freighter popup)
      const accessResult = await requestAccess();
      if (!mountedRef.current) return null;

      if (accessResult.error || !accessResult.address) {
        setStatus("disconnected");
        setError(
          accessResult.error?.message ?? "Access denied by Freighter extension"
        );
        return null;
      }

      const addr = accessResult.address;
      setPublicKey(addr);
      setItem(STORAGE_KEY, addr);
      setStatus("connected");
      setSessionExpired(false);
      await refresh(); // fetch network
      return addr;
    } catch (err) {
      if (!mountedRef.current) return null;
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to connect to Freighter"
      );
      return null;
    }
  }, [refresh]);

  // ── disconnect ───────────────────────────────────────────────────────────

  const disconnect = useCallback((): void => {
    if (!mountedRef.current) return;

    // Stop the account-change watcher
    watcherRef.current?.stop();
    watcherRef.current = null;

    setPublicKey(null);
    setNetwork(null);
    setStatus("disconnected");
    setSessionExpired(false);
    setError(null);

    removeItem(STORAGE_KEY);
    removeItem(STORAGE_NETWORK_KEY);
  }, []);

  // ── clearSessionExpired ──────────────────────────────────────────────────

  const clearSessionExpired = useCallback((): void => {
    setSessionExpired(false);
  }, []);

  // ── Initial check + WatchWalletChanges listener ──────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Run an initial refresh to sync state with the extension
    void refresh();

    // Start polling for account/network changes
    const watcher = new WatchWalletChanges(WATCH_POLL_MS);
    watcherRef.current = watcher;

    watcher.watch((params) => {
      if (!mountedRef.current) return;

      if (params.error) {
        // Watcher error usually means extension is unavailable — treat as disconnected
        setStatus("disconnected");
        setPublicKey(null);
        setNetwork(null);
        removeItem(STORAGE_KEY);
        removeItem(STORAGE_NETWORK_KEY);
        return;
      }

      const newAddress = params.address;
      const newNetwork = params.network ?? null;

      setNetwork(newNetwork);
      if (newNetwork) setItem(STORAGE_NETWORK_KEY, newNetwork);

      if (!newAddress) {
        setStatus("disconnected");
        setPublicKey(null);
        removeItem(STORAGE_KEY);
        return;
      }

      // Check for account switch
      setPublicKey((prev) => {
        if (prev && prev !== newAddress) {
          // Account changed externally — flag session expiry for re-auth
          setSessionExpired(true);
        }
        return newAddress;
      });

      setItem(STORAGE_KEY, newAddress);
      setStatus("connected");
      setError(null);
    });

    return () => {
      watcher.stop();
      watcherRef.current = null;
    };
  }, [refresh]); // refresh is stable (useCallback with no deps that change)

  // ── Context value ─────────────────────────────────────────────────────────

  const state = useMemo<FreighterWalletState>(
    () => ({ publicKey, network, status, sessionExpired, error }),
    [publicKey, network, status, sessionExpired, error]
  );

  const actions = useMemo<FreighterWalletActions>(
    () => ({ connect, disconnect, refresh, clearSessionExpired }),
    [connect, disconnect, refresh, clearSessionExpired]
  );

  const value = useMemo<FreighterWalletContextValue>(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <FreighterWalletContext.Provider value={value}>
      {children}
    </FreighterWalletContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useFreighterWallet
 *
 * Returns the full FreighterWalletContextValue (state + actions).
 * Must be used inside `<FreighterWalletProvider>`.
 */
export function useFreighterWallet(): FreighterWalletContextValue {
  const ctx = useContext(FreighterWalletContext);
  if (!ctx) {
    throw new Error(
      "useFreighterWallet must be used within a FreighterWalletProvider"
    );
  }
  return ctx;
}

/**
 * useFreighterWalletState
 *
 * Returns only the state slice — does not cause re-renders from action changes.
 */
export function useFreighterWalletState(): FreighterWalletState {
  return useFreighterWallet().state;
}

/**
 * useFreighterWalletActions
 *
 * Returns only the actions slice.
 */
export function useFreighterWalletActions(): FreighterWalletActions {
  return useFreighterWallet().actions;
}
