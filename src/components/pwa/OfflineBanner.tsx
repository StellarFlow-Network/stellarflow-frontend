"use client";

import React, { useCallback, useEffect, useState } from "react";
import { WifiOff, Wifi, X, Clock } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface OfflineBannerProps {
  /** Show a dismiss button */
  dismissible?: boolean;
  /** Auto-hide after reconnection (milliseconds) */
  autoHideDelay?: number;
}

/**
 * OfflineBanner
 *
 * Displays an offline warning banner when network connection is lost (#883).
 *
 * Features:
 * - Automatically appears when navigator.onLine becomes false
 * - Shows last connection time when offline
 * - Automatically hides when connection is restored
 * - Smooth slide-down animation
 * - Optional dismiss button
 * 
 * @example
 * ```tsx
 * <OfflineBanner dismissible autoHideDelay={3000} />
 * ```
 */
export function OfflineBanner({ 
  dismissible = false, 
  autoHideDelay = 2000 
}: OfflineBannerProps) {
  const { isOnline, lastOfflineTime, lastOnlineTime } = useOnlineStatus();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  // Show banner when offline
  useEffect(() => {
    if (!isOnline && !dismissed) {
      setVisible(true);
      setShowReconnected(false);
    }
  }, [isOnline, dismissed]);

  // Handle reconnection
  useEffect(() => {
    if (isOnline && visible) {
      setShowReconnected(true);
      
      // Auto-hide after delay
      const timer = setTimeout(() => {
        setVisible(false);
        setShowReconnected(false);
        setDismissed(false);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [isOnline, visible, autoHideDelay]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
  }, []);

  const formatLastSeen = useCallback((date: Date | null) => {
    if (!date) return "Unknown";
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor(diff / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    } else if (seconds > 5) {
      return `${seconds}s ago`;
    } else {
      return "Just now";
    }
  }, []);

  if (!visible) return null;

  return (
    <div 
      className="fixed top-0 left-0 z-[60] w-full border-b border-red-500/20 bg-red-950/95 backdrop-blur-md animate-in slide-in-from-top-full duration-300"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          {showReconnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-400 animate-pulse" />
              <div>
                <span className="font-medium text-green-100">
                  You're back online!
                </span>
                <span className="ml-2 text-xs text-green-300">
                  Connection restored
                </span>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-400 animate-pulse" />
              <div>
                <span className="font-medium text-red-100">
                  You're currently offline
                </span>
                {lastOfflineTime && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-red-300">
                    <Clock className="h-3 w-3" />
                    <span>Connection lost {formatLastSeen(lastOfflineTime)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {(dismissible || showReconnected) && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-900/50 hover:text-red-300"
            aria-label="Dismiss offline banner"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Subtle loading bar for offline status */}
      {!showReconnected && (
        <div className="h-0.5 w-full bg-red-900/30">
          <div className="h-full bg-red-500/50 animate-pulse" />
        </div>
      )}
    </div>
  );
}

export default OfflineBanner;