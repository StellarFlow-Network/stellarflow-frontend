"use client";

/**
 * useXBullWallet.ts
 *
 * Integration hook that bridges xBull Wallet connection events into the
 * StellarFlow WalletProvider context.
 *
 * Responsibilities
 * ────────────────
 * 1. Manage modal open/close state for the XBullWalletProvider dialog.
 * 2. On successful xBull connection, persist the public key to localStorage
 *    and call WalletProvider's refreshWalletState so the rest of the app
 *    immediately reflects the new connection.
 * 3. On account switch, persist the new key and refresh wallet state again.
 * 4. On disconnect (extension removed or session expired), clear the persisted
 *    key and refresh wallet state.
 * 5. Return a sign callback that can be invoked from transaction flows.
 *
 * Usage
 * ─────
 * ```tsx
 * import { useXBullWallet } from "@/hooks/useXBullWallet";
 * import { XBullWalletProvider } from "@/components/wallet/XBullWalletProvider";
 *
 * function WalletConnectButton() {
 *   const {
 *     isModalOpen,
 *     openModal,
 *     closeModal,
 *     xBullPublicKey,
 *     handleConnected,
 *     handleAccountSwitch,
 *     handleDisconnected,
 *     handleSignTransaction,
 *   } = useXBullWallet();
 *
 *   return (
 *     <>
 *       <button onClick={openModal}>Connect xBull</button>
 *       <XBullWalletProvider
 *         isOpen={isModalOpen}
 *         onClose={closeModal}
 *         onConnected={handleConnected}
 *         onAccountSwitch={handleAccountSwitch}
 *         onDisconnected={handleDisconnected}
 *         onSignTransaction={handleSignTransaction}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

import { useCallback, useState } from "react";
import { useWalletActions } from "@/app/components/providers/WalletProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers (SSR-safe)
// ─────────────────────────────────────────────────────────────────────────────

const XBULL_KEY_STORAGE_KEY = "stellarflow.wallet.xbull.publicKey";

function persistXBullKey(publicKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(XBULL_KEY_STORAGE_KEY, publicKey);
  } catch {
    // Storage unavailable (private browsing / sandboxed) — fail silently.
  }
}

function clearXBullKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(XBULL_KEY_STORAGE_KEY);
  } catch {
    // noop
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseXBullWalletReturn {
  /** Whether the xBull connection modal is currently open. */
  isModalOpen: boolean;
  /** Open the xBull connection modal. */
  openModal: () => void;
  /** Close the xBull connection modal. */
  closeModal: () => void;
  /**
   * The public key returned by xBull after a successful connection.
   * Null before connection.
   */
  xBullPublicKey: string | null;
  /**
   * Pass to XBullWalletProvider's `onConnected` prop.
   * Persists the key and refreshes global wallet state.
   */
  handleConnected: (publicKey: string) => void;
  /**
   * Pass to XBullWalletProvider's `onAccountSwitch` prop.
   * Updates the persisted key and refreshes global wallet state.
   */
  handleAccountSwitch: (newPublicKey: string) => void;
  /**
   * Pass to XBullWalletProvider's `onDisconnected` prop.
   * Clears the persisted key and refreshes global wallet state.
   */
  handleDisconnected: () => void;
  /**
   * Pass to XBullWalletProvider's `onSignTransaction` prop.
   * Calls any external listener you provide via `onSign`.
   */
  handleSignTransaction: (signedXdr: string, publicKey: string) => void;
  /**
   * Register a callback to be invoked after every successful sign.
   * This is a convenience alternative to drilling `onSignTransaction`
   * through multiple component layers.
   */
  onSign?: (signedXdr: string, publicKey: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useXBullWallet
 *
 * Manages xBull wallet modal state and integrates connection events into the
 * StellarFlow WalletProvider context.
 *
 * Must be used inside a `<WalletProvider>` (or `<WalletSessionProvider>`).
 */
export function useXBullWallet(opts?: {
  /** Optional callback invoked after a successful transaction sign. */
  onSign?: (signedXdr: string, publicKey: string) => void;
}): UseXBullWalletReturn {
  const { refreshWalletState } = useWalletActions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [xBullPublicKey, setXBullPublicKey] = useState<string | null>(null);

  // ── Modal controls ─────────────────────────────────────────────────────
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  // ── Connection callbacks ───────────────────────────────────────────────

  const handleConnected = useCallback(
    (publicKey: string) => {
      setXBullPublicKey(publicKey);
      persistXBullKey(publicKey);
      // Refresh the global WalletProvider state so the rest of the app
      // picks up the new connection immediately.
      void refreshWalletState();
    },
    [refreshWalletState],
  );

  const handleAccountSwitch = useCallback(
    (newPublicKey: string) => {
      setXBullPublicKey(newPublicKey);
      persistXBullKey(newPublicKey);
      void refreshWalletState();
    },
    [refreshWalletState],
  );

  const handleDisconnected = useCallback(() => {
    setXBullPublicKey(null);
    clearXBullKey();
    void refreshWalletState();
  }, [refreshWalletState]);

  // ── Sign callback ──────────────────────────────────────────────────────

  const handleSignTransaction = useCallback(
    (signedXdr: string, publicKey: string) => {
      opts?.onSign?.(signedXdr, publicKey);
    },
    // opts?.onSign is intentionally not listed as a dep — consumers should
    // memoize it themselves.  Including it would require consumers to always
    // wrap their handler in useCallback, which is a leaky abstraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    isModalOpen,
    openModal,
    closeModal,
    xBullPublicKey,
    handleConnected,
    handleAccountSwitch,
    handleDisconnected,
    handleSignTransaction,
  };
}

export default useXBullWallet;
