'use client';

import React, { useEffect, useState } from 'react';
import { Lock, Unlock, TrendingUp, Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VeLockPosition {
  /** FLOW tokens currently locked */
  lockedAmount: number;
  /** Original lock duration, in weeks */
  lockDurationWeeks: number;
  /** Unix timestamp (ms) when the lock unlocks */
  unlockTimestamp: number;
}

export interface VeLockFormProps {
  /** FLOW balance available to lock. */
  availableBalance?: number;
  /** The caller's existing lock position, if any. Pass `null` for a first-time locker. */
  existingLock?: VeLockPosition | null;
  /** Total veFLOW supply, used to preview voting power share. */
  totalVeSupply?: number;
  onCreateLock?: (amount: number, durationWeeks: number) => void;
  onExtendLock?: (newDurationWeeks: number) => void;
}

// ---------------------------------------------------------------------------
// veFLOW model
// ---------------------------------------------------------------------------

const MIN_LOCK_WEEKS = 1;
const MAX_LOCK_WEEKS = 208; // 4 years
const MAX_MULTIPLIER = 4;

/** Linear multiplier from 1x at the minimum lock to 4x at the 4-year maximum. */
function multiplierForWeeks(weeks: number): number {
  const clamped = Math.min(Math.max(weeks, MIN_LOCK_WEEKS), MAX_LOCK_WEEKS);
  return 1 + (clamped / MAX_LOCK_WEEKS) * (MAX_MULTIPLIER - 1);
}

function formatDuration(weeks: number): string {
  if (weeks >= 52) {
    const years = weeks / 52;
    return `${years % 1 === 0 ? years.toFixed(0) : years.toFixed(1)} year${years >= 2 ? 's' : ''}`;
  }
  if (weeks >= 4) {
    const months = weeks / 4.345;
    return `${months.toFixed(1)} months`;
  }
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// ---------------------------------------------------------------------------
// Demo data — used when no existingLock prop is supplied
// ---------------------------------------------------------------------------

const DEMO_EXISTING_LOCK: VeLockPosition = {
  lockedAmount: 4200,
  lockDurationWeeks: 104,
  unlockTimestamp: Date.now() + 1000 * 60 * 60 * 24 * 210,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MultiplierPreview({
  amount,
  durationWeeks,
  totalVeSupply,
}: {
  amount: number;
  durationWeeks: number;
  totalVeSupply: number;
}) {
  const multiplier = multiplierForWeeks(durationWeeks);
  const veFlowBalance = amount * multiplier;
  const votingPowerPercent = totalVeSupply > 0 ? (veFlowBalance / totalVeSupply) * 100 : 0;

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-blue-400 shrink-0" />
        <p className="text-xs uppercase font-bold tracking-wider text-blue-400">
          Lock Preview
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase text-gray-500">Multiplier</p>
          <p className="text-lg font-mono font-bold text-gray-100 mt-1">
            {multiplier.toFixed(2)}x
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500">veFLOW Balance</p>
          <p className="text-lg font-mono font-bold text-blue-300 mt-1">
            {veFlowBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500">Voting Power</p>
          <p className="text-lg font-mono font-bold text-gray-100 mt-1">
            {votingPowerPercent < 0.01 ? '< 0.01%' : `${votingPowerPercent.toFixed(2)}%`}
          </p>
        </div>
      </div>
    </div>
  );
}

function DurationSlider({
  weeks,
  onChange,
  disabled,
}: {
  weeks: number;
  onChange: (weeks: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-gray-300">Lock Duration</label>
        <span className="text-sm font-bold text-blue-400">{formatDuration(weeks)}</span>
      </div>
      <input
        type="range"
        min={MIN_LOCK_WEEKS}
        max={MAX_LOCK_WEEKS}
        value={weeks}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>1 week</span>
        <span>1 year</span>
        <span>4 years</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VeLockForm
// ---------------------------------------------------------------------------

/**
 * VeLockForm
 *
 * Lock FLOW tokens for a chosen duration (1 week – 4 years) to receive
 * veFLOW voting power and a yield multiplier. Shows a live preview of the
 * resulting veFLOW balance/voting power as the duration slider moves, and,
 * for callers with an existing lock, an unlock countdown plus an
 * "Extend Lock" flow to push the unlock date further out for a higher
 * multiplier.
 */
export function VeLockForm({
  availableBalance = 12_500,
  existingLock = DEMO_EXISTING_LOCK,
  totalVeSupply = 8_400_000,
  onCreateLock,
  onExtendLock,
}: VeLockFormProps) {
  // ── New lock form state ──────────────────────────────────────────────
  const [lockAmount, setLockAmount] = useState<number>(
    Math.min(1000, availableBalance),
  );
  const [lockWeeks, setLockWeeks] = useState<number>(52);

  // ── Extend lock state ────────────────────────────────────────────────
  const [isExtending, setIsExtending] = useState(false);
  const [extendWeeks, setExtendWeeks] = useState<number>(
    existingLock?.lockDurationWeeks ?? 52,
  );

  // ── Live unlock countdown ────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!existingLock) return;
    const update = () => setTimeLeft(existingLock.unlockTimestamp - Date.now());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [existingLock]);

  const isUnlocked = existingLock !== null && existingLock !== undefined && timeLeft <= 0;

  const canSubmitNewLock = lockAmount > 0 && lockAmount <= availableBalance;

  const handleCreateLock = () => {
    if (!canSubmitNewLock) return;
    onCreateLock?.(lockAmount, lockWeeks);
  };

  const handleConfirmExtend = () => {
    onExtendLock?.(extendWeeks);
    setIsExtending(false);
  };

  return (
    <div className="max-w-2xl mx-auto rounded-xl border border-gray-800 bg-[#0d1117] p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-100">Lock FLOW for veFLOW</h2>
        <p className="text-sm text-gray-500 mt-1">
          Vote-escrow your FLOW tokens to earn voting power and a yield boost multiplier.
        </p>
      </div>

      {/* ── Existing lock status ─────────────────────────────────────── */}
      {existingLock && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isUnlocked ? (
                <Unlock size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <Lock size={16} className="text-amber-400 shrink-0" />
              )}
              <p className="text-xs uppercase font-bold tracking-wider text-gray-400">
                Your Current Lock
              </p>
            </div>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                isUnlocked
                  ? 'text-emerald-400 bg-emerald-950/30'
                  : 'text-amber-400 bg-amber-950/30'
              }`}
            >
              {isUnlocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase text-gray-500">Locked Amount</p>
              <p className="text-sm font-mono text-gray-200 mt-1">
                {existingLock.lockedAmount.toLocaleString()} FLOW
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500">Current Multiplier</p>
              <p className="text-sm font-mono text-gray-200 mt-1">
                {multiplierForWeeks(existingLock.lockDurationWeeks).toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1">
                <Clock size={10} /> {isUnlocked ? 'Unlocked' : 'Unlocks In'}
              </p>
              <p className="text-sm font-mono text-gray-200 mt-1">
                {isUnlocked ? '—' : formatCountdown(timeLeft)}
              </p>
            </div>
          </div>

          {!isExtending ? (
            <button
              type="button"
              onClick={() => setIsExtending(true)}
              className="w-full rounded-lg border border-gray-700 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
            >
              Extend Lock
            </button>
          ) : (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              <DurationSlider weeks={extendWeeks} onChange={setExtendWeeks} />
              <MultiplierPreview
                amount={existingLock.lockedAmount}
                durationWeeks={extendWeeks}
                totalVeSupply={totalVeSupply}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsExtending(false);
                    setExtendWeeks(existingLock.lockDurationWeeks);
                  }}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExtend}
                  disabled={extendWeeks <= existingLock.lockDurationWeeks}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── New lock form ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-xs uppercase font-bold text-gray-500">
          {existingLock ? 'Lock Additional FLOW' : 'Create a New Lock'}
        </p>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-300">Amount to Lock</label>
            <span className="text-xs text-gray-500">
              Balance: {availableBalance.toLocaleString()} FLOW
            </span>
          </div>
          <input
            type="number"
            min={0}
            max={availableBalance}
            value={lockAmount}
            onChange={(e) => setLockAmount(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-700 bg-[#161b22] px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {lockAmount > availableBalance && (
            <p className="text-xs text-red-400 mt-1">Amount exceeds available balance.</p>
          )}
        </div>

        <DurationSlider weeks={lockWeeks} onChange={setLockWeeks} />

        <MultiplierPreview
          amount={lockAmount}
          durationWeeks={lockWeeks}
          totalVeSupply={totalVeSupply}
        />

        <button
          type="button"
          onClick={handleCreateLock}
          disabled={!canSubmitNewLock}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Lock Tokens
        </button>
      </div>
    </div>
  );
}

export default VeLockForm;
