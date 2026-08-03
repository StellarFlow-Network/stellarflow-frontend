import React, { useState, useMemo } from 'react';
import { useWallet } from '@/app/components/providers/WalletProvider';
import { useRemoveLiquidity } from '@/hooks/useRemoveLiquidity';
import { formatTokenAmount } from '@/utils/formatters';

export interface PoolPosition {
  poolId: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  userLpBalance: string; // BigNumber or string representation
  reserveA: string;      // Total pool reserve A
  reserveB: string;      // Total pool reserve B
  totalLpSupply: string; // Total pool LP supply
}

interface RemoveLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PoolPosition;
  onSuccess?: () => void;
}

const PRESET_PERCENTAGES = [25, 50, 75, 100];

export const RemoveLiquidityModal: React.FC<RemoveLiquidityModalProps> = ({
  isOpen,
  onClose,
  position,
  onSuccess,
}) => {
  const { isConnected } = useWallet();
  const { removeLiquidity, isRemoving } = useRemoveLiquidity();

  const [percentage, setPercentage] = useState<number>(50);

  // Calculate real-time token payout amounts based on slider percentage
  const { lpToBurn, payoutA, payoutB } = useMemo(() => {
    const userLp = parseFloat(position.userLpBalance) || 0;
    const totalLp = parseFloat(position.totalLpSupply) || 1;
    const resA = parseFloat(position.reserveA) || 0;
    const resB = parseFloat(position.reserveB) || 0;

    const burnAmount = (userLp * percentage) / 100;
    const shareRatio = burnAmount / totalLp;

    const tokenAPayout = resA * shareRatio;
    const tokenBPayout = resB * shareRatio;

    return {
      lpToBurn: burnAmount.toString(),
      payoutA: tokenAPayout.toString(),
      payoutB: tokenBPayout.toString(),
    };
  }, [percentage, position]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!isConnected || parseFloat(lpToBurn) <= 0) return;

    try {
      await removeLiquidity({
        poolId: position.poolId,
        lpAmount: lpToBurn,
        minTokenA: payoutA, // Apply slippage bounds in production hook
        minTokenB: payoutB,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to remove liquidity:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Remove Liquidity</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Percentage Display & Slider */}
        <div className="mb-6 rounded-xl bg-gray-800/50 p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Amount to Remove</span>
            <span className="text-3xl font-bold text-blue-400">{percentage}%</span>
          </div>

          <input
            type="range"
            min="1"
            max="100"
            value={percentage}
            onChange={(e) => setPercentage(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-4"
          />

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {PRESET_PERCENTAGES.map((preset) => (
              <button
                key={preset}
                onClick={() => setPercentage(preset)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  percentage === preset
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Payout Preview */}
        <div className="space-y-3 mb-6">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            You Will Receive (Estimated)
          </span>

          <div className="flex items-center justify-between rounded-lg bg-gray-800/30 p-3 border border-gray-800">
            <span className="font-medium text-white">{position.tokenASymbol}</span>
            <span className="font-mono text-green-400 font-semibold">
              {formatTokenAmount(payoutA)}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-800/30 p-3 border border-gray-800">
            <span className="font-medium text-white">{position.tokenBSymbol}</span>
            <span className="font-mono text-green-400 font-semibold">
              {formatTokenAmount(payoutB)}
            </span>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-gray-400">
            <span>LP Tokens to Burn</span>
            <span className="font-mono">{formatTokenAmount(lpToBurn)} LP</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleExecute}
          disabled={!isConnected || isRemoving || parseFloat(lpToBurn) <= 0}
          className={`w-full py-3 rounded-xl font-bold transition-all ${
            isRemoving
              ? 'bg-red-600/70 text-white cursor-wait'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-red-600/20'
          }`}
        >
          {isRemoving ? 'Burning LP Tokens...' : 'Confirm Liquidity Removal'}
        </button>
      </div>
    </div>
  );
};