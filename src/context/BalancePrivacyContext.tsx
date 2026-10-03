"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "stellarflow:balance-privacy";
interface BalancePrivacyValue { hidden: boolean; toggle: () => void; }
const BalancePrivacyContext = createContext<BalancePrivacyValue>({ hidden: false, toggle: () => {} });

export function BalancePrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try { setHidden(window.sessionStorage.getItem(STORAGE_KEY) === "true"); } catch { /* Keep the in-memory default when storage is blocked. */ }
  }, []);

  const toggle = useCallback(() => setHidden((current) => !current), []);
  useEffect(() => {
    document.documentElement.dataset.balancePrivacy = hidden ? "hidden" : "visible";
    try { window.sessionStorage.setItem(STORAGE_KEY, String(hidden)); } catch { /* The preference still applies for this page session. */ }
    return () => { delete document.documentElement.dataset.balancePrivacy; };
  }, [hidden]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "h" && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <BalancePrivacyContext.Provider value={value}>{children}</BalancePrivacyContext.Provider>;
}

export function useBalancePrivacy() {
  return useContext(BalancePrivacyContext);
}

export function BalanceValue({ children }: { children: ReactNode }) {
  const { hidden } = useBalancePrivacy();
  return <span data-sensitive-balance="true" aria-label={hidden ? "Balance hidden" : undefined}>{hidden ? "••••••" : children}</span>;
}
