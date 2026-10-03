'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/ToastQueue';

export interface UseHarvestRewardsReturn {
  harvestRewards: (farmId: string) => Promise<void>;
  isHarvesting: boolean;
}

export function useHarvestRewards(): UseHarvestRewardsReturn {
  const [isHarvesting, setIsHarvesting] = useState(false);
  const { addToast, updateToast } = useToast();

  const harvestRewards = useCallback(async (farmId: string) => {
    setIsHarvesting(true);
    const toastId = addToast({
      title: 'Harvesting rewards',
      description: 'Submitting transaction to claim yield...',
      status: 'processing',
    });

    try {
      // Simulate network latency for Soroban transaction submission
      await new Promise((resolve) => setTimeout(resolve, 1500));
      void farmId;

      updateToast(toastId, {
        status: 'confirmed',
        title: 'Rewards harvested',
        description: 'Your claimable yield has been successfully transferred to your wallet.',
      });
    } catch (err) {
      updateToast(toastId, {
        status: 'failed',
        title: 'Harvest failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
      throw err;
    } finally {
      setIsHarvesting(false);
    }
  }, [addToast, updateToast]);

  return { harvestRewards, isHarvesting };
}
