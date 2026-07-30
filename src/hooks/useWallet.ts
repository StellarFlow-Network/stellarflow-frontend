"use client";

/**
 * useWallet.ts
 *
 * Primary hook for consuming Freighter wallet state throughout StellarFlow.
 *
 * Features
 * ────────
 * • Integrates @stellar/freighter-api connection state listener (via
 *   FreighterWalletContext / WatchWalletChanges).
 * • Persists connected public key in encrypted localStorage across reloads.
 * • Detects account switching and exposes a `sessionExpired` flag for
 *   downstream re-auth flows.
 * • Provides computed helpers: `isConnected`, `shortAddress`, `networkLabel`.
 *
 * Usage
 * ─────
 * ```tsx
 * // Simple connection check
 * const { isConnected, publicKey, connect, disconnect } = useWallet();
 *
 * // Full state access
 * const { status, network, sessionExpired, error, refresh } = useWallet();
 * ```
 *
 * Requirements
 * ────────────
 * Component must be inside `<FreighterWalletProvider>` (added in layout.tsx).
 */

import { useCallback, useMemo } from "react";
import {
  useFreighterWalletState,
  useFreighterWalletActions,
  type FreighterConnectionStatus,
} from "@/context/FreighterWalletContext";

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseWalletReturn {
  // ── State ──────────────────────────────────────────────────────────────

  /** Stellar public key (G…), null when not connected. */
  publicKey: string | null;

  /** Current Freighter network name, e.g. "TESTNET" or "PUBLIC". */
  network: string | null;

  /** Full connection lifecycle status. */
  status: FreighterConnectionStatus;

  /**
   * `true` while a connection check or `connect()` call is in progress.
   * Useful for disabling buttons.
   */
  isLoading: boolean;

  /** `true` when the extension has returned a valid public key. */
  isConnected: boolean;

  /**
   * `true` when the persisted key differs from the live extension key,
   * meaning the user switched accounts without explicit in-app re-auth.
   * Clear via `clearSessionExpired()` after re-authentication.
   */
  sessionExpired: boolean;

  /**
   * Last error message from Freighter API, null when no error.
   */
  error: string | null;

  // ── Computed ────────────────────────────────────────────────────────────

  /**
   * First 4 + last 4 characters of the public key with "…" in the middle.
   * Returns null when not connected.
   *
   * @example "GABC…WXYZ"
   */
  shortAddress: string | null;

  /**
   * Human-readable network label.
   * "Testnet" | "Mainnet" | "Futurenet" | "Standalone" | null.
   */
  networkLabel: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────

  /**
   * Request Freighter access (shows popup if not yet allowed).
   * Returns the connected public key on success, null on failure/rejection.
   */
  connect: () => Promise<string | null>;

  /**
   * Clear the in-app session.  Does not affect the Freighter extension state.
   */
  disconnect: () => void;

  /**
   * Re-query the Freighter extension and refresh all state.  Call this after
   * a signed transaction to confirm the active account hasn't changed.
   */
  refresh: () => Promise<void>;

  /**
   * Acknowledge and clear the `sessionExpired` flag after re-authentication
   * has been completed.
   */
  clearSessionExpired: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network label map
// ─────────────────────────────────────────────────────────────────────────────

const NETWORK_LABELS: Record<string, string> = {
  TESTNET: "Testnet",
  PUBLIC: "Mainnet",
  FUTURENET: "Futurenet",
  STANDALONE: "Standalone",
};

function resolveNetworkLabel(network: string | null): string | null {
  if (!network) return null;
  return NETWORK_LABELS[network.toUpperCase()] ?? network;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useWallet
 *
 * Primary hook for Freighter wallet integration.  Must be rendered inside
 * `<FreighterWalletProvider>`.
 *
 * @returns {UseWalletReturn} Wallet state + actions + computed helpers.
 */
export function useWallet(): UseWalletReturn {
  const { publicKey, network, status, sessionExpired, error } =
    useFreighterWalletState();
  const { connect, disconnect, refresh, clearSessionExpired } =
    useFreighterWalletActions();

  // ── Computed ─────────────────────────────────────────────────────────────

  const isLoading = status === "idle" || status === "checking";
  const isConnected = status === "connected" && publicKey !== null;

  const shortAddress = useMemo(() => {
    if (!publicKey) return null;
    return `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
  }, [publicKey]);

  const networkLabel = useMemo(
    () => resolveNetworkLabel(network),
    [network]
  );

  // ── Stable action references ──────────────────────────────────────────────

  const stableConnect = useCallback(
    () => connect(),
    [connect]
  );

  const stableDisconnect = useCallback(
    () => disconnect(),
    [disconnect]
  );

  const stableRefresh = useCallback(
    () => refresh(),
    [refresh]
  );

  const stableClearSessionExpired = useCallback(
    () => clearSessionExpired(),
    [clearSessionExpired]
  );

  return {
    // state
    publicKey,
    network,
    status,
    isLoading,
    isConnected,
    sessionExpired,
    error,
    // computed
    shortAddress,
    networkLabel,
    // actions
    connect: stableConnect,
    disconnect: stableDisconnect,
    refresh: stableRefresh,
    clearSessionExpired: stableClearSessionExpired,
  };
}

export default useWallet;
