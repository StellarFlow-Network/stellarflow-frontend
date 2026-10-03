"use client";

import { useEffect, useState } from "react";
import type { NetworkContext } from "@/lib/txSpeedUpOps";
import {
  fetchDemoPendingTransfers,
  type DemoPendingTransfer,
} from "@/lib/demoPendingTransactions";

interface PendingTransactionsFeedResult {
  transfers: DemoPendingTransfer[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Surfaces the account's currently in-flight submissions so the UI can offer
 * a speed-up or cancel rescue once one has sat unconfirmed too long.
 *
 * Backed by {@link fetchDemoPendingTransfers} until a real "list my pending
 * submissions" endpoint exists — see that module's header for why the demo
 * envelopes are still genuine, signed transactions rather than static
 * fixtures.
 */
export function usePendingTransactionsFeed(
  network: NetworkContext,
): PendingTransactionsFeedResult {
  const [transfers, setTransfers] = useState<DemoPendingTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchDemoPendingTransfers(network)
      .then((result) => {
        if (!cancelled) setTransfers(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load pending transactions.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // network identity (passphrase) is what actually changes the envelopes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network.networkPassphrase]);

  return { transfers, isLoading, error };
}
