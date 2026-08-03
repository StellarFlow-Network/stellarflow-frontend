"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, AreaData } from 'lightweight-charts';
import OptimizedDialog from '@/app/components/OptimizedDialog';
import { useWallet } from '@/app/components/providers/WalletProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultApyHistory {
  time: number; // Unix timestamp in seconds
  apy: number;
}

export interface VaultAsset {
  symbol: string;
  contractId: string;
  decimals: number;
  iconUrl?: string;
}

export interface VaultStats {
  currentApy: number;
  totalDeposited: number;
  userDepositBalance: string;
  userSfvTokenBalance: string;
  sfvTokenExchangeRate: number; // 1 sfvToken = X underlying assets
  pendingRewards: number;
  nextCompoundTimestamp: number;
}

export interface Vault {
  id: string;
  name: string;
  asset: VaultAsset;
  apyHistory: VaultApyHistory[];
  stats: VaultStats;
}

interface VaultCardProps {
  vault: Vault;
  onDeposit?: (vaultId: string, amount: string) => Promise<string>;
  onWithdraw?: (vaultId: string, amount: string) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Parse amount helper
// ---------------------------------------------------------------------------

function parseAmount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return NaN;
  const parsed = Number(trimmed);
  return isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

// ---------------------------------------------------------------------------
// Countdown timer hook
// ---------------------------------------------------------------------------

function useCountdown(targetTimestamp: number) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTimestamp * 1000 - now);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp]);

  return timeLeft;
}

// ---------------------------------------------------------------------------
// APY Chart Component
// ---------------------------------------------------------------------------

function VaultApyChart({ apyHistory }: { apyHistory: VaultApyHistory[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      height: 200,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
      },
    });

    const areaSeries = chart.addAreaSeries({
      topColor: '#10B98140',
      bottomColor: '#10B98100',
      lineColor: '#10B981',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // Format data for chart
    const formattedData: AreaData<Time>[] = apyHistory.map(d => ({
      time: d.time as Time,
      value: d.apy,
    }));

    areaSeries.setData(formattedData);
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [apyHistory]);

  return <div ref={chartContainerRef} className="w-full" />;
}

// ---------------------------------------------------------------------------
// Deposit/Withdraw Modal
// ---------------------------------------------------------------------------

interface VaultActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  mode: 'deposit' | 'withdraw';
  onSubmit: (amount: string) => Promise<void>;
  isSubmitting: boolean;
}

function VaultActionModal({
  isOpen,
  onClose,
  vault,
  mode,
  onSubmit,
  isSubmitting,
}: VaultActionModalProps) {
  const [amount, setAmount] = useState<string>('');
  const { wallet } = useWallet();

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);
  
  const estimatedSfvTokens = useMemo(() => {
    if (!parsedAmount || mode !== 'deposit') return null;
    return parsedAmount / vault.stats.sfvTokenExchangeRate;
  }, [parsedAmount, mode, vault.stats.sfvTokenExchangeRate]);

  const estimatedAssetsReturned = useMemo(() => {
    if (!parsedAmount || mode !== 'withdraw') return null;
    return parsedAmount * vault.stats.sfvTokenExchangeRate;
  }, [parsedAmount, mode, vault.stats.sfvTokenExchangeRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) return;
    await onSubmit(amount);
    setAmount('');
    onClose();
  };

  const availableBalance = mode === 'deposit' 
    ? parseFloat(wallet?.balances?.[vault.asset.contractId] || '0')
    : parseFloat(vault.stats.userSfvTokenBalance);

  const handleSetMax = () => {
    setAmount(availableBalance.toString());
  };

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${mode === 'deposit' ? 'Deposit' : 'Withdraw'} ${vault.asset.symbol}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Exchange rate info */}
        <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/50">
          <p className="text-sm text-blue-300">
            Current exchange rate: 1 sfv{vault.asset.symbol} = {vault.stats.sfvTokenExchangeRate.toFixed(6)} {vault.asset.symbol}
          </p>
        </div>

        {/* Amount Input */}
        <div className="rounded-xl bg-gray-800/60 p-4 border border-gray-800">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Amount</span>
            <span>
              Available: {availableBalance.toFixed(4)} {mode === 'withdraw' ? `sfv${vault.asset.symbol}` : vault.asset.symbol}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.0001"
              placeholder="0.0000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-2xl font-bold text-white outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleSetMax}
              className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-semibold hover:bg-blue-600/30"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Conversion estimate */}
        {parsedAmount > 0 && (
          <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">
                {mode === 'deposit' ? 'You will mint (estimated):' : 'You will receive (estimated):'}
              </span>
              <span className="text-white font-mono font-semibold">
                {mode === 'deposit' 
                  ? `${estimatedSfvTokens?.toFixed(6)} sfv${vault.asset.symbol}`
                  : `${estimatedAssetsReturned?.toFixed(6)} ${vault.asset.symbol}`
                }
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !parsedAmount || parsedAmount > availableBalance}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
              isSubmitting || !parsedAmount || parsedAmount > availableBalance
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isSubmitting ? 'Processing...' : mode === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        </div>
      </form>
    </OptimizedDialog>
  );
}

// ---------------------------------------------------------------------------
// Main VaultCard Component
// ---------------------------------------------------------------------------

export const VaultCard: React.FC<VaultCardProps> = ({ vault, onDeposit, onWithdraw }) => {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const nextCompoundCountdown = useCountdown(vault.stats.nextCompoundTimestamp);

  // Format countdown string
  const countdownString = useMemo(() => {
    const { hours, minutes, seconds } = nextCompoundCountdown;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [nextCompoundCountdown]);

  const handleDeposit = async (amount: string) => {
    if (!onDeposit) return;
    setIsSubmitting(true);
    try {
      await onDeposit(vault.id, amount);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (amount: string) => {
    if (!onWithdraw) return;
    setIsSubmitting(true);
    try {
      await onWithdraw(vault.id, amount);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUserBalance = parseFloat(vault.stats.userSfvTokenBalance) > 0;

  return (
    <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
      {/* Vault Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">{vault.asset.symbol.charAt(0)}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{vault.name}</h3>
            <p className="text-sm text-gray-400">{vault.asset.symbol} Auto-Compounding Vault</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">{vault.stats.currentApy.toFixed(2)}%</div>
          <p className="text-xs text-gray-400">Current APY</p>
        </div>
      </div>

      {/* APY History Chart */}
      <div className="mb-6 rounded-xl bg-gray-800/40 p-4 border border-gray-800">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Historical APY Performance</h4>
        <VaultApyChart apyHistory={vault.apyHistory} />
      </div>

      {/* Vault Statistics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Total Deposited</p>
          <p className="text-lg font-bold text-white font-mono">
            ${vault.stats.totalDeposited.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Pending Rewards</p>
          <p className="text-lg font-bold text-yellow-400 font-mono">
            {vault.stats.pendingRewards.toFixed(4)} {vault.asset.symbol}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Your sfvToken Balance</p>
          <p className="text-lg font-bold text-white font-mono">
            {parseFloat(vault.stats.userSfvTokenBalance).toFixed(6)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800/40 p-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-1">Next Auto-Compound</p>
          <p className="text-lg font-bold text-blue-400 font-mono">{countdownString}</p>
        </div>
      </div>

      {/* User Position Details */}
      {hasUserBalance && (
        <div className="mb-6 rounded-lg bg-blue-900/20 p-4 border border-blue-700/50">
          <h4 className="text-sm font-semibold text-blue-300 mb-3">Your Position</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Deposited Balance</p>
              <p className="text-white font-mono">{vault.stats.userDepositBalance} {vault.asset.symbol}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">sfvToken Exchange Rate</p>
              <p className="text-white font-mono">1 = {vault.stats.sfvTokenExchangeRate.toFixed(6)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsDepositModalOpen(true)}
          className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Deposit
        </button>
        <button
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={!hasUserBalance}
          className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
            !hasUserBalance
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Modals */}
      <VaultActionModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        vault={vault}
        mode="deposit"
        onSubmit={handleDeposit}
        isSubmitting={isSubmitting}
      />
      <VaultActionModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        vault={vault}
        mode="withdraw"
        onSubmit={handleWithdraw}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default VaultCard;