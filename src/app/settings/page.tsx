"use client";

import React, { useState, useEffect } from 'react';
import { Icon, ICON_IDS } from '@/components/icons';
import { useDebounce } from '../hooks/useDebounce';
import { useRafThrottle } from '../hooks/useRafThrottle';

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
  const [settings, setSettings] = useState<Settings>({
    emailReports: true,
    pushNotifications: true,
    publicStatusPage: false,
    multiSigApproval: false,
    sessionTimeout: '15 Minutes',
  });
  const [savedSettings, setSavedSettings] = useState<Settings>({ ...settings });
  const [isPending, setIsPending] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);

  const debouncedSettings = useDebounce(settings, 500);
  const isSaving = Date.now() - lastSaveTime < 500;
  const hasChanges = JSON.stringify(debouncedSettings) !== JSON.stringify(savedSettings);

  const throttledSetSessionTimeout = useRafThrottle((v: string) => setSettings(prev => ({ ...prev, sessionTimeout: v })));

  useEffect(() => {
    if (hasChanges && !isPending) {
      const timer = setTimeout(async () => {
        setIsPending(true);
        console.log('Saving settings:', debouncedSettings);
        await new Promise(r => setTimeout(r, 300));
        setSavedSettings({ ...debouncedSettings });
        setLastSaveTime(Date.now());
        setIsPending(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [debouncedSettings, hasChanges, isPending]);

  const handleToggle = (key: keyof Settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const multiSigTrackClasses = settings.multiSigApproval ? TOGGLE_STYLES.enabled.track : TOGGLE_STYLES.disabled.track;
  const multiSigKnobClasses = settings.multiSigApproval ? TOGGLE_STYLES.enabled.knob : TOGGLE_STYLES.disabled.knob;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">Admin / Configuration</p>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
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
        </section>

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

        <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Icon id={ICON_IDS.bell} size={20} className="text-purple-400" />
            Alert Channels
          </h2>
          <div className="space-y-4">
            <ToggleItem 
              icon={<Icon id={ICON_IDS.mailIcon} size={18} />} 
              title="Email Reports" 
              description="Receive weekly institutional summaries and uptime reports."
              enabled={settings.emailReports}
              onToggle={() => handleToggle('emailReports')}
            />
            <ToggleItem 
              icon={<Icon id={ICON_IDS.smartphone} size={18} />} 
              title="Push Notifications" 
              description="Alerts for Oracle Kill Switch and high-volatility events."
              enabled={settings.pushNotifications}
              onToggle={() => handleToggle('pushNotifications')}
            />
            <ToggleItem 
              icon={<Icon id={ICON_IDS.globe} size={18} />} 
              title="Public Status Page" 
              description="Automatically update the status.stellarflow.io page."
              enabled={settings.publicStatusPage}
              onToggle={() => handleToggle('publicStatusPage')}
            />
          </div>
        </section>

        <section className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Icon id={ICON_IDS.shield} size={20} className="text-green-400" />
            Governance Security
          </h2>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Multi-Sig Approval</p>
                <p className="text-xs text-gray-500">Require two admins to sign off on WASM upgrades.</p>
              </div>
              <button
                onClick={() => handleToggle('multiSigApproval')}
                className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${multiSigTrackClasses}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${multiSigKnobClasses}`} />
              </button>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Session Timeout</p>
                <p className="text-xs text-gray-500">Automatically logout after inactivity.</p>
              </div>
              <select 
                className="bg-[#0d1117] border border-gray-700 rounded py-1 px-2 text-xs"
                value={settings.sessionTimeout}
                onChange={(e) => throttledSetSessionTimeout(e.target.value)}
              >
                <option>15 Minutes</option>
                <option>1 Hour</option>
                <option>Never</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pt-4">
          <button className="px-6 py-2 border border-gray-700 rounded-lg text-sm hover:bg-gray-800 transition-all">
            Cancel
          </button>
          <button 
            disabled={!hasChanges || isPending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon id={ICON_IDS.save} size={18} />
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleItem({ icon, title, description, enabled, onToggle }: { icon: React.ReactNode, title: string, description: string, enabled: boolean, onToggle: () => void }) {
  const trackClasses = enabled ? TOGGLE_STYLES.enabled.track : TOGGLE_STYLES.disabled.track;
  const knobClasses = enabled ? TOGGLE_STYLES.enabled.knob : TOGGLE_STYLES.disabled.knob;

  return (
    <div className="flex items-start justify-between p-3 rounded-lg hover:bg-[#1c2128] transition-colors">
      <div className="flex gap-4">
        <div className="mt-1 text-gray-500">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${trackClasses}`}
      >
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${knobClasses}`} />
      </button>
    </div>
  );
}