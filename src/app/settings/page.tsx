"use client";

import React, { useState, useEffect } from 'react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import { useDebounce } from '../hooks/useDebounce';
import { useRafThrottle } from '../hooks/useRafThrottle';
import { openPushPreferencesModal } from '@/components/notifications';
import { loadPreferences } from '@/services/notifications';
import { useTransactionAudio } from '@/hooks/useTransactionAudio';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useScreenLock, ScreenLockModal } from '@/components/security/ScreenLockModal';
import { AutoLockSettings } from '@/components/security/AutoLockSettings';
import { useTransactionHistoryWithFallback } from '@/app/hooks/useTransactionHistory';
import { exportTransactionsToCsv, type TaxPlatform } from '@/utils/csvExport';
import { useToast } from '@/components/ui/ToastQueue';
import { useDashboardCustomizer } from '@/components/dashboard/useDashboardCustomizer';
import { WalletNonceResync } from '@/components/wallet/WalletNonceResync';
import { useZKProofLoader } from '@/components/zk/useZKProofLoader';
import { useThemeContext, type Theme } from '@/context/ThemeContext';

interface Settings {
  emailReports: boolean;
  pushNotifications: boolean;
  publicStatusPage: boolean;
  multiSigApproval: boolean;
  sessionTimeout: string;
}

const TOGGLE_STYLES = {
  enabled: {
    track: 'bg-blue-600',
    knob: 'right-1',
  },
  disabled: {
    track: 'bg-gray-700',
    knob: 'left-1',
  },
};

export default function SettingsPage() {
  const [showKey, setShowKey] = useState(false);
  const [screenLockModalOpen, setScreenLockModalOpen] = useState(false);
  const {
    isEnabled: soundEffectsEnabled,
    toggle: toggleSoundEffects,
    currentPack,
    setSoundPack,
    playPreview,
  } = useTransactionAudio();
  const {
    isEnabled: hapticsEnabled,
    toggle: toggleHaptics,
    triggerTap: testHapticTap,
    triggerTxConfirm: testHapticTx,
    isSupported: hapticsSupported,
  } = useHapticFeedback();
  const { isPinSet, isLocked, idleTimeoutMinutes, lockNow } = useScreenLock();
  const { data: transactions } = useTransactionHistoryWithFallback();
  const { addToast, updateToast } = useToast();
  const [exportPlatform, setExportPlatform] = useState<TaxPlatform>("standard");
  const [isExporting, setIsExporting] = useState(false);
  const { openCustomizer, Customizer } = useDashboardCustomizer();
  const { Loader: ZKProofLoader, startProofGeneration } = useZKProofLoader();
  const { theme: currentTheme, setTheme: setThemePreference, mounted: themeMounted } = useThemeContext();
  const [settings, setSettings] = useState<Settings>({
    emailReports: true,
    pushNotifications: false,
    publicStatusPage: false,
    multiSigApproval: false,
    sessionTimeout: '15 Minutes',
  });
  const [savedSettings, setSavedSettings] = useState<Settings>({ ...settings });
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const prefs = loadPreferences();
    setTimeout(() => {
      setSettings((prev) => ({ ...prev, pushNotifications: prefs.enabled }));
      setSavedSettings((prev) => ({ ...prev, pushNotifications: prefs.enabled }));
    }, 0);
  }, []);

  const debouncedSettings = useDebounce(settings, 500);

  const throttledSetSessionTimeout = useRafThrottle((v: string) => setSettings(prev => ({ ...prev, sessionTimeout: v })));

  // Compute hasChanges at render time to be used in the render and effect
  const hasChanges = JSON.stringify(debouncedSettings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    if (hasChanges && !isPending) {
      const timer = setTimeout(async () => {
        setIsPending(true);
        console.log('Saving settings:', debouncedSettings);
        await new Promise(r => setTimeout(r, 300));
        setSavedSettings({ ...debouncedSettings });
        setIsPending(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [debouncedSettings, hasChanges, isPending]);

  const handleToggle = (key: keyof Settings) => {
    if (key === 'pushNotifications') {
      openPushPreferencesModal();
      return;
    }
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const multiSigTrackClasses = settings.multiSigApproval ? TOGGLE_STYLES.enabled.track : TOGGLE_STYLES.disabled.track;
  const multiSigKnobClasses = settings.multiSigApproval ? TOGGLE_STYLES.enabled.knob : TOGGLE_STYLES.disabled.knob;

  const EXPORT_PLATFORMS: { label: string; value: TaxPlatform }[] = [
    { label: "Standard CSV", value: "standard" },
    { label: "Koinly", value: "koinly" },
    { label: "CoinTracker", value: "cointracker" },
  ];

  const handleExport = async () => {
    if (isExporting || !transactions || transactions.length === 0) return;

    setIsExporting(true);
    const platformLabel = EXPORT_PLATFORMS.find(p => p.value === exportPlatform)?.label;
    const toastId = addToast({
      title: "Preparing CSV export",
      description: `Formatting ${transactions.length} transactions for ${platformLabel}…`,
      status: "processing",
    });

    try {
      await exportTransactionsToCsv(transactions, { platform: exportPlatform });
      updateToast(toastId, {
        title: "Export ready",
        description: `${transactions.length} transactions downloaded as ${platformLabel} CSV.`,
        status: "confirmed",
      });
    } catch {
      updateToast(toastId, {
        title: "Export failed",
        description: "Could not generate the CSV file. Please try again.",
        status: "failed",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your platform preferences and notification settings</p>
      </div>

      <div className="max-w-4xl space-y-8">
        
        <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Icon id={ICON_IDS.user} size={20} className="text-blue-400" />
            Admin Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Display Name</label>
              <input type="text" defaultValue="Sadeeq" className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Admin Role</label>
              <input type="text" defaultValue="Lead Trainer / Developer" disabled className="w-full bg-[#0d1117] border border-gray-800 rounded-md py-2 px-3 text-sm text-gray-500 cursor-not-allowed" />
            </div>
          </div>

        <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Icon id={ICON_IDS.sun} size={20} className="text-yellow-400" />
            Appearance
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Theme Preference</p>
              <p className="text-xs text-gray-500 mb-4">Choose how StellarFlow looks. "System" automatically matches your OS color scheme.</p>
            </div>
            {themeMounted && (
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "light", label: "Light", icon: SunIcon },
                  { value: "dark", label: "Dark", icon: MoonIcon },
                  { value: "system", label: "System", icon: MonitorIcon },
                ] as const).map((option) => {
                  const isActive = (currentTheme ?? "system") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setThemePreference(option.value as Theme)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                        isActive
                          ? "border-blue-500 bg-blue-600/10 text-blue-400"
                          : "border-gray-800 bg-[#0d1117]/50 hover:border-gray-700 text-gray-400 hover:text-gray-200"
                      }`}
                      aria-pressed={isActive}
                    >
                      <option.icon className={isActive ? "text-blue-400" : "text-gray-500"} />
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-600">
              {currentTheme === "system"
                ? "Currently following your system preference."
                : `Currently using ${currentTheme} mode.`}
            </p>
          </div>
        </section>

        {/* Auto-Lock Security Settings */}
        <AutoLockSettings />

        <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon id={ICON_IDS.key} size={20} className="text-yellow-400" />
              Infrastructure Keys
            </h2>
            <button className="text-xs text-blue-500 hover:underline flex items-center gap-1">
              <Icon id={ICON_IDS.rotateCcw} size={12} /> Rotate Keys
            </button>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase font-bold">Backend Secret Key</label>
              <div className="relative">
                <input 
                  type={showKey ? "text" : "password"} 
                  defaultValue="sk_live_51P2z..." 
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-3 pr-10 text-sm font-mono focus:outline-none" 
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <Icon id={ICON_IDS.eyeOff} size={16} /> : <Icon id={ICON_IDS.eye} size={16} />}
                </button>
              </div>
            </div>
          </div>
        </section>

            <form onSubmit={handleSaveCustomRpc} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Custom Horizon URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://horizon-custom.example.com"
                    className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isValidating}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    {isValidating && (
                      <span className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
                    )}
                    Validate & Save
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg" role="alert">
                  <Icon id={ICON_IDS.alertTriangle} size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                  <Icon id={ICON_IDS.checkCircle || ICON_IDS.alertTriangle} size={14} className="shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-gray-400">
                <span>Active Horizon Endpoint: <strong className="text-gray-200 font-mono">{horizonUrl}</strong></span>
                {customHorizonUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      resetToDefaultEndpoint();
                      setInputUrl("");
                    }}
                    className="text-red-400 hover:underline"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function ToggleItem({ icon, title, description, enabled, onToggle }: { icon: React.ReactNode, title: string, description: string, enabled: boolean, onToggle: () => void }) {
  const trackClasses = enabled ? TOGGLE_STYLES.enabled.track : TOGGLE_STYLES.disabled.track;
  const knobClasses = enabled ? TOGGLE_STYLES.enabled.knob : TOGGLE_STYLES.disabled.knob;

  return (
    <div className="flex items-start justify-between p-3 rounded-lg relative overflow-hidden" style={{ transition: 'border-color 150ms ease' }}>
      <span className="absolute inset-0 bg-[#1c2128] opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
      <div className="flex gap-4 relative z-10">
        <div className="mt-1 text-gray-500">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="relative z-10">
        <button
          onClick={onToggle}
          className={`w-10 h-5 rounded-full relative cursor-pointer ${trackClasses}`}
          style={{ transition: 'transform 150ms ease' }}
        >
          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full ${knobClasses}`} style={{ transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </button>
      </div>
    </div>
  );
}

function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
