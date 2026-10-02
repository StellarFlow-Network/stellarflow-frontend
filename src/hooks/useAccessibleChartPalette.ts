"use client";

import { useMemo } from "react";
import { useAccessibilityContext } from "@/context/AccessibilityContext";
import { HIGH_CONTRAST_FOREGROUND, getChartSeries } from "@/lib/contrast";

export interface AccessibleChartPalette {
  /** Categorical series colours, tuned to the active contrast mode. */
  series: readonly string[];
  /** True when the boosted (WCAG AAA) theme is active. */
  highContrast: boolean;
  /** Grid-line colour that stays visible without competing with the data. */
  gridColor: string;
  /** Axis tick label colour. */
  axisLabelColor: string;
  /** Border colour drawn between adjacent slices/segments. */
  sliceBorderColor: string;
}

/**
 * Resolves a chart palette from the shared accessibility preference. Chart
 * components should read their colours from this hook (through CSS tokens where
 * possible) instead of hard-coding hex values, so the high-contrast toggle
 * recolours every chart without per-component branching.
 */
export function useAccessibleChartPalette(): AccessibleChartPalette {
  const { highContrast } = useAccessibilityContext();

  return useMemo(
    () => ({
      series: getChartSeries(highContrast),
      highContrast,
      gridColor: highContrast ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.06)",
      axisLabelColor: highContrast ? HIGH_CONTRAST_FOREGROUND : "rgba(255, 255, 255, 0.45)",
      sliceBorderColor: highContrast ? HIGH_CONTRAST_FOREGROUND : "#161b22",
    }),
    [highContrast],
  );
}
