"use client";

import { Accessibility } from "lucide-react";
import { useAccessibilityContext } from "@/context/AccessibilityContext";
import {
  HIGH_CONTRAST_BACKGROUND,
  HIGH_CONTRAST_FOREGROUND,
  contrastRatio,
} from "@/lib/contrast";

/**
 * Guaranteed text contrast ratio of the boosted theme, derived from the same
 * palette the stylesheet uses so the copy can never overpromise.
 */
const AAA_RATIO = contrastRatio(HIGH_CONTRAST_FOREGROUND, HIGH_CONTRAST_BACKGROUND).toFixed(1);

/**
 * "High Contrast Mode" row for the accessibility settings menu. Reuses the
 * shared <AccessibilityProvider> preference, so toggling here also updates the
 * top-nav switch and the `<html data-contrast>` attribute instantly.
 */
export function HighContrastToggle() {
  const { highContrast, toggleHighContrast } = useAccessibilityContext();

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-raised/40 p-3">
      <div className="flex items-start gap-2.5">
        <Accessibility size={18} className="mt-0.5 shrink-0 text-foreground/70" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">High Contrast Mode</p>
          <p className="mt-0.5 text-xs text-foreground/60">
            WCAG AAA colours ({AAA_RATIO}:1 text contrast) with thick focus outlines.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={highContrast}
        aria-label="High contrast mode"
        title="High contrast mode (WCAG AAA)"
        data-testid="high-contrast-switch"
        onClick={toggleHighContrast}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none ${
          highContrast ? "border-foreground bg-contrast-focus" : "border-border bg-control"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full transition-transform ${
            highContrast ? "translate-x-5 bg-black" : "translate-x-1 bg-foreground/60"
          }`}
        />
      </button>
    </div>
  );
}
