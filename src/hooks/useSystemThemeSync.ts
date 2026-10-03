"use client";

/**
 * useSystemThemeSync
 *
 * Listens to operating system color scheme changes via matchMedia and syncs
 * with the next-themes system preference. When the user's theme is set to
 * "system", this hook ensures OS theme changes are reflected immediately
 * without requiring a page reload.
 *
 * Also injects smooth transition styles for theme changes to prevent
 * visual flashing.
 */

import { useEffect, useRef } from "react";
import { useThemeContext } from "@/context/ThemeContext";

const TRANSITION_STYLE_ID = "theme-transition-styles";

const TRANSITION_CSS = `
  *, *::before, *::after {
    transition-property: background-color, border-color, color, fill, stroke;
    transition-duration: 200ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Disable transitions on elements that animate for other purposes */
  [class*="animate-"],
  [class*="status-"],
  [class*="expandable-"],
  [class*="wallet-btn"],
  .no-theme-transition {
    transition: none !important;
  }
`;

export function useSystemThemeSync(): void {
  const { theme, mounted } = useThemeContext();
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (!mounted) return;

    const styleId = TRANSITION_STYLE_ID;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = TRANSITION_CSS;
      document.head.appendChild(styleEl);
    }

    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQueryRef.current = mediaQuery;

    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("stellarflow-theme");
      const isSystem = !stored || stored === "system";

      if (isSystem) {
        const root = document.documentElement;
        root.classList.toggle("dark", e.matches);
        root.classList.toggle("light", !e.matches);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    if ((!theme || theme === "system") && mediaQuery.matches) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }, [theme, mounted]);
}
