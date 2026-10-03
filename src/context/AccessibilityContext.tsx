"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** localStorage key holding the persisted high-contrast preference. */
export const HIGH_CONTRAST_STORAGE_KEY = "stellarflow-high-contrast";

interface AccessibilityContextValue {
  /** True when the high-contrast (WCAG AAA) theme is active. */
  highContrast: boolean;
  /** False during SSR; true once the stored preference has been read. */
  mounted: boolean;
  /** Flips the preference and persists it. */
  toggleHighContrast: () => void;
  /** Sets the preference explicitly and persists it. */
  setHighContrast: (enabled: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

/**
 * Resolves the initial preference. A stored choice always wins; when the user
 * has never chosen, the OS `prefers-contrast: more` signal is honoured so the
 * feature works out of the box for users who need it.
 */
function readStoredPreference(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // localStorage can be blocked (private mode / disabled cookies). Fall
    // through to the OS preference so the feature still works this session.
  }

  try {
    return window.matchMedia("(prefers-contrast: more)").matches;
  } catch {
    return false;
  }
}

/**
 * Applies the preference to <html>. The `.high-contrast` class keeps legacy
 * selectors working while `data-contrast="high"` is the canonical hook for the
 * CSS layer in globals.css (mirrors the `data-balance-privacy` pattern).
 */
function applyHighContrast(enabled: boolean): void {
  const root = document.documentElement;
  root.classList.toggle("high-contrast", enabled);
  root.dataset.contrast = enabled ? "high" : "normal";
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrastState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setHighContrastState(readStoredPreference());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyHighContrast(highContrast);
    try {
      window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(highContrast));
    } catch {
      // Persistence is best-effort; the preference still applies this session.
    }
  }, [highContrast, mounted]);

  const setHighContrast = useCallback((enabled: boolean) => {
    setHighContrastState(enabled);
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrastState((enabled) => !enabled);
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({ highContrast, mounted, toggleHighContrast, setHighContrast }),
    [highContrast, mounted, toggleHighContrast, setHighContrast],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibilityContext() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibilityContext must be used inside <AccessibilityProvider>.");
  }
  return context;
}
