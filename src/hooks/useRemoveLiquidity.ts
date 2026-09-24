'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/ToastQueue';

export interface RemoveLiquidityParams {
  poolId: string;
  lpAmount: string;
  minTokenA: string;
  minTokenB: string;
}

export interface UseRemoveLiquidityReturn {
  removeLiquidity: (params: RemoveLiquidityParams) => Promise<void>;
  isRemoving: boolean;
}

export function useRemoveLiquidity(): UseRemoveLiquidityReturn {
  const [isRemoving, setIsRemoving] = useState(false);
  const { addToast, updateToast } = useToast();

  const removeLiquidity = useCallback(async (params: RemoveLiquidityParams) => {
    setIsRemoving(true);
    const toastId = addToast({
      title: 'Removing Liquidity',
      description: 'Submitting transaction to burn LP tokens...',
      status: 'processing',
    });

    try {
      // Simulate network latency for Soroban transaction submission
      await new Promise((resolve) => setTimeout(resolve, 1500));
      void params;

      updateToast(toastId, {
        status: 'confirmed',
        title: 'Liquidity Removed',
        description: 'Successfully burned LP tokens and retrieved pool reserves.',
      });
    } catch (err) {
      updateToast(toastId, {
        status: 'failed',
        title: 'Removal failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
      throw err;
    } finally {
      setIsRemoving(false);
    }
  }, [addToast, updateToast]);

  return { removeLiquidity, isRemoving };
}
