"use client";

/**
 * ThemeContext
 *
 * Wraps next-themes to provide:
 *  - A typed React context for the current theme state
 *  - OS preference detection (via next-themes enableSystem)
 *  - localStorage persistence (handled transparently by next-themes)
 *  - A useTheme() hook that is safe to call in any client component
 *
 * Flash prevention is handled by the inline <script> injected in layout.tsx
 * before any CSS or JS is parsed, so the correct class is already on <html>
 * before React hydrates.
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useTheme as useNextTheme } from "next-themes";
import { useMounted } from "@/app/hooks/useMounted";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark" | "system";

export interface ThemeContextValue {
  /** Resolved theme ("light" | "dark"). undefined before mount. */
  resolvedTheme: "light" | "dark" | undefined;
  /** Raw stored preference including "system". undefined before mount. */
  theme: Theme | undefined;
  /** Toggle between light and dark. Falls back to "dark" on first call. */
  toggleTheme: () => void;
  /** Explicitly set the theme. */
  setTheme: (theme: Theme) => void;
  /** True once the component has mounted and theme is readable. */
  mounted: boolean;
  /** True when the resolved theme is "dark". */
  isDark: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ThemeContextProviderProps {
  children: ReactNode;
}

/**
 * ThemeContextProvider
 *
 * Must be rendered *inside* the next-themes <ThemeProvider> that lives in
 * layout.tsx. It reads from next-themes and re-exports a stable, typed API.
 */
export function ThemeContextProvider({ children }: ThemeContextProviderProps) {
  const {
    theme: rawTheme,
    resolvedTheme: rawResolved,
    setTheme: nextSetTheme,
  } = useNextTheme();

  const mounted = useMounted();

  const setTheme = useCallback(
    (t: Theme) => nextSetTheme(t),
    [nextSetTheme],
  );

  const toggleTheme = useCallback(() => {
    // Use the resolved theme so "system" preference is respected.
    const current = rawResolved ?? "dark";
    nextSetTheme(current === "dark" ? "light" : "dark");
  }, [rawResolved, nextSetTheme]);

  const resolvedTheme = mounted
    ? (rawResolved as "light" | "dark" | undefined)
    : undefined;

  const theme = mounted ? (rawTheme as Theme | undefined) : undefined;

  const isDark = resolvedTheme === "dark";

  const value = useMemo<ThemeContextValue>(
    () => ({ resolvedTheme, theme, toggleTheme, setTheme, mounted, isDark }),
    [resolvedTheme, theme, toggleTheme, setTheme, mounted, isDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useThemeContext
 *
 * Returns the typed theme state and helpers. Must be called inside a component
 * that is a descendant of <ThemeContextProvider>.
 *
 * @example
 *   const { isDark, toggleTheme } = useThemeContext();
 */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      "useThemeContext must be used inside <ThemeContextProvider>. " +
        "Make sure ThemeContextProvider is rendered inside the next-themes ThemeProvider.",
    );
  }
  return ctx;
}
