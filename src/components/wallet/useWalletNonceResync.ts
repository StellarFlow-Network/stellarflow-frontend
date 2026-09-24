"use client";

import { useNetwork } from "@/app/components/providers/NetworkProvider";
import { useWallet } from "@/app/components/providers/WalletProvider";
import { useCallback, useState } from "react";

export interface NonceResyncResult {
  success: boolean;
  sequence?: string;
  error?: string;
}

export interface UseWalletNonceResyncReturn {
  resyncNonce: () => Promise<NonceResyncResult>;
  isResyncing: boolean;
  lastResyncedAt: number | null;
  lastSequence: string | null;
}

const STORAGE_KEY = "stellarflow-wallet-nonce";

function getStoredNonce(): { sequence: string; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveNonce(sequence: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sequence, timestamp: Date.now() }));
}

/**
 * Hook for wallet nonce resynchronization.
 * Queries the latest sequence number from Horizon RPC and updates local state.
 */
export function useWalletNonceResync(): UseWalletNonceResyncReturn {
  const { clients } = useNetwork();
  const { wallet } = useWallet();
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastResyncedAt, setLastResyncedAt] = useState<number | null>(null);
  const [lastSequence, setLastSequence] = useState<string | null>(() => {
    const stored = getStoredNonce();
    return stored?.sequence ?? null;
  });

  const resyncNonce = useCallback(async (): Promise<NonceResyncResult> => {
    const publicKey = wallet?.publicKey;
    const horizon = clients?.horizon;

    if (!publicKey || !horizon) {
      return { success: false, error: "Wallet not connected or Horizon client not ready" };
    }

    setIsResyncing(true);

    try {
      // Fetch account from Horizon to get the current sequence number
      const horizonClient = horizon;
      if (!horizonClient) throw new Error("Horizon client not available");
      const account = await (horizonClient as unknown as { loadAccount: (pk: string) => Promise<{ sequenceNumber: () => string }> }).loadAccount(publicKey);
      const sequence = account.sequenceNumber();

      // Save to local storage
      saveNonce(sequence);
      setLastSequence(sequence);
      setLastResyncedAt(Date.now());

      return { success: true, sequence };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resync nonce";
      return { success: false, error: errorMessage };
    } finally {
      setIsResyncing(false);
    }
  }, [wallet?.publicKey, clients?.horizon]);

  return {
    resyncNonce,
    isResyncing,
    lastResyncedAt,
    lastSequence,
  };
}