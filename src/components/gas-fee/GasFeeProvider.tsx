"use client";

/**
 * GasFeeProvider — Global context for the express gas fee preset.
 *
 * Wraps the app so that any subtree can read the selected tier and live
 * fee snapshot without prop-drilling. The provider internally calls
 * `useGasFee` and exposes its state through a React context.
 *
 * Wire this into the layout above any component that needs fee data:
 *
 *   <GasFeeProvider>
 *     {children}
 *   </GasFeeProvider>
 */

import React, { createContext, useContext, useMemo } from "react";
import {
  useGasFee,
  type FeeTier,
  type FeeTierPreset,
  type GasFeeSnapshot,
} from "@/hooks/useGasFee";

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

export interface GasFeeContextValue {
  /** Latest gas fee snapshot (null before the first successful fetch). */
  snapshot: GasFeeSnapshot | null;
  /** Currently selected fee tier. */
  selectedTier: FeeTier;
  /** Update the selected fee tier. */
  setSelectedTier: (tier: FeeTier) => void;
  /** Whether the initial fetch is still in progress. */
  isLoading: boolean;
  /** Error message from the last failed poll, or null. */
  error: string | null;
  /** Force an immediate re-fetch outside of the poll interval. */
  refresh: () => void;
  /** Convenience: get the currently selected tier's preset data. */
  activePreset: FeeTierPreset | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const GasFeeContext = createContext<GasFeeContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function GasFeeProvider({ children }: { children: React.ReactNode }) {
  const {
    snapshot,
    selectedTier,
    setSelectedTier,
    isLoading,
    error,
    refresh,
  } = useGasFee();

  const activePreset = useMemo(
    () => (snapshot ? snapshot.tiers[selectedTier] : null),
    [snapshot, selectedTier],
  );

  const value = useMemo<GasFeeContextValue>(
    () => ({
      snapshot,
      selectedTier,
      setSelectedTier,
      isLoading,
      error,
      refresh,
      activePreset,
    }),
    [snapshot, selectedTier, setSelectedTier, isLoading, error, refresh, activePreset],
  );

  return (
    <GasFeeContext.Provider value={value}>{children}</GasFeeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useGasFeePreset — subscribe to the global gas fee context.
 *
 * Must be used inside a `<GasFeeProvider>`.
 */
export function useGasFeePreset(): GasFeeContextValue {
  const ctx = useContext(GasFeeContext);
  if (!ctx) {
    throw new Error("useGasFeePreset must be used within a GasFeeProvider");
  }
  return ctx;
}
