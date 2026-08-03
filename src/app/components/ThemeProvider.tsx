"use client";

/**
 * ThemeProvider
 *
 * Composes next-themes' <ThemeProvider> with our own <ThemeContextProvider>
 * so that every descendant can call useThemeContext() to read/toggle the theme.
 *
 * Flash prevention notes
 * ──────────────────────
 * • `suppressHydrationWarning` on <html> (in layout.tsx) silences the
 *   class-attribute mismatch between SSR and client hydration.
 * • The blocking inline <script> in layout.tsx reads localStorage /
 *   prefers-color-scheme and applies the correct class to <html> before
 *   any CSS or JS loads, eliminating the white-flash entirely.
 * • We do NOT gate rendering on `useMounted` here — doing so would prevent
 *   next-themes from writing the dark class before paint.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { ThemeContextProvider } from "@/context/ThemeContext";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeContextProvider>{children}</ThemeContextProvider>
    </NextThemesProvider>
  );
}
