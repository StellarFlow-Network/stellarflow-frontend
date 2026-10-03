"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type NotificationPermission = 'default' | 'granted' | 'denied';

type PushNotificationState = {
  permission: NotificationPermission;
  supported: boolean;
  subscription: PushSubscription | null;
  loading: boolean;
};

type NotificationTrigger = {
  id: string;
  type: 'price_alert' | 'health_factor' | 'vault_harvest' | 'transaction';
  enabled: boolean;
  conditions: Record<string, any>;
  title: string;
  description: string;
};

let globalState: PushNotificationState = {
  permission: 'default',
  supported: false,
  subscription: null,
  loading: false,
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return globalState;
}

function getServerSnapshot() {
  return { permission: 'default', supported: false, subscription: null, loading: false };
}

function notifyListeners() {
  listeners.forEach(callback => callback());
}

function updateState(updates: Partial<PushNotificationState>) {
  globalState = { ...globalState, ...updates };
  notifyListeners();
}

// Initialize notification state
if (typeof window !== 'undefined' && 'Notification' in window) {
  globalState.supported = true;
  globalState.permission = Notification.permission;
  
  // Check for existing service worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.pushManager.getSubscription().then(subscription => {
        updateState({ subscription });
      }).catch(() => {
        // Subscription doesn't exist or error occurred
        updateState({ subscription: null });
      });
    });
  }
}

/**
 * Hook for managing push notifications
 * 
 * @returns Object with notification state and management functions
 */
export function usePushNotifications() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.supported) {
      throw new Error('Push notifications are not supported in this browser');
    }
    
    updateState({ loading: true });
    
    try {
      const permission = await Notification.requestPermission();
      updateState({ permission, loading: false });
      return permission;
    } catch (error) {
      updateState({ loading: false });
      throw error;
    }
  }, [state.supported]);
  
  const subscribeToPushNotifications = useCallback(async (): Promise<PushSubscription | null> => {
    if (!state.supported || state.permission !== 'granted') {
      return null;
    }
    
    updateState({ loading: true });
    
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Generate VAPID key for your application
      const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
        // Default demo key - replace with your actual VAPID public key
        'BNzQNNJUQQGJnzQ0cOZdO5JbZMWLl5cEU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5cU5c';
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
      });
      
      updateState({ subscription, loading: false });
      
      // Store subscription on server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          timestamp: new Date().toISOString(),
        }),
      });
      
      return subscription;
    } catch (error) {
      updateState({ loading: false });
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }, [state.supported, state.permission]);
  
  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!state.subscription) return;
    
    updateState({ loading: true });
    
    try {
      await state.subscription.unsubscribe();
      
      // Remove subscription from server
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: state.subscription.endpoint,
        }),
      });
      
      updateState({ subscription: null, loading: false });
    } catch (error) {
      updateState({ loading: false });
      console.error('Failed to unsubscribe from push notifications:', error);
    }
  }, [state.subscription]);
  
  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (state.permission !== 'granted') return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'stellarflow-notification',
        requireInteraction: false,
        ...options,
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }, [state.permission]);
  
  return {
    ...state,
    requestPermission,
    subscribe: subscribeToPushNotifications,
    unsubscribe,
    showNotification,
  };
}

/**
 * Hook for managing notification triggers and preferences
 */
export function useNotificationTriggers() {
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load triggers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stellarflow-notification-triggers');
      if (saved) {
        setTriggers(JSON.parse(saved));
      } else {
        // Set default triggers
        const defaultTriggers: NotificationTrigger[] = [
          {
            id: 'price-alerts',
            type: 'price_alert',
            enabled: false,
            conditions: { threshold: 0.05 }, // 5% change
            title: 'Price Alerts',
            description: 'Get notified when token prices change significantly',
          },
          {
            id: 'health-factor',
            type: 'health_factor',
            enabled: false,
            conditions: { threshold: 1.2 }, // Below 1.2 health factor
            title: 'Health Factor Warnings',
            description: 'Alert when vault health factor drops below critical levels',
          },
          {
            id: 'vault-harvest',
            type: 'vault_harvest',
            enabled: false,
            conditions: { minimumAmount: 10 }, // Minimum $10 harvest
            title: 'Vault Harvests',
            description: 'Notify when yield vaults are harvested',
          },
          {
            id: 'transactions',
            type: 'transaction',
            enabled: false,
            conditions: { confirmations: 1 },
            title: 'Transaction Updates',
            description: 'Get updates on transaction confirmations',
          },
        ];
        setTriggers(defaultTriggers);
      }
    } catch (error) {
      console.error('Failed to load notification triggers:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateTrigger = useCallback((id: string, updates: Partial<NotificationTrigger>) => {
    setTriggers(prev => {
      const updated = prev.map(trigger => 
        trigger.id === id ? { ...trigger, ...updates } : trigger
      );
      
      // Save to localStorage
      try {
        localStorage.setItem('stellarflow-notification-triggers', JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save notification triggers:', error);
      }
      
      return updated;
    });
  }, []);
  
  const enableTrigger = useCallback((id: string) => {
    updateTrigger(id, { enabled: true });
  }, [updateTrigger]);
  
  const disableTrigger = useCallback((id: string) => {
    updateTrigger(id, { enabled: false });
  }, [updateTrigger]);
  
  return {
    triggers,
    loading,
    updateTrigger,
    enableTrigger,
    disableTrigger,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
