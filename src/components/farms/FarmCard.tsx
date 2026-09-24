import React, { useState, useEffect } from 'react';
import { formatTokenAmount, formatCountdown } from '@/utils/formatters';
import YieldFarmModal from './YieldFarmModal';

export interface FarmPool {
  id: string;
  poolName: string;
  pairTokens: [string, string];
  apr: number;
  userStakedLP: string;
  walletLpBalance?: string;
  claimableRewards: string;
  rewardSymbol: string;
  rewardEmissionRate?: string;
  lockExpiryTimestamp: number | null; // Unix timestamp in seconds
}

interface FarmCardProps {
  farm: FarmPool;
  onRefresh?: () => void;
}

export const FarmCard: React.FC<FarmCardProps> = ({ farm, onRefresh }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);

  // Lockup countdown timer calculation
  useEffect(() => {
    if (!farm.lockExpiryTimestamp) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = farm.lockExpiryTimestamp! - now;
      setTimeLeft(remaining > 0 ? remaining : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [farm.lockExpiryTimestamp]);

  const isLocked = farm.lockExpiryTimestamp !== null && timeLeft > 0;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-lg hover:border-gray-700 transition-all">
      {/* Header: Pool Pair & APR */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="flex -space-x-2">
            <span className="inline-block h-8 w-8 rounded-full bg-blue-600 text-center leading-8 font-bold text-xs text-white">
              {farm.pairTokens[0]}
            </span>
            <span className="inline-block h-8 w-8 rounded-full bg-purple-600 text-center leading-8 font-bold text-xs text-white">
              {farm.pairTokens[1]}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white">{farm.poolName}</h3>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 uppercase tracking-wider">APR</span>
          <p className="text-xl font-bold text-green-400">{farm.apr.toFixed(2)}%</p>
        </div>
      </div>

      <hr className="border-gray-800 my-4" />

      {/* Staked Position & Real-Time Claimable Rewards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-xs text-gray-400">Staked LP</span>
          <p className="text-base font-medium text-white">
            {formatTokenAmount(farm.userStakedLP)} LP
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-400">Claimable Yield</span>
          <p className="text-base font-medium text-yellow-400">
            {formatTokenAmount(farm.claimableRewards)} {farm.rewardSymbol}
          </p>
        </div>
      </div>

      {/* Lockup Status & Countdown */}
      {farm.lockExpiryTimestamp !== null && (
        <div className="mb-4 rounded-lg bg-gray-800/60 p-3 flex items-center justify-between text-xs">
          <span className="text-gray-400">Lockup Period:</span>
          {isLocked ? (
            <span className="font-mono text-amber-400 font-semibold">
              🔒 {formatCountdown(timeLeft)}
            </span>
          ) : (
            <span className="text-green-400 font-semibold">Unlocked</span>
          )}
        </div>
      )}

      {/* Action Button: Manage the farm position */}
      <button
        onClick={() => setIsFarmModalOpen(true)}
        className="w-full rounded-lg bg-yellow-500 px-4 py-2.5 font-semibold text-gray-950 shadow-md transition-all duration-200 hover:bg-yellow-400 hover:shadow-yellow-500/20"
      >
        Manage farm
      </button>

      <YieldFarmModal
        isOpen={isFarmModalOpen}
        onClose={() => setIsFarmModalOpen(false)}
        farm={farm}
        onRefresh={onRefresh}
      />
    </div>
  );
};
