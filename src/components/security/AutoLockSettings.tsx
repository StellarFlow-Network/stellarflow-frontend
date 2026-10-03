"use client";

/**
 * AutoLockSettings.tsx
 *
 * User interface for configuring auto-lock security timeout preferences.
 * Displays current settings, allows users to change timeout duration,
 * and provides visual feedback about security status.
 *
 * Features
 * ────────
 * - Radio button group for timeout duration selection (15m, 30m, 1h, Never)
 * - Visual indicators showing current status and time until lock
 * - Accessibility-compliant with ARIA labels and keyboard navigation
 * - Responsive design for mobile and desktop
 * - Integration with SessionTimeoutManager context
 *
 * Usage
 * ─────
 * Import and place within settings page or security settings section:
 *
 * ```tsx
 * <AutoLockSettings />
 * ```
 *
 * Requires SessionTimeoutManager to be mounted higher in the component tree.
 */

import React from "react";
import { Clock, Shield, ShieldOff, Info } from "lucide-react";
import { useSessionTimeout, type AutoLockDuration } from "./SessionTimeoutManager";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

interface TimeoutOption {
  value: AutoLockDuration;
  label: string;
  description: string;
  recommended?: boolean;
}

const TIMEOUT_OPTIONS: TimeoutOption[] = [
  {
    value: 15,
    label: "15 minutes",
    description: "Maximum security - best for shared or public computers",
    recommended: false,
  },
  {
    value: 30,
    label: "30 minutes",
    description: "Balanced security and convenience",
    recommended: true,
  },
  {
    value: 60,
    label: "1 hour",
    description: "Extended sessions - suitable for private devices",
    recommended: false,
  },
  {
    value: "never",
    label: "Never",
    description: "No auto-lock (not recommended for security)",
    recommended: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AutoLockSettings() {
  const { autoLockDuration, setAutoLockDuration, isWarningActive, warningSecondsRemaining } =
    useSessionTimeout();

  const selectedOption = TIMEOUT_OPTIONS.find(
    (opt) => opt.value === autoLockDuration
  );

  const handleDurationChange = (duration: AutoLockDuration) => {
    setAutoLockDuration(duration);
  };

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Auto-Lock Security
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Automatically disconnect your wallet after a period of inactivity to
              protect your session on shared terminals.
            </p>
          </div>
        </div>
      </div>

      {/* Warning status banner (if active) */}
      {isWarningActive && warningSecondsRemaining !== null && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg"
        >
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-200">
              Session Expiring Soon
            </p>
            <p className="text-xs text-amber-300/80">
              Your session will disconnect in {warningSecondsRemaining} seconds due
              to inactivity.
            </p>
          </div>
        </div>
      )}

      {/* Current status */}
      <div className="flex items-center gap-2 p-3 bg-[#0d1117] border border-gray-800/50 rounded-lg">
        {autoLockDuration === "never" ? (
          <>
            <ShieldOff className="w-4 h-4 text-gray-500" />
            <p className="text-sm text-gray-400">
              Auto-lock is <span className="font-medium text-gray-300">disabled</span>
            </p>
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 text-green-500" />
            <p className="text-sm text-gray-400">
              Auto-lock is <span className="font-medium text-green-400">enabled</span>{" "}
              - session will lock after{" "}
              <span className="font-medium text-white">
                {selectedOption?.label}
              </span>{" "}
              of inactivity
            </p>
          </>
        )}
      </div>

      {/* Timeout duration selector */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Timeout Duration
        </label>
        <div
          role="radiogroup"
          aria-label="Auto-lock timeout duration"
          className="space-y-2"
        >
          {TIMEOUT_OPTIONS.map((option) => {
            const isSelected = option.value === autoLockDuration;
            return (
              <label
                key={option.value}
                className={`
                  relative flex items-start gap-3 p-4 rounded-lg border cursor-pointer
                  transition-all duration-200
                  ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-gray-800 hover:border-gray-700 hover:bg-[#0d1117]/50"
                  }
                `}
              >
                {/* Radio button */}
                <input
                  type="radio"
                  name="autoLockDuration"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => handleDurationChange(option.value)}
                  className="mt-0.5 w-4 h-4 text-blue-600 border-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 bg-[#0d1117]"
                  aria-describedby={`timeout-desc-${option.value}`}
                />

                {/* Option content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.recommended && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p
                    id={`timeout-desc-${option.value}`}
                    className="mt-1 text-xs text-gray-500"
                  >
                    {option.description}
                  </p>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Info panel */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-xs text-blue-200/90">
            <strong className="font-semibold">How it works:</strong>
          </p>
          <ul className="text-xs text-blue-300/70 space-y-1 list-disc list-inside ml-1">
            <li>Timer resets automatically when you interact with the page</li>
            <li>60-second warning appears before session disconnect</li>
            <li>All sensitive data is purged when session expires</li>
            <li>Wallet will need to be reconnected after auto-lock</li>
          </ul>
        </div>
      </div>

      {/* Security notice for "Never" option */}
      {autoLockDuration === "never" && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
        >
          <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-200">
              Security Warning
            </p>
            <p className="mt-1 text-xs text-red-300/80">
              Disabling auto-lock may expose your wallet to unauthorized access on
              shared or public devices. Enable auto-lock for maximum security.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoLockSettings;
