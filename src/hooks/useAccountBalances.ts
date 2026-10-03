'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface AccountBalance {
  asset: string;
  amount: string;
}

interface BalancesResponse {
  balances: AccountBalance[];
}

export interface UseAccountBalancesResult {
  balances: AccountBalance[];
  byAsset: Readonly<Record<string, string>>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads account balances with stable callbacks and derived selectors. Keeping
 * the request and selector identities stable prevents polling consumers from
 * re-rendering when the account or returned balance values have not changed.
 */
export function useAccountBalances(publicKey: string | null): UseAccountBalancesResult {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalances([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/balances?account=${encodeURIComponent(publicKey)}`);
      if (!response.ok) throw new Error('Unable to load account balances');
      const data = (await response.json()) as BalancesResponse;
      setBalances((previous) =>
        JSON.stringify(previous) === JSON.stringify(data.balances) ? previous : data.balances,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load account balances');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byAsset = useMemo(
    () => Object.freeze(Object.fromEntries(balances.map(({ asset, amount }) => [asset, amount]))),
    [balances],
  );

  return useMemo(
    () => ({ balances, byAsset, isLoading, error, refresh }),
    [balances, byAsset, isLoading, error, refresh],
  );
}

export default useAccountBalances;
