'use client';

import React, { useEffect, useMemo, useState } from 'react';
import OptimizedDialog from '@/app/components/OptimizedDialog';
import { useWallet } from '@/app/components/providers/WalletProvider';
import { useHarvestRewards } from '@/hooks/useHarvestRewards';
import { useToast } from '@/components/ui/ToastQueue';
import { formatTokenAmount } from '@/utils/formatters';
import type { FarmPool } from './FarmCard';

type FarmAction = 'stake' | 'unstake';

interface YieldFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: FarmPool;
  onRefresh?: () => void;
}

export function YieldFarmModal({ isOpen, onClose, farm, onRefresh }: YieldFarmModalProps) {
  const { wallet } = useWallet();
  const { addToast, updateToast } = useToast();
  const { harvestRewards, isHarvesting } = useHarvestRewards();
  const [action, setAction] = useState<FarmAction>('stake');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableBalance = action === 'stake' ? farm.walletLpBalance : farm.userStakedLP;
  const numericAmount = Number(amount);
  const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0 && (action === 'stake' || numericAmount <= Number(availableBalance));
  const emissionRate = farm.rewardEmissionRate ?? `${(farm.apr / 365).toFixed(4)}% APR/day`;

  useEffect(() => {
    if (isOpen) {
      setAction('stake');
      setAmount('');
    }
  }, [isOpen]);

  const claimable = useMemo(() => formatTokenAmount(farm.claimableRewards), [farm.claimableRewards]);

  const handleSubmit = async () => {
    if (!wallet?.connected || !hasValidAmount || isSubmitting) return;

    setIsSubmitting(true);
    const toastId = addToast({
      title: action === 'stake' ? 'Staking LP tokens' : 'Unstaking LP tokens',
      description: 'Submitting transaction to the yield farm...',
      status: 'processing',
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      updateToast(toastId, {
        status: 'confirmed',
        title: action === 'stake' ? 'LP tokens staked' : 'LP tokens unstaked',
        description: `${formatTokenAmount(amount)} LP tokens were successfully ${action === 'stake' ? 'staked' : 'unstaked'}.`,
      });
      setAmount('');
      onRefresh?.();
      onClose();
    } catch (error) {
      updateToast(toastId, {
        status: 'failed',
        title: 'Farm transaction failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompound = async () => {
    if (!wallet?.connected || Number(farm.claimableRewards) <= 0 || isHarvesting) return;
    try {
      await harvestRewards(farm.id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to claim and reinvest rewards:', error);
    }
  };

  return (
    <OptimizedDialog isOpen={isOpen} onClose={onClose} title={`Farm ${farm.poolName}`} size="md">
      <div className="space-y-5 text-gray-100">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
            <p className="text-xs text-gray-400">Reward emission</p>
            <p className="mt-1 font-semibold text-emerald-400">{emissionRate}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
            <p className="text-xs text-gray-400">Pending rewards</p>
            <p className="mt-1 font-semibold text-amber-400">{claimable} {farm.rewardSymbol}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCompound}
          disabled={!wallet?.connected || Number(farm.claimableRewards) <= 0 || isHarvesting}
          className="w-full rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isHarvesting ? 'Claiming and reinvesting...' : 'Claim & Reinvest'}
        </button>

        <div className="flex rounded-lg bg-gray-900 p-1" role="tablist" aria-label="Farm position action">
          {(['stake', 'unstake'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={action === option}
              onClick={() => { setAction(option); setAmount(''); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize transition ${action === option ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {option}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <label htmlFor="farm-lp-amount" className="text-gray-300">LP token amount</label>
            <span className="text-gray-500">{action === 'stake' && !availableBalance ? 'Wallet balance checked on submit' : `Available: ${formatTokenAmount(availableBalance ?? '0')} LP`}</span>
          </div>
          <div className="flex items-center rounded-lg border border-gray-700 bg-gray-900 px-3 focus-within:border-blue-500">
            <input
              id="farm-lp-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent py-3 text-lg text-white outline-none placeholder:text-gray-600"
            />
            {availableBalance && <button type="button" onClick={() => setAmount(availableBalance)} className="text-xs font-semibold text-blue-400 hover:text-blue-300">MAX</button>}
          </div>
          {action === 'stake' && <p className="mt-2 text-xs text-gray-500">Your wallet LP balance will be checked when the transaction is submitted.</p>}
          {action === 'unstake' && amount && numericAmount > Number(availableBalance) && <p className="mt-2 text-xs text-red-400">Amount exceeds your staked LP balance.</p>}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!wallet?.connected || !hasValidAmount || isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!wallet?.connected ? 'Connect wallet to continue' : isSubmitting ? `${action === 'stake' ? 'Staking' : 'Unstaking'} LP tokens...` : `${action === 'stake' ? 'Stake' : 'Unstake'} LP tokens`}
        </button>
      </div>
    </OptimizedDialog>
  );
}

export default YieldFarmModal;