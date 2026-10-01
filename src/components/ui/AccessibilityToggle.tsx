"use client";

import { Accessibility } from "lucide-react";
import { useAccessibilityContext } from "@/context/AccessibilityContext";

/**
 * Compact switch that toggles the WCAG AAA high-contrast theme. It lives in the
 * top navigation next to the theme toggle, so the preference is one tap away on
 * every page view.
 */
export function AccessibilityToggle() {
  const { highContrast, toggleHighContrast } = useAccessibilityContext();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={highContrast}
      aria-label="High contrast mode"
      title="High contrast mode (WCAG AAA)"
      onClick={toggleHighContrast}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-control px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-control-hover focus-visible:outline-none"
    >
      <Accessibility size={18} aria-hidden="true" />
      <span className="hidden lg:inline">High contrast</span>
      <span
        aria-hidden="true"
        className={`relative h-4 w-7 shrink-0 rounded-full border transition-colors ${
          highContrast
            ? "border-foreground bg-contrast-focus text-black"
            : "border-border bg-surface-raised text-foreground/60"
        }`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-current transition-transform ${
            highContrast ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
