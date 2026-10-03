'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Settings,
  Trash2,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastQueue';

export interface AutoCompoundConfig {
  enabled: boolean;
  maxKeeperFeePercent: number;
  nextHarvestAt: number;
  keeperAddress: string;
  delegationTxHash?: string;
}

const DEFAULT_MAX_KEEPER_FEE = 1;

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function AutoCompoundScheduler() {
  const { addToast } = useToast();
  
  const [config, setConfig] = useState<AutoCompoundConfig>(() => ({
    enabled: false,
    maxKeeperFeePercent: DEFAULT_MAX_KEEPER_FEE,
    nextHarvestAt: Math.floor(Date.now() / 1000) + 8 * 3600,
    keeperAddress: '',
    delegationTxHash: undefined,
  }));
  
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFeeHelp, setShowFeeHelp] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = config.nextHarvestAt - now;
      setTimeRemaining(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [config.nextHarvestAt]);

  // Simulate fetching config from blockchain
  useEffect(() => {
    const fetchConfig = async () => {
      // In production: fetch from contract
      await new Promise((r) => setTimeout(r, 500));
      setConfig({
        enabled: true,
        maxKeeperFeePercent: 1,
        nextHarvestAt: Math.floor(Date.now() / 1000) + 2 * 3600 + 30 * 60,
        keeperAddress: 'GD3XK7W2VJQK5X7Y2Z4W6V8X1Y3Z5W7V9X2Y4Z6W8X1Y3Z5W7V9X2Y4Z6',
        delegationTxHash: 'a1b2c3d4e5f6...',
      });
    };
    fetchConfig();
  }, []);

  const handleUpdateConfig = async () => {
    setIsUpdating(true);
    try {
      // In production: call contract to update max fee
      await new Promise((r) => setTimeout(r, 1000));
      addToast({
        title: 'Configuration Updated',
        description: `Max keeper fee set to ${config.maxKeeperFeePercent}%`,
        status: 'confirmed',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Failed to update configuration',
        status: 'failed',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevokeDelegation = async () => {
    setIsRevoking(true);
    try {
      // In production: call contract to revoke delegation
      await new Promise((r) => setTimeout(r, 1500));
      setConfig((prev) => ({
        ...prev,
        enabled: false,
        delegationTxHash: undefined,
      }));
      addToast({
        title: 'Delegation Revoked',
        description: 'Auto-compound delegation has been cancelled',
        status: 'confirmed',
      });
    } catch (err) {
      addToast({
        title: 'Revocation Failed',
        description: err instanceof Error ? err.message : 'Failed to revoke delegation',
        status: 'failed',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleEnableDelegation = async () => {
    setIsUpdating(true);
    try {
      // In production: call contract to enable delegation
      await new Promise((r) => setTimeout(r, 1500));
      setConfig((prev) => ({
        ...prev,
        enabled: true,
        delegationTxHash: 'tx_' + Math.random().toString(36).substring(7),
      }));
      addToast({
        title: 'Delegation Enabled',
        description: 'Auto-compound delegation activated',
        status: 'confirmed',
      });
    } catch (err) {
      addToast({
        title: 'Enable Failed',
        description: err instanceof Error ? err.message : 'Failed to enable delegation',
        status: 'failed',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/20">
            <Zap size={20} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Auto-Compound Scheduler</h3>
            <p className="text-xs text-gray-500">Delegate yield harvesting to keeper bots</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            config.enabled
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
          }`}>
            {config.enabled ? (
              <>
                <CheckCircle2 size={10} /> Active
              </>
            ) : (
              <>
                <Clock size={10} /> Inactive
              </>
            )}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Next Harvest Countdown */}
        <div className="relative rounded-lg border border-gray-700/50 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Clock size={12} /> Next Scheduled Harvest
          </div>
          <div className="font-mono text-2xl font-bold text-gray-100">
            {timeRemaining > 0 ? formatCountdown(timeRemaining) : 'Due now'}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {timeRemaining > 0
              ? `Approximately ${formatTimestamp(config.nextHarvestAt)}`
              : 'Harvest overdue - keeper should execute soon'}
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-1000"
              style={{
                width: `${Math.max(0, Math.min(100, 100 - (timeRemaining / (8 * 3600)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Keeper Info */}
        <div className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Shield size={12} /> Assigned Keeper
          </div>
          <div className="font-mono text-sm text-gray-300 break-all">
            {config.keeperAddress
              ? `${config.keeperAddress.slice(0, 8)}...${config.keeperAddress.slice(-8)}`
              : 'Not assigned'}
          </div>
          {config.delegationTxHash && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span>Delegation TX:</span>
              <span className="font-mono text-gray-400">{config.delegationTxHash}</span>
            </div>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-200">Keeper Service Fee Limit</span>
            <button
              type="button"
              onClick={() => setShowFeeHelp(!showFeeHelp)}
              className="p-1 text-gray-500 hover:text-gray-300"
              aria-label="Fee help"
            >
              <Info size={12} />
            </button>
          </div>
        </div>

        {showFeeHelp && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <p>Maximum fee you&apos;re willing to pay the keeper bot for auto-compounding service.</p>
            <p className="mt-1">Default: 1% of harvested yield. Higher fees may attract more reliable keepers.</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={config.maxKeeperFeePercent}
            onChange={(e) => setConfig((prev) => ({ ...prev, maxKeeperFeePercent: parseFloat(e.target.value) || 0 }))}
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:border-violet-500"
            aria-label="Max keeper fee percent"
          />
          <span className="text-gray-400">%</span>
          <span className="text-xs text-gray-500">(default 1%, max 10%)</span>
        </div>

        <button
          type="button"
          onClick={handleUpdateConfig}
          disabled={isUpdating}
          className="w-full sm:w-auto px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
        >
          {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
          {isUpdating ? 'Updating…' : 'Update Fee Limit'}
        </button>
      </div>

      {/* Delegation Controls */}
      <div className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-200">Delegation Control</span>
          </div>
        </div>

        {config.enabled ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={16} />
                <span>Auto-compounding is <strong>active</strong></span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRevokeDelegation}
              disabled={isRevoking}
              className="w-full px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {isRevoking ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isRevoking ? 'Revoking…' : 'Revoke Delegation'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Revoking stops future auto-compounding. Pending harvests will complete normally.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock size={16} />
                <span>Auto-compounding is <strong>inactive</strong></span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableDelegation}
              disabled={isUpdating}
              className="w-full px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {isUpdating ? 'Enabling…' : 'Enable Auto-Compound'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Delegates harvesting rights to keeper bot. You can revoke anytime.
            </p>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-violet-400 shrink-0 mt-0.5" />
          <div className="text-sm text-violet-300 space-y-2">
            <p><strong>How it works:</strong> Keeper bots monitor your staked positions and automatically compound rewards when gas-efficient.</p>
            <p><strong>Fee structure:</strong> Keepers charge a service fee (capped at your limit) from harvested yield.</p>
            <p><strong>Security:</strong> Delegation is revocable at any time. Keepers cannot access your principal.</p>
            <p><strong>Schedule:</strong> Harvests typically run every 8 hours, subject to network conditions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutoCompoundScheduler;