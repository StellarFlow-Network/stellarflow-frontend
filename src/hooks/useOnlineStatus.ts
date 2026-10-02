"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type OnlineStatusState = {
  isOnline: boolean;
  lastOnlineTime: Date | null;
  lastOfflineTime: Date | null;
};

let globalState: OnlineStatusState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastOnlineTime: null,
  lastOfflineTime: null,
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
  return { isOnline: true, lastOnlineTime: null, lastOfflineTime: null };
}

function notifyListeners() {
  listeners.forEach(callback => callback());
}

function updateOnlineStatus() {
  const wasOnline = globalState.isOnline;
  const isNowOnline = navigator.onLine;
  
  if (wasOnline !== isNowOnline) {
    globalState = {
      ...globalState,
      isOnline: isNowOnline,
      lastOnlineTime: isNowOnline ? new Date() : globalState.lastOnlineTime,
      lastOfflineTime: !isNowOnline ? new Date() : globalState.lastOfflineTime,
    };
    notifyListeners();
  }
}

// Initialize global event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Also listen to visibilitychange to check connection when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateOnlineStatus();
    }
  });
}

/**
 * Hook to detect online/offline status changes
 * 
 * @returns Object containing online status and timestamps
 * 
 * @example
 * ```tsx
 * const { isOnline, lastOfflineTime } = useOnlineStatus();
 * if (!isOnline) {
 *   return <div>You're offline. Last connected: {lastOfflineTime}</div>;
 * }
 * ```
 */
export function useOnlineStatus() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  
  return {
    isOnline: state.isOnline,
    lastOnlineTime: state.lastOnlineTime,
    lastOfflineTime: state.lastOfflineTime,
  };
}