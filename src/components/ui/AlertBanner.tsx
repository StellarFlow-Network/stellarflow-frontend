'use client';

import { useState, useEffect } from 'react';

export interface SystemHealthAlert {
  id: string;
  type: 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  isMaintenanceScheduled?: boolean;
  scheduledTime?: string;
}

const DISMISSED_ALERTS_KEY = 'stellarflow_dismissed_alerts';

export const DEFAULT_ALERT: SystemHealthAlert = {
  id: 'rpc_maint_2026_07',
  type: 'warning',
  title: 'RPC Maintenance Scheduled',
  message: 'Stellar Horizon RPC nodes will undergo scheduled maintenance. Swap transactions may experience slight delays.',
  isMaintenanceScheduled: true,
  scheduledTime: 'Jul 30, 2026 02:00 UTC',
};

type AlertBannerProps = {
  alert?: SystemHealthAlert;
};

export function AlertBanner({ alert = DEFAULT_ALERT }: AlertBannerProps) {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      const dismissed: string[] = JSON.parse(
        localStorage.getItem(DISMISSED_ALERTS_KEY) || '[]'
      );
      if (alert && !dismissed.includes(alert.id)) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, [alert]);

  function handleDismiss() {
    setIsVisible(false);
    try {
      const dismissed: string[] = JSON.parse(
        localStorage.getItem(DISMISSED_ALERTS_KEY) || '[]'
      );
      if (!dismissed.includes(alert.id)) {
        dismissed.push(alert.id);
        localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(dismissed));
      }
    } catch {
      // localStorage write error ignored
    }
  }

  if (!isVisible || !alert) return null;

  const bgStyle =
    alert.type === 'critical'
      ? 'bg-rose-600 text-white'
      : alert.type === 'warning'
      ? 'bg-amber-500 text-slate-950'
      : 'bg-indigo-600 text-white';

  return (
    <aside
      role="region"
      aria-label="System Health Announcement"
      className={`relative w-full px-4 py-2.5 shadow-md ${bgStyle} transition-all duration-300`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-xs font-medium sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-base" role="img" aria-label="alert icon">
            {alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '🔔' : 'ℹ️'}
          </span>
          <div>
            <strong className="font-semibold">{alert.title}: </strong>
            <span>{alert.message}</span>
            {alert.scheduledTime && (
              <span className="ml-1 text-[11px] opacity-90 font-mono">
                [{alert.scheduledTime}]
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss alert banner"
          className="shrink-0 rounded p-1 hover:bg-black/10 transition-colors focus:outline-none focus:ring-2 focus:ring-current"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
