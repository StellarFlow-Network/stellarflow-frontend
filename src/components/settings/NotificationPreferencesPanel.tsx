"use client";

import React, { useCallback, useState } from "react";
import {
  Bell,
  BellOff,
  Settings,
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  Smartphone,
  Globe,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePushNotifications, useNotificationTriggers } from "@/hooks/usePushNotifications";

interface NotificationPreferencesPanelProps {
  /** Show as compact view */
  compact?: boolean;
}

/**
 * NotificationPreferencesPanel
 * 
 * Comprehensive notification preferences management for settings page (#894).
 * 
 * Features:
 * - Push notification permission management
 * - Individual trigger preferences (price, health factor, harvests, transactions)
 * - Test notification functionality
 * - Browser compatibility information
 * - Sound notification preferences
 * - Frequency and timing controls
 */
export function NotificationPreferencesPanel({ 
  compact = false 
}: NotificationPreferencesPanelProps) {
  const {
    permission,
    supported,
    subscription,
    loading,
    requestPermission,
    subscribe: subscribeToNotifications,
    unsubscribe,
    showNotification,
  } = usePushNotifications();

  const {
    triggers,
    loading: triggersLoading,
    updateTrigger,
    enableTrigger,
    disableTrigger,
  } = useNotificationTriggers();

  const [testingNotification, setTestingNotification] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('stellarflow-notification-sound') !== 'false';
  });
  const [quietHours, setQuietHours] = useState(() => {
    if (typeof window === 'undefined') return { enabled: false, start: '22:00', end: '08:00' };
    const saved = localStorage.getItem('stellarflow-quiet-hours');
    return saved ? JSON.parse(saved) : { enabled: false, start: '22:00', end: '08:00' };
  });

  const isSubscribed = subscription !== null;
  const canNotify = supported && permission === 'granted' && isSubscribed;

  const handleEnableNotifications = useCallback(async () => {
    try {
      const perm = await requestPermission();
      if (perm === 'granted') {
        await subscribeToNotifications();
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    }
  }, [requestPermission, subscribeToNotifications]);

  const handleDisableNotifications = useCallback(async () => {
    try {
      await unsubscribe();
      // Disable all triggers
      triggers.forEach(trigger => {
        if (trigger.enabled) {
          disableTrigger(trigger.id);
        }
      });
    } catch (error) {
      console.error('Failed to disable notifications:', error);
    }
  }, [unsubscribe, triggers, disableTrigger]);

  const handleTestNotification = useCallback(async () => {
    if (permission !== 'granted') return;
    
    setTestingNotification(true);
    try {
      await showNotification('StellarFlow Test Notification', {
        body: 'This is a test notification to verify your settings are working correctly.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'settings-test',
        requireInteraction: false,
        silent: !soundEnabled,
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    } finally {
      setTimeout(() => setTestingNotification(false), 2000);
    }
  }, [permission, showNotification, soundEnabled]);

  const handleSoundToggle = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('stellarflow-notification-sound', enabled.toString());
  }, []);

  const handleQuietHoursChange = useCallback((updates: Partial<typeof quietHours>) => {
    const newQuietHours = { ...quietHours, ...updates };
    setQuietHours(newQuietHours);
    localStorage.setItem('stellarflow-quiet-hours', JSON.stringify(newQuietHours));
  }, [quietHours]);

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'price_alert': return TrendingUp;
      case 'health_factor': return Shield;
      case 'vault_harvest': return Zap;
      case 'transaction': return ArrowRight;
      default: return Bell;
    }
  };

  const getTriggerColor = (type: string) => {
    switch (type) {
      case 'price_alert': return 'text-blue-400';
      case 'health_factor': return 'text-red-400';
      case 'vault_harvest': return 'text-green-400';
      case 'transaction': return 'text-purple-400';
      default: return 'text-neutral-400';
    }
  };

  const renderNotificationStatus = () => {
    if (!supported) {
      return (
        <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-200 mb-1">Browser Not Supported</h3>
              <p className="text-sm text-red-300 mb-3">
                Push notifications are not available in your current browser.
              </p>
              <div className="space-y-1 text-xs text-red-400">
                <p className="font-medium">Supported browsers:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Chrome 50+ (Desktop & Mobile)</li>
                  <li>Firefox 44+ (Desktop & Mobile)</li>
                  <li>Edge 17+ (Desktop)</li>
                  <li>Safari 16+ (macOS, iOS 16.4+)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (permission === 'denied') {
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <BellOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-200 mb-1">Notifications Blocked</h3>
              <p className="text-sm text-amber-300 mb-3">
                You've blocked notifications for this site. To enable them:
              </p>
              <ol className="space-y-1 text-xs text-amber-300 mb-3">
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-amber-900/30 px-1.5 py-0.5 rounded text-[10px] shrink-0">1</span>
                  <span>Click the lock icon in your browser's address bar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-amber-900/30 px-1.5 py-0.5 rounded text-[10px] shrink-0">2</span>
                  <span>Set notifications to "Allow"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-amber-900/30 px-1.5 py-0.5 rounded text-[10px] shrink-0">3</span>
                  <span>Refresh this page</span>
                </li>
              </ol>
              <a
                href="https://support.google.com/chrome/answer/3220216"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 underline"
              >
                Learn more about browser notifications
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      );
    }

    if (permission === 'default') {
      return (
        <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-200 mb-1">Enable Push Notifications</h3>
              <p className="text-sm text-blue-300 mb-3">
                Get notified about important events even when StellarFlow isn't open.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs text-blue-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                  <span>Price alerts when targets are hit</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                  <span>Health factor warnings</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                  <span>Vault harvest notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                  <span>Transaction confirmations</span>
                </div>
              </div>

              <button
                onClick={handleEnableNotifications}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                <Bell className="h-4 w-4" />
                {loading ? 'Setting up...' : 'Enable Notifications'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Notifications are enabled
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-950/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
              <Bell className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-200">Notifications Enabled</h3>
              <p className="text-sm text-green-300">You'll receive alerts based on your preferences below</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestNotification}
              disabled={testingNotification}
              className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
            >
              {testingNotification ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border border-green-400 border-t-transparent" />
                  Testing...
                </>
              ) : (
                <>
                  <Bell className="h-3 w-3" />
                  Test
                </>
              )}
            </button>
            
            <button
              onClick={handleDisableNotifications}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              <BellOff className="h-3 w-3" />
              Disable All
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Notification Status */}
      {renderNotificationStatus()}

      {/* Notification Preferences */}
      {canNotify && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Notification Types
          </h3>
          
          {triggersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                  <div className="h-4 bg-neutral-700 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-neutral-800 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {triggers.map((trigger) => {
                const Icon = getTriggerIcon(trigger.type);
                const iconColor = getTriggerColor(trigger.type);
                
                return (
                  <div
                    key={trigger.id}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-1">{trigger.title}</h4>
                          <p className="text-sm text-neutral-400 mb-2">{trigger.description}</p>
                          
                          {/* Trigger-specific settings */}
                          {trigger.enabled && (
                            <div className="space-y-2">
                              {trigger.type === 'price_alert' && (
                                <div className="flex items-center gap-4 text-xs text-neutral-500">
                                  <span>Alert threshold:</span>
                                  <select
                                    value={trigger.conditions.threshold}
                                    onChange={(e) => updateTrigger(trigger.id, {
                                      conditions: { ...trigger.conditions, threshold: parseFloat(e.target.value) }
                                    })}
                                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                                  >
                                    <option value={0.01}>1%</option>
                                    <option value={0.05}>5%</option>
                                    <option value={0.1}>10%</option>
                                    <option value={0.2}>20%</option>
                                  </select>
                                  <span>price change</span>
                                </div>
                              )}
                              
                              {trigger.type === 'health_factor' && (
                                <div className="flex items-center gap-4 text-xs text-neutral-500">
                                  <span>Alert when below:</span>
                                  <select
                                    value={trigger.conditions.threshold}
                                    onChange={(e) => updateTrigger(trigger.id, {
                                      conditions: { ...trigger.conditions, threshold: parseFloat(e.target.value) }
                                    })}
                                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                                  >
                                    <option value={1.5}>1.5</option>
                                    <option value={1.2}>1.2</option>
                                    <option value={1.1}>1.1</option>
                                  </select>
                                  <span>health factor</span>
                                </div>
                              )}
                              
                              {trigger.type === 'vault_harvest' && (
                                <div className="flex items-center gap-4 text-xs text-neutral-500">
                                  <span>Minimum amount:</span>
                                  <select
                                    value={trigger.conditions.minimumAmount}
                                    onChange={(e) => updateTrigger(trigger.id, {
                                      conditions: { ...trigger.conditions, minimumAmount: parseFloat(e.target.value) }
                                    })}
                                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                                  >
                                    <option value={1}>$1</option>
                                    <option value={10}>$10</option>
                                    <option value={50}>$50</option>
                                    <option value={100}>$100</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => trigger.enabled ? disableTrigger(trigger.id) : enableTrigger(trigger.id)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          trigger.enabled ? 'bg-blue-600' : 'bg-neutral-700'
                        }`}
                        aria-label={`${trigger.enabled ? 'Disable' : 'Enable'} ${trigger.title}`}
                      >
                        <div
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                            trigger.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sound Settings */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-blue-400" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-neutral-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white">Notification Sounds</h4>
                  <p className="text-sm text-neutral-400">Play audio with notifications</p>
                </div>
              </div>
              
              <button
                onClick={() => handleSoundToggle(!soundEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  soundEnabled ? 'bg-blue-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-white">Quiet Hours</h4>
                <p className="text-sm text-neutral-400">Pause non-critical notifications during specified hours</p>
              </div>
              
              <button
                onClick={() => handleQuietHoursChange({ enabled: !quietHours.enabled })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  quietHours.enabled ? 'bg-blue-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    quietHours.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            
            {quietHours.enabled && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400">From:</label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => handleQuietHoursChange({ start: e.target.value })}
                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400">To:</label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => handleQuietHoursChange({ end: e.target.value })}
                    className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Privacy Information */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
              <div className="text-xs text-neutral-400 space-y-2">
                <p><strong className="text-neutral-300">Privacy:</strong> Your notification preferences are stored locally in your browser. We never share or sell your notification data.</p>
                <p><strong className="text-neutral-300">Battery:</strong> Push notifications have minimal impact on your device's battery life and performance.</p>
                <p><strong className="text-neutral-300">Security:</strong> All notification data is encrypted and transmitted over secure connections only.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationPreferencesPanel;