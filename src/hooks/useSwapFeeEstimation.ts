'use client';

import { useState, useEffect, useCallback } from 'react';
import { rpc } from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const BASE_RESERVE_XLMS = 1.5; // Minimum required XLM base reserve + fee buffer

export interface UseSwapFeeEstimationReturn {
  recommendedFee: string;
  customFee: string;
  setCustomFee: (fee: string) => void;
  isLoadingFee: boolean;
  feeError: string | null;
  hasSufficientBalance: (accountBalanceXlm: number) => boolean;
  refreshFee: () => Promise<void>;
}

export function useSwapFeeEstimation(): UseSwapFeeEstimationReturn {
  const [recommendedFee, setRecommendedFee] = useState<string>('100');
  const [customFee, setCustomFee] = useState<string>('100');
  const [isLoadingFee, setIsLoadingFee] = useState<boolean>(false);
  const [feeError, setFeeError] = useState<string | null>(null);

  const fetchFee = useCallback(async () => {
    setIsLoadingFee(true);
    setFeeError(null);
    try {
      const server = new rpc.Server(SOROBAN_RPC_URL);
      const feeStats = await server.getFeeStats();
      const baseFee = feeStats?.soroban_inclusion_fee?.max ?? feeStats?.fee_charged?.max ?? '100';
      const feeStr = String(baseFee);
      setRecommendedFee(feeStr);
      setCustomFee((prev) => (Number(prev) < Number(feeStr) ? feeStr : prev));
    } catch (err) {
      // Fallback to default if RPC fails
      setRecommendedFee('100');
      setFeeError(err instanceof Error ? err.message : 'Failed to fetch network fee');
    } finally {
      setIsLoadingFee(false);
    }
  }, []);

  useEffect(() => {
    void fetchFee();
  }, [fetchFee]);

  const hasSufficientBalance = useCallback((accountBalanceXlm: number) => {
    return accountBalanceXlm >= BASE_RESERVE_XLMS;
  }, []);

  return {
    recommendedFee,
    customFee,
    setCustomFee,
    isLoadingFee,
    feeError,
    hasSufficientBalance,
    refreshFee: fetchFee,
  };
}
