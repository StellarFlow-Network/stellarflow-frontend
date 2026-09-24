"use client";

/**
 * SystemThemeSync
 *
 * Client component that activates the OS color-scheme listener.
 * Renders nothing — its sole purpose is to call useSystemThemeSync()
 * within the React tree so the matchMedia listener is registered.
 */

import { useSystemThemeSync } from "@/hooks/useSystemThemeSync";

export function SystemThemeSync() {
  useSystemThemeSync();
  return null;
}
