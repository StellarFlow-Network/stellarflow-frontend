"use client";

import React, { useCallback, useEffect, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  PREFERENCE_LABELS,
  getNotificationPermission,
  isPushSupported,
  loadPreferences,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushPreferences,
  type NotificationPreferences,
} from "@/services/notifications";

export interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional wallet address forwarded to the backend with the subscription. */
  walletAddress?: string | null;
  onSaved?: (prefs: NotificationPreferences) => void;
}

type ToggleKey = Exclude<keyof NotificationPreferences, "enabled">;

export function NotificationPreferencesModal({
  isOpen,
  onClose,
  walletAddress,
  onSaved,
}: NotificationPreferencesModalProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setSupported(isPushSupported());
    setPermission(getNotificationPermission());
    setPrefs(loadPreferences());
    setError(null);
  }, [isOpen]);

  const handleMasterToggle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!prefs.enabled) {
        const next = { ...prefs, enabled: true };
        await subscribeToPush(next, walletAddress);
        setPrefs(next);
        setPermission("granted");
        onSaved?.(next);
      } else {
        await unsubscribeFromPush(walletAddress);
        const next = { ...prefs, enabled: false };
        setPrefs(next);
        onSaved?.(next);
      }
    } catch (err) {
      setError((err as Error).message);
      setPermission(getNotificationPermission());
    } finally {
      setBusy(false);
    }
  }, [prefs, walletAddress, onSaved]);

  const handleCategoryToggle = useCallback(
    async (key: ToggleKey) => {
      const next = { ...prefs, [key]: !prefs[key] };
      setPrefs(next);
      setBusy(true);
      setError(null);
      try {
        const saved = await updatePushPreferences(next, walletAddress);
        setPrefs(saved);
        onSaved?.(saved);
      } catch (err) {
        setError((err as Error).message);
        setPrefs(loadPreferences());
      } finally {
        setBusy(false);
      }
    },
    [prefs, walletAddress, onSaved],
  );

  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Push Notification Preferences"
      size="md"
    >
      <div className="space-y-5 text-gray-200">
        <p className="text-sm text-gray-400">
          Get native browser alerts for executed swaps, filled limit orders,
          remittance payouts, and governance votes. Clicks open the matching
          transaction details.
        </p>

        {!supported && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            This browser does not support the Web Push API.
          </div>
        )}

        {permission === "denied" && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            Notifications are blocked. Enable them in your browser site
            settings, then try again.
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#0d1117] px-4 py-3">
          <div className="flex items-start gap-3">
            <Icon id={ICON_IDS.bell} size={20} className="mt-0.5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">Enable push alerts</p>
              <p className="text-xs text-gray-500">
                Opt in to browser notifications for order fills.
              </p>
            </div>
          </div>
          <Toggle
            enabled={prefs.enabled}
            disabled={!supported || busy || permission === "denied"}
            onToggle={handleMasterToggle}
            ariaLabel="Enable push notifications"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Alert types
          </p>
          {(Object.keys(PREFERENCE_LABELS) as ToggleKey[]).map((key) => {
            const meta = PREFERENCE_LABELS[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-800/80 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-gray-100">{meta.title}</p>
                  <p className="text-xs text-gray-500">{meta.description}</p>
                </div>
                <Toggle
                  enabled={prefs[key]}
                  disabled={!prefs.enabled || busy}
                  onToggle={() => handleCategoryToggle(key)}
                  ariaLabel={`Toggle ${meta.title} alerts`}
                />
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </OptimizedDialog>
  );
}

function Toggle({
  enabled,
  disabled,
  onToggle,
  ariaLabel,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        enabled ? "bg-blue-600" : "bg-gray-700"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
          enabled ? "right-1" : "left-1"
        }`}
      />
    </button>
  );
}

export default NotificationPreferencesModal;
