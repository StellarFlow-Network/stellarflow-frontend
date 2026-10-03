'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { TrendingUp, Zap, Vote, Lock, Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VotingPowerCalculatorProps {
  /** Total veFLOW supply in the system (for calculating voting power %) */
  totalVeSupply?: number;
  /** User's current FLOW balance (optional, for validation) */
  userBalance?: number;
  /** Callback when user wants to proceed with locking */
  onLockTokens?: (amount: number, durationWeeks: number) => void;
}

// ---------------------------------------------------------------------------
// Constants & Utilities
// ---------------------------------------------------------------------------

const MIN_LOCK_WEEKS = 1;
const MAX_LOCK_WEEKS = 208; // 4 years
const MAX_MULTIPLIER = 4;
const WEEKS_PER_YEAR = 52;

/**
 * Calculate the veFLOW multiplier based on lock duration
 * Linear scaling: 1x at 1 week → 4x at 4 years (208 weeks)
 */
function calculateMultiplier(weeks: number): number {
  const clamped = Math.min(Math.max(weeks, MIN_LOCK_WEEKS), MAX_LOCK_WEEKS);
  return 1 + (clamped / MAX_LOCK_WEEKS) * (MAX_MULTIPLIER - 1);
}

/**
 * Calculate yield boost multiplier for vault rewards
 * Same as voting power multiplier
 */
function calculateYieldBoost(weeks: number): number {
  return calculateMultiplier(weeks);
}

/**
 * Format duration in human-readable form
 */
function formatDuration(weeks: number): string {
  if (weeks >= WEEKS_PER_YEAR) {
    const years = weeks / WEEKS_PER_YEAR;
    return years % 1 === 0 
      ? `${years.toFixed(0)} year${years !== 1 ? 's' : ''}` 
      : `${years.toFixed(2)} years`;
  }
  if (weeks >= 4) {
    const months = (weeks / 4.345).toFixed(1);
    return `${months} month${parseFloat(months) !== 1 ? 's' : ''}`;
  }
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

/**
 * Get color based on voting power percentage
 */
function getPowerColor(percentage: number): string {
  if (percentage >= 5) return 'text-purple-400';
  if (percentage >= 1) return 'text-blue-400';
  if (percentage >= 0.1) return 'text-cyan-400';
  return 'text-gray-400';
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

/**
 * Circular gauge visualization for voting power
 */
function VotingPowerGauge({ 
  percentage, 
  size = 160 
}: { 
  percentage: number; 
  size?: number;
}) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(percentage / 100, 1));

  const gradientId = `voting-power-gradient-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        aria-label={`Voting power: ${percentage.toFixed(2)}%`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-gray-800"
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
            filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))',
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Vote size={24} className="text-blue-400 mb-1" />
        <span className="text-3xl font-bold font-mono text-white tabular-nums">
          {percentage < 0.01 ? '<0.01' : percentage.toFixed(2)}
        </span>
        <span className="text-xs font-semibold text-gray-400 mt-1">
          VOTING POWER %
        </span>
      </div>
    </div>
  );
}

/**
 * Slider input with labels
 */
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  helperText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  helperText?: string;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="text-base font-bold text-blue-400 font-mono tabular-nums">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-3 bg-gray-800 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #1f2937 ${percentage}%, #1f2937 100%)`
          }}
        />
      </div>
      
      {helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

/**
 * Metrics card showing calculated values
 */
function MetricsCard({
  icon: Icon,
  label,
  value,
  subtext,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={16} className={colorClass || 'text-blue-400'} />
        <p className="text-xs uppercase font-semibold tracking-wider text-gray-400">
          {label}
        </p>
      </div>
      <p className={`text-2xl font-bold font-mono tabular-nums ${colorClass || 'text-gray-100'}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-500">{subtext}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * VotingPowerCalculator
 * 
 * Interactive calculator that lets users preview their governance voting power
 * and yield multiplier boost based on locked FLOW token amounts and lock durations.
 * 
 * Features:
 * - Slider for FLOW token amount (0-100k)
 * - Slider for lock duration (1 week to 4 years)
 * - Real-time circular gauge showing voting power percentage
 * - Display of veFLOW balance, multiplier, and yield boost
 * - Optional integration with lock tokens action
 */
export function VotingPowerCalculator({
  totalVeSupply = 10_000_000,
  userBalance,
  onLockTokens,
}: VotingPowerCalculatorProps) {
  // State
  const [flowAmount, setFlowAmount] = useState<number>(5000);
  const [lockWeeks, setLockWeeks] = useState<number>(52); // Default: 1 year

  // Calculated values
  const multiplier = useMemo(() => calculateMultiplier(lockWeeks), [lockWeeks]);
  const veFlowBalance = useMemo(() => flowAmount * multiplier, [flowAmount, multiplier]);
  const votingPowerPercent = useMemo(
    () => (totalVeSupply > 0 ? (veFlowBalance / totalVeSupply) * 100 : 0),
    [veFlowBalance, totalVeSupply]
  );
  const yieldBoost = useMemo(() => calculateYieldBoost(lockWeeks), [lockWeeks]);

  const handleLock = useCallback(() => {
    if (flowAmount > 0 && lockWeeks >= MIN_LOCK_WEEKS) {
      onLockTokens?.(flowAmount, lockWeeks);
    }
  }, [flowAmount, lockWeeks, onLockTokens]);

  const exceedsBalance = userBalance !== undefined && flowAmount > userBalance;

  return (
    <div className="max-w-4xl mx-auto rounded-xl border border-gray-800 bg-[#0d1117] p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <TrendingUp className="text-blue-400" size={28} />
          Voting Power Calculator
        </h2>
        <p className="text-sm text-gray-400 mt-2">
          Preview your governance voting power and yield multiplier based on locked FLOW tokens and lock duration.
        </p>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4 flex gap-3">
        <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-300 space-y-1">
          <p>
            <strong className="text-blue-400">veFLOW voting power</strong> increases linearly from <strong>1x</strong> at 1 week to <strong>4x</strong> at 4 years.
          </p>
          <p className="text-xs text-gray-500">
            Your voting power percentage is calculated relative to the total veFLOW supply ({totalVeSupply.toLocaleString()}).
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column: Sliders */}
        <div className="space-y-6">
          <Slider
            label="FLOW Token Amount"
            value={flowAmount}
            min={0}
            max={100000}
            step={100}
            onChange={setFlowAmount}
            formatValue={(v) => `${v.toLocaleString()} FLOW`}
            helperText={
              userBalance !== undefined
                ? `Available: ${userBalance.toLocaleString()} FLOW`
                : 'Drag to adjust token amount'
            }
          />

          {exceedsBalance && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/10 p-3 text-sm text-red-400">
              Amount exceeds your available balance
            </div>
          )}

          <Slider
            label="Lock Duration"
            value={lockWeeks}
            min={MIN_LOCK_WEEKS}
            max={MAX_LOCK_WEEKS}
            step={1}
            onChange={setLockWeeks}
            formatValue={formatDuration}
            helperText="Longer locks = higher voting power & yield boost"
          />

          {/* Quick duration presets */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setLockWeeks(4)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              1 Month
            </button>
            <button
              onClick={() => setLockWeeks(26)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              6 Months
            </button>
            <button
              onClick={() => setLockWeeks(52)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              1 Year
            </button>
            <button
              onClick={() => setLockWeeks(104)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              2 Years
            </button>
            <button
              onClick={() => setLockWeeks(208)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Max (4 Years)
            </button>
          </div>
        </div>

        {/* Right Column: Gauge */}
        <div className="flex items-center justify-center">
          <VotingPowerGauge percentage={votingPowerPercent} size={200} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricsCard
          icon={Lock}
          label="veFLOW Balance"
          value={veFlowBalance.toLocaleString(undefined, { 
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
          })}
          subtext={`${flowAmount.toLocaleString()} FLOW × ${multiplier.toFixed(2)}x`}
          colorClass="text-purple-400"
        />
        
        <MetricsCard
          icon={TrendingUp}
          label="Power Multiplier"
          value={`${multiplier.toFixed(2)}x`}
          subtext={`Based on ${formatDuration(lockWeeks)} lock`}
          colorClass="text-blue-400"
        />
        
        <MetricsCard
          icon={Zap}
          label="Yield Boost"
          value={`${yieldBoost.toFixed(2)}x`}
          subtext="Applied to vault rewards"
          colorClass="text-cyan-400"
        />
      </div>

      {/* Action Button */}
      {onLockTokens && (
        <button
          type="button"
          onClick={handleLock}
          disabled={flowAmount === 0 || exceedsBalance}
          className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-sm font-bold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-blue-600 disabled:hover:to-purple-600"
        >
          Lock {flowAmount.toLocaleString()} FLOW for {formatDuration(lockWeeks)}
        </button>
      )}

      {/* Footer info */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>
          veFLOW is non-transferable and will unlock after the chosen duration.
        </p>
        <p>
          Voting power and yield boost decay linearly as your lock approaches expiry.
        </p>
      </div>
    </div>
  );
}

export default VotingPowerCalculator;
