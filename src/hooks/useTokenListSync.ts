"use client";

import { useEffect, useRef } from "react";
import { syncAllTokenLists } from "@/lib/tokenListService";

/**
 * Hook to automatically sync all enabled token lists every 24 hours
 * in the background while the app is running.
 */
export function useTokenListSync() {
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial sync on mount
    syncAllTokenLists().catch((error) => {
      console.error("Initial token list sync failed:", error);
    });

    // Set up 24-hour interval for background sync
    const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms

    syncIntervalRef.current = setInterval(() => {
      syncAllTokenLists().catch((error) => {
        console.error("Background token list sync failed:", error);
      });
    }, SYNC_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);
}
