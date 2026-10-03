"use client";

/**
 * SessionTimeoutManager.tsx
 *
 * Enhanced auto-lock security timer that protects wallet sessions on shared
 * terminals by disconnecting inactive users after configurable timeout periods.
 *
 * Features
 * ────────
 * 1. Activity detection via mouse & keyboard events (throttled for performance)
 * 2. Configurable timeout durations: 15m, 30m, 1h, Never
 * 3. 60-second warning countdown modal with "Extend Session" option
 * 4. Automatic JWT token purging and session memory cleanup on disconnect
 * 5. Persistent user preferences saved to localStorage
 * 6. Visual feedback with countdown timer and progress bar
 *
 * Security Flow
 * ─────────────
 * 1. User activity resets inactivity timer
 * 2. After [timeout - 60s], warning modal appears with countdown
 * 3. User can extend session or let it expire
 * 4. On expiry: purge JWT tokens, clear sensitive memory, disconnect wallet
 * 5. Update UI to reflect disconnected state
 *
 * Integration
 * ───────────
 * Wrap this around authenticated sections of the app (typically in layout.tsx).
 * Works alongside WalletSessionProvider for comprehensive session management.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Clock, Shield, X } from "lucide-react";
import { useWalletSession } from "@/context/WalletContext";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Types
// ─────────────────────────────────────────────────────────────────────────────

/** Configurable auto-lock timeout options in minutes */
export type AutoLockDuration = 15 | 30 | 60 | "never";

/** Warning display duration before disconnect (60 seconds) */
const WARNING_DURATION_MS = 60 * 1000;

/** Throttle interval for activity event handlers (500ms) */
const ACTIVITY_THROTTLE_MS = 500;

/** localStorage key for persisting user's timeout preference */
const STORAGE_KEY = "stellarflow.autoLockDuration";

/** localStorage key for JWT tokens (hypothetical - adjust to actual implementation) */
const JWT_STORAGE_KEY = "stellarflow.jwt";

/** sessionStorage key for sensitive session data */
const SESSION_DATA_KEY = "stellarflow.sessionData";

interface SessionTimeoutContextType {
  /** Current auto-lock duration setting */
  autoLockDuration: AutoLockDuration;
  /** Update the auto-lock duration preference */
  setAutoLockDuration: (duration: AutoLockDuration) => void;
  /** Manually reset the inactivity timer */
  resetTimer: () => void;
  /** True when warning modal is visible */
  isWarningActive: boolean;
  /** Seconds remaining in warning countdown */
  warningSecondsRemaining: number | null;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | null>(
  null
);

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert AutoLockDuration to milliseconds
 */
function durationToMs(duration: AutoLockDuration): number | null {
  if (duration === "never") return null;
  return duration * 60 * 1000;
}

/**
 * Load user's saved auto-lock preference from localStorage
 */
function loadAutoLockPreference(): AutoLockDuration {
  if (typeof window === "undefined") return 30; // SSR default

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return 30; // Default to 30 minutes

    const parsed = JSON.parse(saved);
    if (
      parsed === 15 ||
      parsed === 30 ||
      parsed === 60 ||
      parsed === "never"
    ) {
      return parsed;
    }
  } catch {
    // Invalid JSON or storage error - fall back to default
  }

  return 30;
}

/**
 * Save user's auto-lock preference to localStorage
 */
function saveAutoLockPreference(duration: AutoLockDuration): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(duration));
  } catch {
    // Storage quota exceeded or private browsing - fail silently
  }
}

/**
 * Purge JWT tokens and sensitive session data from all storage locations
 */
function purgeAuthTokens(): void {
  if (typeof window === "undefined") return;

  try {
    // Clear JWT from localStorage
    window.localStorage.removeItem(JWT_STORAGE_KEY);

    // Clear sensitive session data from sessionStorage
    window.sessionStorage.removeItem(SESSION_DATA_KEY);

    // Clear any auth-related cookies (adjust cookie names to match your app)
    document.cookie.split(";").forEach((cookie) => {
      const [name] = cookie.split("=");
      const trimmedName = name.trim();
      if (
        trimmedName.includes("auth") ||
        trimmedName.includes("token") ||
        trimmedName.includes("session")
      ) {
        document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });

    // Clear any in-memory auth state (adjust based on your state management)
    // If using a global auth store, call its clear method here
  } catch (error) {
    console.error("Failed to purge auth tokens:", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning Modal Component
// ─────────────────────────────────────────────────────────────────────────────

interface WarningModalProps {
  secondsRemaining: number;
  onExtend: () => void;
  onDismiss: () => void;
}

function WarningModal({
  secondsRemaining,
  onExtend,
  onDismiss,
}: WarningModalProps) {
  const progress = (secondsRemaining / (WARNING_DURATION_MS / 1000)) * 100;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="timeout-warning-title"
      aria-describedby="timeout-warning-description"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md mx-4 bg-gradient-to-br from-gray-900 to-gray-950 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-gray-800 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2
                  id="timeout-warning-title"
                  className="text-lg font-semibold text-white"
                >
                  Session Expiring Soon
                </h2>
                <p
                  id="timeout-warning-description"
                  className="mt-1 text-sm text-gray-400"
                >
                  Your wallet session will disconnect due to inactivity.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Countdown display */}
          <div className="flex items-center justify-center py-6">
            <div className="relative">
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-bold text-white tabular-nums">
                  {secondsRemaining}
                </span>
                <span className="text-xl text-gray-400 mb-2">sec</span>
              </div>
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-2xl -z-10 animate-pulse" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onExtend}
              className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-900/50 hover:shadow-blue-900/70 hover:scale-[1.02] active:scale-[0.98]"
            >
              Extend Session
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full px-5 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dismiss (session will still disconnect)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Component
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionTimeoutManagerProps {
  children: React.ReactNode;
}

export function SessionTimeoutManager({
  children,
}: SessionTimeoutManagerProps) {
  // Auto-lock duration preference
  const [autoLockDuration, setAutoLockDurationState] =
    useState<AutoLockDuration>(() => loadAutoLockPreference());

  // Warning modal state
  const [isWarningActive, setIsWarningActive] = useState(false);
  const [warningSecondsRemaining, setWarningSecondsRemaining] = useState<
    number | null
  >(null);

  // Timer refs
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const activityThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Integration with existing wallet session
  const { resetIdleTimer: resetWalletIdleTimer } = useWalletSession();

  // ── Clear all timers ──────────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // ── Handle session disconnect ─────────────────────────────────────────────
  const handleDisconnect = useCallback(() => {
    clearAllTimers();
    setIsWarningActive(false);
    setWarningSecondsRemaining(null);

    // Purge JWT tokens and sensitive session data
    purgeAuthTokens();

    // Trigger wallet context disconnect (leverages existing purge logic)
    resetWalletIdleTimer();

    console.info("[SessionTimeoutManager] Session disconnected due to inactivity");
  }, [clearAllTimers, resetWalletIdleTimer]);

  // ── Start warning countdown ───────────────────────────────────────────────
  const startWarningCountdown = useCallback(() => {
    setIsWarningActive(true);
    setWarningSecondsRemaining(WARNING_DURATION_MS / 1000);

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      setWarningSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Schedule disconnect after warning duration
    disconnectTimerRef.current = setTimeout(() => {
      handleDisconnect();
    }, WARNING_DURATION_MS);
  }, [handleDisconnect]);

  // ── Reset timer (extend session) ──────────────────────────────────────────
  const resetTimer = useCallback(() => {
    clearAllTimers();
    setIsWarningActive(false);
    setWarningSecondsRemaining(null);

    // Reset wallet context timer
    resetWalletIdleTimer();

    const timeoutMs = durationToMs(autoLockDuration);
    if (timeoutMs === null) return; // "never" option selected

    // Schedule warning to appear [timeout - 60s] from now
    const warningDelayMs = Math.max(0, timeoutMs - WARNING_DURATION_MS);
    warningTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, warningDelayMs);
  }, [
    clearAllTimers,
    autoLockDuration,
    resetWalletIdleTimer,
    startWarningCountdown,
  ]);

  // ── Handle extend session button ──────────────────────────────────────────
  const handleExtendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // ── Handle dismiss warning (timer continues) ──────────────────────────────
  const handleDismissWarning = useCallback(() => {
    setIsWarningActive(false);
    // Don't clear disconnect timer - session will still disconnect
  }, []);

  // ── Activity detection ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize timer on mount
    resetTimer();

    const handleActivity = () => {
      // Throttle activity events to avoid performance issues
      if (activityThrottleRef.current !== null) return;
      activityThrottleRef.current = setTimeout(() => {
        activityThrottleRef.current = null;
      }, ACTIVITY_THROTTLE_MS);

      // Don't reset if warning is already active (user must explicitly extend)
      if (isWarningActive) return;

      resetTimer();
    };

    // Listen for user activity
    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
      if (activityThrottleRef.current) {
        clearTimeout(activityThrottleRef.current);
      }
    };
  }, [resetTimer, clearAllTimers, isWarningActive]);

  // ── Update preference ─────────────────────────────────────────────────────
  const setAutoLockDuration = useCallback(
    (duration: AutoLockDuration) => {
      setAutoLockDurationState(duration);
      saveAutoLockPreference(duration);
      // Restart timer with new duration
      resetTimer();
    },
    [resetTimer]
  );

  // ── Context value ─────────────────────────────────────────────────────────
  const contextValue = useMemo<SessionTimeoutContextType>(
    () => ({
      autoLockDuration,
      setAutoLockDuration,
      resetTimer,
      isWarningActive,
      warningSecondsRemaining,
    }),
    [
      autoLockDuration,
      setAutoLockDuration,
      resetTimer,
      isWarningActive,
      warningSecondsRemaining,
    ]
  );

  return (
    <SessionTimeoutContext.Provider value={contextValue}>
      {children}
      {isWarningActive && warningSecondsRemaining !== null && (
        <WarningModal
          secondsRemaining={warningSecondsRemaining}
          onExtend={handleExtendSession}
          onDismiss={handleDismissWarning}
        />
      )}
    </SessionTimeoutContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useSessionTimeout
 *
 * Access session timeout state and controls.
 *
 * @example
 * ```tsx
 * const { autoLockDuration, setAutoLockDuration, resetTimer } = useSessionTimeout();
 *
 * // Update preference
 * setAutoLockDuration(30);
 *
 * // Manually reset timer after sensitive action
 * const handleTransaction = async () => {
 *   await signTransaction();
 *   resetTimer();
 * };
 * ```
 */
export function useSessionTimeout(): SessionTimeoutContextType {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error(
      "useSessionTimeout must be used within SessionTimeoutManager"
    );
  }
  return context;
}
