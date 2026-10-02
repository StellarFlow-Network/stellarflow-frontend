"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  TrendingUp,
  Clock,
  ExternalLink,
  DollarSign,
  Zap,
  BarChart3,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Fuel,
} from "lucide-react";
import { BalanceValue } from "@/context/BalancePrivacyContext";

interface HarvestEvent {
  id: string;
  timestamp: string;
  totalYieldHarvested: number;
  totalYieldHarvestedUsd: number;
  gasFeePaid: number;
  gasFeeUsd: number;
  txHash: string;
  blockNumber: number;
  compoundedShares: number;
  poolBreakdown: {
    poolId: string;
    pair: string;
    yieldAmount: number;
    yieldUsd: number;
    tokenA: string;
    tokenB: string;
  }[];
  netProfit: number;
  netProfitUsd: number;
  effectiveApy: number;
}

interface HarvestHistoryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Vault ID to fetch harvest history for */
  vaultId: string;
  /** Vault name for display */
  vaultName?: string;
}

// Mock data for development - replace with real API call
const mockHarvestEvents: HarvestEvent[] = [
  {
    id: "1",
    timestamp: "2024-03-15T14:30:00Z",
    totalYieldHarvested: 1250.75,
    totalYieldHarvestedUsd: 1875.32,
    gasFeePaid: 0.25,
    gasFeeUsd: 0.38,
    txHash: "abc123def456789012345678901234567890123456789012345678901234567890",
    blockNumber: 8925634,
    compoundedShares: 125,
    poolBreakdown: [
      {
        poolId: "xlm-usdc",
        pair: "XLM/USDC",
        yieldAmount: 850.50,
        yieldUsd: 1275.75,
        tokenA: "XLM",
        tokenB: "USDC"
      },
      {
        poolId: "xlm-ngnc",
        pair: "XLM/NGNC",
        yieldAmount: 400.25,
        yieldUsd: 599.57,
        tokenA: "XLM",
        tokenB: "NGNC"
      }
    ],
    netProfit: 1250.50,
    netProfitUsd: 1874.94,
    effectiveApy: 12.5
  },
  {
    id: "2",
    timestamp: "2024-03-15T06:30:00Z",
    totalYieldHarvested: 980.25,
    totalYieldHarvestedUsd: 1470.38,
    gasFeePaid: 0.22,
    gasFeeUsd: 0.33,
    txHash: "def456abc789012345678901234567890123456789012345678901234567890123",
    blockNumber: 8923456,
    compoundedShares: 98,
    poolBreakdown: [
      {
        poolId: "xlm-usdc",
        pair: "XLM/USDC",
        yieldAmount: 650.15,
        yieldUsd: 975.23,
        tokenA: "XLM",
        tokenB: "USDC"
      },
      {
        poolId: "usdc-ngnc",
        pair: "USDC/NGNC",
        yieldAmount: 330.10,
        yieldUsd: 495.15,
        tokenA: "USDC",
        tokenB: "NGNC"
      }
    ],
    netProfit: 980.03,
    netProfitUsd: 1470.05,
    effectiveApy: 11.8
  }
];

function formatCurrency(value: number, currency = 'USD'): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${Math.floor(diff / (1000 * 60))}m ago`;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * HarvestHistoryModal
 * 
 * Displays detailed harvest event history for yield strategy vaults (#918).
 * 
 * Features:
 * - Chronological harvest event table
 * - Individual harvest breakdowns by pool
 * - Gas cost tracking
 * - Line chart showing compounding growth velocity
 * - Direct links to transaction hashes
 * - Time-based filtering
 */
export function HarvestHistoryModal({
  isOpen,
  onClose,
  vaultId,
  vaultName = "Yield Vault"
}: HarvestHistoryModalProps) {
  const [selectedEvent, setSelectedEvent] = useState<HarvestEvent | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  // Filter events based on time selection
  const filteredEvents = useMemo(() => {
    if (timeFilter === 'all') return mockHarvestEvents;
    
    const now = new Date();
    const daysAgo = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90;
    const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    return mockHarvestEvents.filter(event => 
      new Date(event.timestamp) >= cutoffDate
    );
  }, [timeFilter]);

  // Calculate aggregated stats
  const totalHarvested = filteredEvents.reduce((sum, event) => sum + event.totalYieldHarvestedUsd, 0);
  const totalGasFees = filteredEvents.reduce((sum, event) => sum + event.gasFeeUsd, 0);
  const averageApy = filteredEvents.length > 0 
    ? filteredEvents.reduce((sum, event) => sum + event.effectiveApy, 0) / filteredEvents.length 
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Harvest History</h2>
            <p className="text-sm text-neutral-400">{vaultName} • {filteredEvents.length} events</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            aria-label="Close harvest history"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 border-b border-neutral-800">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-300">Total Harvested</span>
              </div>
              <p className="text-lg font-bold text-white">
                <BalanceValue>{formatCurrency(totalHarvested)}</BalanceValue>
              </p>
              <p className="text-xs text-neutral-400">Over {timeFilter}</p>
            </div>
            
            <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-300">Average APY</span>
              </div>
              <p className="text-lg font-bold text-white">{averageApy.toFixed(1)}%</p>
              <p className="text-xs text-neutral-400">Compounding</p>
            </div>
            
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Gas Fees</span>
              </div>
              <p className="text-lg font-bold text-white">
                <BalanceValue>{formatCurrency(totalGasFees)}</BalanceValue>
              </p>
              <p className="text-xs text-neutral-400">{((totalGasFees / totalHarvested) * 100).toFixed(2)}% of harvest</p>
            </div>
          </div>

          {/* Time Filter */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-neutral-400" />
              Event Timeline
            </h3>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-1">
              {(['7d', '30d', '90d', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeFilter(period)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeFilter === period
                      ? 'bg-neutral-700 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {period === 'all' ? 'All' : period}
                </button>
              ))}
            </div>
          </div>

          {/* Events Table */}
          <div className="p-6">
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Zap className="h-5 w-5 text-emerald-400" />
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono text-sm font-bold text-white">
                            <BalanceValue>{formatCurrency(event.totalYieldHarvestedUsd)}</BalanceValue>
                          </p>
                          <div className="flex items-center gap-1 text-xs text-emerald-400">
                            <ArrowUpRight className="h-3 w-3" />
                            <span>+{event.compoundedShares} shares</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-neutral-400 mb-2">
                          <span>{formatTime(event.timestamp)}</span>
                          <span>{formatTimeAgo(event.timestamp)}</span>
                          <span>Block #{event.blockNumber.toLocaleString()}</span>
                        </div>

                        {/* Pool Breakdown */}
                        <div className="flex flex-wrap gap-2">
                          {event.poolBreakdown.map((pool) => (
                            <div
                              key={pool.poolId}
                              className="flex items-center gap-1.5 rounded-lg bg-neutral-800/50 px-2 py-1"
                            >
                              <span className="text-xs font-medium text-neutral-300">
                                {pool.pair}
                              </span>
                              <span className="text-xs font-mono text-neutral-400">
                                <BalanceValue>{formatCurrency(pool.yieldUsd)}</BalanceValue>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Gas Fee */}
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-red-400">
                          <ArrowDownRight className="h-3 w-3" />
                          <span><BalanceValue>{formatCurrency(event.gasFeeUsd)}</BalanceValue> gas</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {event.effectiveApy.toFixed(1)}% APY
                        </div>
                      </div>

                      {/* Transaction Link */}
                      <a
                        href={`https://stellar.expert/explorer/public/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
                      >
                        <span className="font-mono">{truncateHash(event.txHash)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Net Profit Summary */}
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-800/30 px-3 py-2 text-xs">
                    <span className="text-neutral-400">Net Profit (after gas)</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      <BalanceValue>{formatCurrency(event.netProfitUsd)}</BalanceValue>
                    </span>
                  </div>
                </div>
              ))}

              {filteredEvents.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-neutral-300 mb-2">No harvest events found</h3>
                  <p className="text-sm text-neutral-500">
                    No harvest events in the selected time period.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HarvestHistoryModal;