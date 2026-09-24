"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "stellarflow-high-contrast";

interface AccessibilityContextValue {
  highContrast: boolean;
  toggleHighContrast: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const enabled = window.localStorage.getItem(STORAGE_KEY) === "true";
    setHighContrast(enabled);
    document.documentElement.classList.toggle("high-contrast", enabled);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
    window.localStorage.setItem(STORAGE_KEY, String(highContrast));
  }, [highContrast]);

  return (
    <AccessibilityContext.Provider
      value={{ highContrast, toggleHighContrast: () => setHighContrast((enabled) => !enabled) }}
    >
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