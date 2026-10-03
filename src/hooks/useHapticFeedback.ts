'use client';

/**
 * useHapticFeedback.ts
 *
 * React Hook for interacting with the Native Mobile Haptic Feedback Engine.
 * Provides reactive user preference state, toggle functions, and semantic trigger helpers.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  HapticPattern,
  HapticPreset,
  getHapticsEnabled,
  setHapticsEnabled,
  toggleHaptics as toggleHapticsLib,
  isHapticsSupported,
  triggerHaptic,
  cancelHaptic,
  HAPTIC_CHANGE_EVENT,
  HAPTIC_PATTERNS,
} from '@/lib/haptics';

export interface UseHapticFeedbackReturn {
  /** Whether haptics are currently enabled in user settings */
  isEnabled: boolean;
  /** Whether the current platform/browser supports navigator.vibrate */
  isSupported: boolean;
  /** Toggle the user's haptics preference */
  toggle: () => boolean;
  /** Explicitly enable or disable haptics */
  setEnabled: (enabled: boolean) => void;
  /** Trigger a haptic feedback pattern */
  trigger: (pattern?: HapticPattern, force?: boolean) => boolean;
  /** Semantic helper: Short crisp tap (12ms) */
  triggerTap: (force?: boolean) => boolean;
  /** Semantic helper: Micro-tick for slider adjustments (8ms) */
  triggerSlider: (force?: boolean) => boolean;
  /** Semantic helper: Selection click (20ms) */
  triggerSelection: (force?: boolean) => boolean;
  /** Semantic helper: Double pulse for transaction submission and confirmation [40, 60, 40]ms */
  triggerTxConfirm: (force?: boolean) => boolean;
  /** Semantic helper: Double pulse alias for success */
  triggerSuccess: (force?: boolean) => boolean;
  /** Semantic helper: Error pattern [70, 40, 70]ms */
  triggerError: (force?: boolean) => boolean;
  /** Cancel any active vibration */
  cancel: () => boolean;
}

export function useHapticFeedback(): UseHapticFeedbackReturn {
  const [isEnabled, setIsEnabledState] = useState<boolean>(true);
  const [isSupported, setIsSupportedState] = useState<boolean>(false);

  useEffect(() => {
    // Read initial states on mount
    setIsEnabledState(getHapticsEnabled());
    setIsSupportedState(isHapticsSupported());

    // Listen for changes from other components/tabs
    const handleHapticChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setIsEnabledState(customEvent.detail.enabled);
      } else {
        setIsEnabledState(getHapticsEnabled());
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'sf_haptics_enabled') {
        setIsEnabledState(event.newValue === 'true');
      }
    };

    window.addEventListener(HAPTIC_CHANGE_EVENT, handleHapticChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(HAPTIC_CHANGE_EVENT, handleHapticChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = toggleHapticsLib();
    setIsEnabledState(next);
    return next;
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setHapticsEnabled(enabled);
    setIsEnabledState(enabled);
  }, []);

  const trigger = useCallback((pattern: HapticPattern = 'tap', force: boolean = false) => {
    return triggerHaptic(pattern, force);
  }, []);

  const triggerTap = useCallback((force: boolean = false) => {
    return triggerHaptic('tap', force);
  }, []);

  const triggerSlider = useCallback((force: boolean = false) => {
    return triggerHaptic('slider', force);
  }, []);

  const triggerSelection = useCallback((force: boolean = false) => {
    return triggerHaptic('selection', force);
  }, []);

  const triggerTxConfirm = useCallback((force: boolean = false) => {
    return triggerHaptic('txConfirm', force);
  }, []);

  const triggerSuccess = useCallback((force: boolean = false) => {
    return triggerHaptic('txConfirm', force);
  }, []);

  const triggerError = useCallback((force: boolean = false) => {
    return triggerHaptic('error', force);
  }, []);

  const cancel = useCallback(() => {
    return cancelHaptic();
  }, []);

  return {
    isEnabled,
    isSupported,
    toggle,
    setEnabled,
    trigger,
    triggerTap,
    triggerSlider,
    triggerSelection,
    triggerTxConfirm,
    triggerSuccess,
    triggerError,
    cancel,
  };
}
