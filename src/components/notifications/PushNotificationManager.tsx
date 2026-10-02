"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  Settings,
  X,
  Check,
  AlertTriangle,
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  Info,
  Smartphone,
  Globe
} from "lucide-react";
import { usePushNotifications, useNotificationTriggers } from "@/hooks/usePushNotifications";

interface PushNotificationManagerProps {
  /** Whether to show as a modal dialog */
  modal?: boolean;
  /** Function to close modal */
  onClose?: () => void;
  /** Compact view for embedding in other components */
  compact?: boolean;
  /** Auto-show setup prompt for new users */
  autoPrompt?: boolean;
}

/**
 * PushNotificationManager
 * 
 * Comprehensive push notification management component (#894).
 * 
 * Features:
 * - Browser permission request with clear explanation
 * - Service worker registration and subscription management
 * - Notification trigger preferences (price, health factor, harvests, transactions)
 * - Test notification functionality
 * - Platform-specific setup instructions
 * - Opt-out functionality with instant revocation
 */
export function PushNotificationManager({
  modal = false,
  onClose,
  compact = false,
  autoPrompt = false
}: PushNotificationManagerProps) {
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

  const [showSetup, setShowSetup] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  // Auto-prompt for new users
  useEffect(() => {
    if (autoPrompt && supported && permission === 'default') {
      const hasPrompted = localStorage.getItem('stellarflow-notification-prompted');
      if (!hasPrompted) {
        setShowSetup(true);
        localStorage.setItem('stellarflow-notification-prompted', 'true');
      }
    }
  }, [autoPrompt, supported, permission]);

  const handleEnableNotifications = useCallback(async () => {
    try {
      const perm = await requestPermission();
      if (perm === 'granted') {
        await subscribeToNotifications();
        setShowSetup(false);
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
        body: 'If you can see this, push notifications are working correctly!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'test-notification',
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Dashboard',
            icon: '/icon-192.png'
          }
        ],
        data: {
          url: '/',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    } finally {
      setTimeout(() => setTestingNotification(false), 2000);
    }
  }, [permission, showNotification]);

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'price_alert': return TrendingUp;
      case 'health_factor': return Shield;
      case 'vault_harvest': return Zap;
      case 'transaction': return ArrowRight;
      default: return Bell;
    }
  };

  const getBrowserIcon = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) return Globe;
    if (userAgent.includes('safari')) return Smartphone;
    return Globe;
  };

  const isSubscribed = subscription !== null;
  const canNotify = supported && permission === 'granted' && isSubscribed;

  const content = (
    <div className={`${modal ? 'max-h-[80vh] overflow-y-auto' : ''}`}>
      {/* Header */}
      {!compact && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            Push Notifications
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Stay informed with real-time alerts for price changes, health factors, and vault activities.
          </p>
        </div>
      )}

      {/* Unsupported Browser */}
      {!supported && (
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-200 mb-1">Not Supported</h3>
              <p className="text-sm text-red-300 mb-3">
                Push notifications are not supported in your current browser.
              </p>
              <div className="text-xs text-red-400">
                <p>Supported browsers:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Chrome 50+ (Desktop & Mobile)</li>
                  <li>Firefox 44+ (Desktop & Mobile)</li>
                  <li>Edge 17+ (Desktop)</li>
                  <li>Safari 16+ (macOS, iOS 16.4+)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Prompt */}
      {supported && permission === 'default' && (showSetup || compact) && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 mb-6">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-200 mb-1">Enable Notifications</h3>
              <p className="text-sm text-blue-300 mb-4">
                Get notified about important events even when StellarFlow isn't open.
              </p>
              
              <div className="space-y-2 mb-4 text-xs text-blue-300">
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400" />
                  <span>Price alerts when targets are hit</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400" />
                  <span>Health factor warnings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400" />
                  <span>Vault harvest notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400" />
                  <span>Transaction confirmations</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleEnableNotifications}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" />
                  {loading ? 'Setting up...' : 'Enable Notifications'}
                </button>
                
                {!compact && (
                  <button
                    onClick={() => setShowSetup(false)}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    Maybe later
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Denied */}
      {permission === 'denied' && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 mb-6">
          <div className="flex items-start gap-3">
            <BellOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-200 mb-1">Notifications Blocked</h3>
              <p className="text-sm text-amber-300 mb-3">
                You've blocked notifications for this site. To enable them:
              </p>
              
              <div className="space-y-2 text-xs text-amber-300">
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-amber-900/30 px-1.5 py-0.5 rounded">1.</span>
                  <span>Click the lock icon in your browser's address bar</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-amber-900/30 px-1.5 py-0.5 rounded">2.</span>
                  <span>Set notifications to "Allow"</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-amber-900/30 px-1.5 py-0.5 rounded">3.</span>
                  <span>Refresh this page</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Status */}
      {canNotify && (
        <div className="rounded-xl border border-green-500/20 bg-green-950/10 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                <Bell className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-green-200">Notifications Active</h3>
                <p className="text-sm text-green-300">You'll receive alerts based on your preferences below.</p>
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
      )}

      {/* Notification Triggers */}
      {canNotify && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Notification Preferences
          </h3>
          
          {triggersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="h-4 bg-neutral-700 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-neutral-800 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {triggers.map((trigger) => {
                const Icon = getTriggerIcon(trigger.type);
                return (
                  <div
                    key={trigger.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                          <Icon className="h-4 w-4 text-neutral-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{trigger.title}</h4>
                          <p className="text-sm text-neutral-400">{trigger.description}</p>
                          
                          {/* Trigger-specific settings */}
                          {trigger.type === 'price_alert' && trigger.enabled && (
                            <div className="mt-2 text-xs text-neutral-500">
                              Alert on {(trigger.conditions.threshold * 100).toFixed(1)}%+ price changes
                            </div>
                          )}
                          {trigger.type === 'health_factor' && trigger.enabled && (
                            <div className="mt-2 text-xs text-neutral-500">
                              Alert when health factor drops below {trigger.conditions.threshold}
                            </div>
                          )}
                          {trigger.type === 'vault_harvest' && trigger.enabled && (
                            <div className="mt-2 text-xs text-neutral-500">
                              Alert on harvests ≥ ${trigger.conditions.minimumAmount}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => trigger.enabled ? disableTrigger(trigger.id) : enableTrigger(trigger.id)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          trigger.enabled
                            ? 'bg-blue-600'
                            : 'bg-neutral-700'
                        }`}
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
        </div>
      )}

      {/* Browser Information */}
      {supported && !compact && (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-400 space-y-1">
              <p><strong className="text-neutral-300">How it works:</strong> Notifications are delivered through your browser even when StellarFlow is closed.</p>
              <p><strong className="text-neutral-300">Privacy:</strong> Your notification preferences are stored locally. We never spam or sell your data.</p>
              <p><strong className="text-neutral-300">Battery:</strong> Minimal impact on device performance and battery life.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
            <h2 className="text-lg font-bold text-white">Notification Settings</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                aria-label="Close notification settings"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="p-6">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-4' : ''}>
      {content}
    </div>
  );
}

export default PushNotificationManager;
