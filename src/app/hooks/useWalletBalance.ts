import { useState, useCallback, useRef } from "react";

/**
 * useWalletBalance
 *
 * Implements a structured validation lock that limits wallet balance
 * state tracking queries to run only when the system explicitly
 * initializes a transaction signing prompt. (#240)
 *
 * This prevents the extension wallet from being queried on every
 * mouse navigation path, which strains connection links and blocks
 * input paths.
 */

interface WalletBalanceState {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
  signingInitialized: boolean;
}

export function useWalletBalance() {
  const [state, setState] = useState<WalletBalanceState>({
    balance: null,
    isLoading: false,
    error: null,
    signingInitialized: false,
  });

  // Validation lock — prevents duplicate calls while a query is in flight
  const isQueryingRef = useRef(false);

  const queryWalletBalance = useCallback(async () => {
    // Guard: bail out if a query is already in flight
    if (isQueryingRef.current) return;

    isQueryingRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Replace with real Freighter SDK call e.g:
      // const { publicKey } = await getPublicKey();
      // const account = await server.loadAccount(publicKey);
      // const xlmBalance = account.balances.find(b => b.asset_type === "native");
      const mockBalance = 0;

      setState((prev) => ({
        ...prev,
        balance: mockBalance,
        isLoading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to fetch wallet balance",
        isLoading: false,
      }));
    } finally {
      isQueryingRef.current = false;
    }
  }, []);

  /**
   * initializeSigning — the ONLY entry point that unlocks the
   * wallet balance query. Call this when a transaction signing
   * prompt is explicitly triggered by the user.
   */
  const initializeSigning = useCallback(() => {
    setState((prev) => ({ ...prev, signingInitialized: true }));
    queryWalletBalance();
  }, [queryWalletBalance]);

  /**
   * resetSigningLock — resets the validation lock after signing
   * is complete or cancelled.
   */
  const resetSigningLock = useCallback(() => {
    setState((prev) => ({
      ...prev,
      signingInitialized: false,
      balance: null,
    }));
  }, []);

  return {
    ...state,
    initializeSigning,
    resetSigningLock,
  };
}