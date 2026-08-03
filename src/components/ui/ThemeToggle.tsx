"use client";

/**
 * ThemeToggle
 *
 * Accessible icon button that switches between dark and light mode.
 * Renders nothing during SSR to avoid hydration mismatches — the button
 * appears only after the client has resolved the active theme.
 *
 * Usage:
 *   import { ThemeToggle } from "@/components/ui/ThemeToggle";
 *   <ThemeToggle />
 */

import { useThemeContext } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  /** Icon size in pixels (default: 20) */
  size?: number;
}

export function ThemeToggle({ className = "", size = 20 }: ThemeToggleProps) {
  const { isDark, toggleTheme, mounted } = useThemeContext();

  // Don't render until the theme is resolved — prevents icon flash.
  if (!mounted) {
    return (
      <span
        aria-hidden
        style={{ display: "inline-block", width: size, height: size }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className={[
        "inline-flex items-center justify-center rounded-md",
        "p-1.5 transition-colors duration-150",
        "text-foreground/60 hover:text-foreground hover:bg-surface-raised",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isDark ? (
        // Sun icon — click to go light
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon — click to go dark
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
