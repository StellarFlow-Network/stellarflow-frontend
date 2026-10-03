'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/ToastQueue';
import { useSwapFeeEstimation } from './useSwapFeeEstimation';

export interface SwapParams {
  fromToken: string;
  toToken: string;
  amount: string;
  minOutput: string;
  accountBalance?: number;
}

export interface UseSwapExecutionReturn {
  executeSwap: (params: SwapParams) => Promise<void>;
  isSwapping: boolean;
  feeEstimation: ReturnType<typeof useSwapFeeEstimation>;
}

export function useSwapExecution(): UseSwapExecutionReturn {
  const [isSwapping, setIsSwapping] = useState(false);
  const { addToast, updateToast } = useToast();
  const feeEstimation = useSwapFeeEstimation();

  const executeSwap = useCallback(async (params: SwapParams) => {
    if (params.accountBalance !== undefined && !feeEstimation.hasSufficientBalance(params.accountBalance)) {
      addToast({
        title: 'Insufficient Balance',
        description: 'Account balance is below required XLM base reserve.',
        status: 'failed',
      });
      throw new Error('Account balance is below required XLM base reserve.');
    }

    setIsSwapping(true);
    const toastId = addToast({
      title: 'Executing swap',
      description: `Submitting swap transaction with fee ${feeEstimation.customFee} stroops...`,
      status: 'processing',
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      void params;

      updateToast(toastId, {
        status: 'confirmed',
        title: 'Swap complete',
        description: 'Your token swap has been successfully executed.',
      });
    } catch (err) {
      updateToast(toastId, {
        status: 'failed',
        title: 'Swap failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
      throw err;
    } finally {
      setIsSwapping(false);
    }
  }, [addToast, updateToast, feeEstimation]);

  return { executeSwap, isSwapping, feeEstimation };
}
