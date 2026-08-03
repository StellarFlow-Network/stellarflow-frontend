'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Lock, Delete, ShieldCheck, Clock, AlertCircle, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PinLength = 4 | 6;
export type IdleTimeoutMinutes = 1 | 5 | 15;

interface ScreenLockContextType {
  /** True once the idle timer (or a manual lock) has activated the overlay. */
  isLocked: boolean;
  /** True once the user has configured a session PIN. */
  isPinSet: boolean;
  pinLength: PinLength;
  idleTimeoutMinutes: IdleTimeoutMinutes;
  setIdleTimeoutMinutes: (minutes: IdleTimeoutMinutes) => void;
  /** Immediately activates the lock overlay, regardless of the idle timer. */
  lockNow: () => void;
  /** Returns true and unlocks the session if `pin` matches the stored PIN. */
  unlock: (pin: string) => boolean;
  /** Stores a new in-memory session PIN and arms the idle timer. */
  setPin: (pin: string, length: PinLength) => void;
  /** Removes the session PIN and disables the screen lock entirely. */
  clearPin: () => void;
}

const ScreenLockContext = createContext<ScreenLockContextType | null>(null);

export const IDLE_TIMEOUT_OPTIONS: IdleTimeoutMinutes[] = [1, 5, 15];

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart'] as const;

// ---------------------------------------------------------------------------
// Provider — owns the in-memory PIN, idle timer, and dashboard blur
// ---------------------------------------------------------------------------

export interface ScreenLockProviderProps {
  children: React.ReactNode;
  defaultIdleTimeoutMinutes?: IdleTimeoutMinutes;
}

/**
 * Wraps the application (or a protected subtree) with an opt-in idle screen
 * lock. The PIN is kept only in a React ref for the lifetime of the tab —
 * it is never written to localStorage, sessionStorage, or any network call.
 */
export function ScreenLockProvider({
  children,
  defaultIdleTimeoutMinutes = 5,
}: ScreenLockProviderProps) {
  // In-memory only — intentionally not state, so it never round-trips
  // through serialization or persistence layers.
  const pinRef = useRef<string | null>(null);
  const [isPinSet, setIsPinSet] = useState(false);
  const [pinLength, setPinLength] = useState<PinLength>(4);
  const [isLocked, setIsLocked] = useState(false);
  const [idleTimeoutMinutes, setIdleTimeoutMinutesState] = useState<IdleTimeoutMinutes>(
    defaultIdleTimeoutMinutes,
  );

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (!pinRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, idleTimeoutMinutes * 60 * 1000);
  }, [clearIdleTimer, idleTimeoutMinutes]);

  const lockNow = useCallback(() => {
    if (!pinRef.current) return;
    clearIdleTimer();
    setIsLocked(true);
  }, [clearIdleTimer]);

  const setPin = useCallback(
    (pin: string, length: PinLength) => {
      pinRef.current = pin;
      setPinLength(length);
      setIsPinSet(true);
      setIsLocked(false);
      startIdleTimer();
    },
    [startIdleTimer],
  );

  const clearPin = useCallback(() => {
    pinRef.current = null;
    setIsPinSet(false);
    setIsLocked(false);
    clearIdleTimer();
  }, [clearIdleTimer]);

  const unlock = useCallback((pin: string) => {
    if (pinRef.current !== null && pin === pinRef.current) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const setIdleTimeoutMinutes = useCallback((minutes: IdleTimeoutMinutes) => {
    setIdleTimeoutMinutesState(minutes);
  }, []);

  // Re-arm the idle timer whenever it is unlocked, the timeout changes, or
  // qualifying user activity occurs. No timer runs while locked or before a
  // PIN has been configured.
  useEffect(() => {
    if (isLocked || !isPinSet) {
      clearIdleTimer();
      return;
    }

    startIdleTimer();

    const handleActivity = () => startIdleTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearIdleTimer();
    };
  }, [isLocked, isPinSet, startIdleTimer, clearIdleTimer]);

  const contextValue = useMemo<ScreenLockContextType>(
    () => ({
      isLocked,
      isPinSet,
      pinLength,
      idleTimeoutMinutes,
      setIdleTimeoutMinutes,
      lockNow,
      unlock,
      setPin,
      clearPin,
    }),
    [isLocked, isPinSet, pinLength, idleTimeoutMinutes, setIdleTimeoutMinutes, lockNow, unlock, setPin, clearPin],
  );

  return (
    <ScreenLockContext.Provider value={contextValue}>
      <div
        aria-hidden={isLocked}
        className={
          isLocked
            ? 'pointer-events-none select-none blur-md brightness-75 transition-all duration-300'
            : 'transition-all duration-300'
        }
      >
        {children}
      </div>
      {isLocked && <ScreenLockModal />}
    </ScreenLockContext.Provider>
  );
}

export function useScreenLock(): ScreenLockContextType {
  const ctx = useContext(ScreenLockContext);
  if (!ctx) {
    throw new Error('useScreenLock must be used within a ScreenLockProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// PIN pad
// ---------------------------------------------------------------------------

function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex justify-center gap-3" role="status" aria-label={`${filled} of ${length} digits entered`}>
      {Array.from({ length }).map((_, idx) => (
        <span
          key={idx}
          className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
            idx < filled ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
          }`}
        />
      ))}
    </div>
  );
}

function Keypad({
  onDigit,
  onBackspace,
  disabled,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
      {keys.map((key, idx) => {
        if (key === '') return <div key={idx} />;
        if (key === 'backspace') {
          return (
            <button
              key={idx}
              type="button"
              onClick={onBackspace}
              disabled={disabled}
              aria-label="Backspace"
              className="h-14 w-14 mx-auto flex items-center justify-center rounded-full text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              <Delete size={20} />
            </button>
          );
        }
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onDigit(key)}
            disabled={disabled}
            className="h-14 w-14 mx-auto flex items-center justify-center rounded-full text-xl font-semibold text-white bg-gray-800/80 hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal — unlock screen (automatic) + setup/management screen (manual open)
// ---------------------------------------------------------------------------

export interface ScreenLockModalProps {
  /** Controls visibility when opened manually, e.g. from a Settings page to
   *  configure or change the PIN. Ignored while the provider has auto-locked
   *  the session — that overlay is always shown until unlocked. */
  isOpen?: boolean;
  onClose?: () => void;
}

type ManageStep = 'manage' | 'choose-length' | 'create-pin' | 'confirm-pin';

export function ScreenLockModal({ isOpen = false, onClose }: ScreenLockModalProps = {}) {
  const { isLocked, isPinSet, pinLength, idleTimeoutMinutes, setIdleTimeoutMinutes, unlock, setPin, clearPin } =
    useScreenLock();

  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [manageStep, setManageStep] = useState<ManageStep>('manage');
  const [newLength, setNewLength] = useState<PinLength>(4);
  const [firstEntry, setFirstEntry] = useState('');

  const visible = isLocked || isOpen;

  useEffect(() => {
    if (!visible) {
      setEntry('');
      setError(null);
      setManageStep('manage');
      setFirstEntry('');
    }
  }, [visible]);

  const handleUnlockDigit = useCallback(
    (digit: string) => {
      setError(null);
      const next = (entry + digit).slice(0, pinLength);
      setEntry(next);

      if (next.length === pinLength) {
        const success = unlock(next);
        if (!success) {
          setError('Incorrect PIN. Try again.');
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setEntry('');
        }
      }
    },
    [entry, pinLength, unlock],
  );

  const handleSetupDigit = useCallback(
    (digit: string) => {
      setError(null);
      const next = (entry + digit).slice(0, newLength);
      setEntry(next);

      if (next.length !== newLength) return;

      if (manageStep === 'create-pin') {
        setFirstEntry(next);
        setEntry('');
        setManageStep('confirm-pin');
        return;
      }

      if (manageStep === 'confirm-pin') {
        if (next === firstEntry) {
          setPin(next, newLength);
          setEntry('');
          setManageStep('manage');
        } else {
          setError('PINs did not match. Start over.');
          setEntry('');
          setFirstEntry('');
          setManageStep('create-pin');
        }
      }
    },
    [entry, newLength, manageStep, firstEntry, setPin],
  );

  if (!visible) return null;

  const isSetupFlow = !isLocked && (manageStep === 'create-pin' || manageStep === 'confirm-pin');
  const isChooseLength = !isLocked && manageStep === 'choose-length';
  const isManageHome = !isLocked && manageStep === 'manage';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isLocked ? 'Session locked' : 'Screen lock settings'}
    >
      <div className={`w-full max-w-sm bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-6 ${shake ? 'animate-[shake_0.4s]' : ''}`}>
        <style>{`@keyframes shake { 0%,100% { transform: translateX(0);} 20%,60% { transform: translateX(-8px);} 40%,80% { transform: translateX(8px);} }`}</style>

        {/* ── Locked: PIN entry ─────────────────────────────────────────── */}
        {isLocked && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Lock size={26} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Session Locked</h2>
              <p className="text-sm text-gray-400 mt-1">Enter your PIN to continue.</p>
            </div>
            <PinDots length={pinLength} filled={entry.length} />
            {error && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-red-400">
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <Keypad onDigit={handleUnlockDigit} onBackspace={() => setEntry((e) => e.slice(0, -1))} />
          </div>
        )}

        {/* ── Manage home: timeout + change/disable PIN ────────────────── */}
        {isManageHome && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Screen Lock</h2>
            </div>

            {isPinSet ? (
              <>
                <div>
                  <p className="text-xs uppercase font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                    <Clock size={13} /> Auto-lock after
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {IDLE_TIMEOUT_OPTIONS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => setIdleTimeoutMinutes(minutes)}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                          idleTimeoutMinutes === minutes
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setManageStep('choose-length')}
                    className="w-full px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
                  >
                    Change PIN
                  </button>
                  <button
                    type="button"
                    onClick={clearPin}
                    className="w-full px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 size={14} /> Disable Screen Lock
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Protect this session with a PIN. StellarFlow blurs the dashboard and locks the
                  interface after a period of inactivity.
                </p>
                <button
                  type="button"
                  onClick={() => setManageStep('choose-length')}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Set Up Screen Lock
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* ── Choose PIN length ─────────────────────────────────────────── */}
        {isChooseLength && (
          <div className="text-center space-y-6">
            <h2 className="text-lg font-semibold text-white">Choose PIN Length</h2>
            <div className="flex justify-center gap-3">
              {([4, 6] as PinLength[]).map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => {
                    setNewLength(length);
                    setEntry('');
                    setFirstEntry('');
                    setManageStep('create-pin');
                  }}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:border-blue-500 text-white font-medium transition-colors"
                >
                  {length}-digit PIN
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setManageStep('manage')}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* ── Create / confirm PIN ──────────────────────────────────────── */}
        {isSetupFlow && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {manageStep === 'create-pin' ? 'Create your PIN' : 'Confirm your PIN'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {manageStep === 'create-pin'
                  ? `Choose a ${newLength}-digit PIN for this session.`
                  : 'Enter the same PIN again to confirm.'}
              </p>
            </div>
            <PinDots length={newLength} filled={entry.length} />
            {error && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-red-400">
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <Keypad onDigit={handleSetupDigit} onBackspace={() => setEntry((e) => e.slice(0, -1))} />
            <button
              type="button"
              onClick={() => {
                setEntry('');
                setFirstEntry('');
                setManageStep('choose-length');
              }}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScreenLockModal;
