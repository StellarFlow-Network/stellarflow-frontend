"use client";

/**
 * GasFeePresets — Express gas fee tier selector.
 *
 * Renders three selectable tiers (Standard, Fast, Instant) with live fee
 * estimates and estimated block inclusion speed. Designed to sit inside a
 * transaction confirmation flow or a settings panel.
 *
 * Relies on `useGasFee` for the live base-fee data.
 */

import React, { useMemo } from "react";
import { useGasFee, type FeeTier, type GasFeeSnapshot } from "@/hooks/useGasFee";

// ─────────────────────────────────────────────────────────────────────────────
// Styling helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIER_ACCENT: Record<FeeTier, { ring: string; bg: string; badge: string; icon: string }> = {
  standard: {
    ring: "ring-green-500/50",
    bg: "bg-green-500/5",
    badge: "bg-green-500/20 text-green-400",
    icon: "🟢",
  },
  fast: {
    ring: "ring-yellow-500/50",
    bg: "bg-yellow-500/5",
    badge: "bg-yellow-500/20 text-yellow-400",
    icon: "⚡",
  },
  instant: {
    ring: "ring-red-500/50",
    bg: "bg-red-500/5",
    badge: "bg-red-500/20 text-red-400",
    icon: "🔥",
  },
};

const TIER_LABELS: Record<FeeTier, string> = {
  standard: "Standard",
  fast: "Fast",
  instant: "Instant",
};

const TIER_DESCRIPTIONS: Record<FeeTier, string> = {
  standard: "Cost-effective. Includes in 1–2 ledgers.",
  fast: "Priority inclusion. Next ledger guaranteed.",
  instant: "Maximum urgency. Immediate inclusion.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TierCard({
  tierKey,
  isSelected,
  onSelect,
  feeXLM,
  estimatedSpeed,
  multiplier,
}: {
  tierKey: FeeTier;
  isSelected: boolean;
  onSelect: () => void;
  feeXLM: string;
  estimatedSpeed: string;
  multiplier: number;
}) {
  const accent = TIER_ACCENT[tierKey];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all
        ${
          isSelected
            ? `border-blue-500/60 ring-2 ${accent.ring} ${accent.bg}`
            : "border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:bg-gray-900/50"
        }
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-400" />
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{accent.icon}</span>
        <span className="text-sm font-semibold text-gray-200">
          {TIER_LABELS[tierKey]}
        </span>
        {multiplier !== 1 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.badge}`}>
            {multiplier}×
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500">{TIER_DESCRIPTIONS[tierKey]}</p>

      {/* Fee */}
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-lg font-bold text-gray-100">
          {feeXLM}
        </span>
        <span className="text-xs text-gray-500">XLM</span>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1.5">
        <svg
          className="h-3 w-3 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-[11px] text-gray-500">{estimatedSpeed}</span>
      </div>
    </button>
  );
}

function SnapshotMeta({ snapshot }: { snapshot: GasFeeSnapshot }) {
  const timeSince = useMemo(() => {
    const secs = Math.floor((Date.now() - snapshot.fetchedAt) / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  }, [snapshot.fetchedAt]);

  return (
    <div className="flex items-center justify-between text-[11px] text-gray-600">
      <span>
        Base fee:{" "}
        <span className="font-mono text-gray-400">
          {snapshot.baseFeeXLM} XLM
        </span>{" "}
        ({snapshot.baseFeeStroops} stroops)
      </span>
      <span>
        Ledger #{snapshot.ledgerSequence.toLocaleString()} · {timeSince}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export interface GasFeePresetsProps {
  /** Optional CSS class for the outer wrapper. */
  className?: string;
  /** Callback when the user selects a tier. */
  onTierChange?: (tier: FeeTier, feeStroops: number) => void;
  /** Show compact variant (fewer details, smaller cards). */
  compact?: boolean;
}

export function GasFeePresets({
  className = "",
  onTierChange,
  compact = false,
}: GasFeePresetsProps) {
  const { snapshot, selectedTier, setSelectedTier, isLoading, error } =
    useGasFee();

  const handleSelect = (tier: FeeTier) => {
    setSelectedTier(tier);
    if (snapshot && onTierChange) {
      onTierChange(tier, snapshot.tiers[tier].feeStroops);
    }
  };

  // Loading state
  if (isLoading && !snapshot) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span>Loading network fee data…</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !snapshot) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
      >
        <p className="text-sm text-red-400">
          Unable to fetch fee data: {error}
        </p>
      </div>
    );
  }

  if (!snapshot) return null;

  const tiers = (["standard", "fast", "instant"] as FeeTier[]).map((key) => ({
    key,
    ...snapshot.tiers[key],
  }));

  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-300">Gas Fee Tier</h3>
        <span className="text-[11px] text-gray-600">
          Updated every 10 s
        </span>
      </div>

      {/* Tier cards */}
      <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
        {tiers.map((tier) => (
          <TierCard
            key={tier.key}
            tierKey={tier.key}
            isSelected={selectedTier === tier.key}
            onSelect={() => handleSelect(tier.key)}
            feeXLM={tier.feeXLM}
            estimatedSpeed={tier.estimatedSpeed}
            multiplier={tier.multiplier}
          />
        ))}
      </div>

      {/* Meta */}
      <div className="mt-3 border-t border-gray-800 pt-3">
        <SnapshotMeta snapshot={snapshot} />
      </div>
    </div>
  );
}

export default GasFeePresets;
