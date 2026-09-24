"use client";

/**
 * NetworkSelector.tsx
 *
 * Navigation-level toggle that lets users switch the active Horizon / Soroban
 * RPC target between Testnet and Mainnet.
 *
 * Visual behaviour
 * ────────────────
 * • A pill-shaped toggle renders two labelled segments: "Testnet" and "Mainnet".
 * • The active segment is highlighted; switching is instant for the label /
 *   colour while SDK client re-instantiation happens in the background.
 * • A subtle spinner appears on the active segment while `isSwitching` is true.
 * • An error label (red dot + message) is displayed below when instantiation
 *   fails, giving the user feedback without breaking the layout.
 * • The Mainnet segment carries a visual caution cue (amber dot) to remind
 *   users they are operating on real funds.
 *
 * Accessibility
 * ─────────────
 * The toggle is rendered as a `<div role="radiogroup">` with two
 * `<button role="radio" aria-checked>` children so screen readers announce
 * the currently selected network and allow keyboard navigation (Tab + Enter/Space).
 */

import React, { useCallback, useId } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  useNetwork,
  useNetworkActions,
  useNetworkStatus,
  type NetworkTarget,
} from "@/app/components/providers/NetworkProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface SegmentProps {
  target: NetworkTarget;
  label: string;
  isActive: boolean;
  isLoading: boolean;
  /** Show amber caution dot (Mainnet only) */
  showCaution: boolean;
  onClick: (target: NetworkTarget) => void;
  groupId: string;
}

const NetworkSegment = React.memo(function NetworkSegment({
  target,
  label,
  isActive,
  isLoading,
  showCaution,
  onClick,
  groupId,
}: SegmentProps) {
  const handleClick = useCallback(() => {
    if (!isActive) onClick(target);
  }, [isActive, onClick, target]);

  return (
    <button
      role="radio"
      aria-checked={isActive}
      aria-controls={groupId}
      type="button"
      onClick={handleClick}
      disabled={isActive && isLoading}
      className={[
        "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
        isActive
          ? target === "mainnet"
            ? "bg-amber-500/15 text-amber-300 shadow-sm"
            : "bg-blue-500/15 text-blue-300 shadow-sm"
          : "text-gray-500 hover:text-gray-300 hover:bg-white/5",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Caution dot for Mainnet */}
      {showCaution && isActive && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"
          aria-hidden="true"
        />
      )}

      {/* Label */}
      <span>{label}</span>

      {/* Spinner — shown while clients are being re-instantiated */}
      {isActive && isLoading && (
        <span
          className="ml-0.5 h-3 w-3 shrink-0 rounded-full border border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}

      {/* Static indicator dot when active and not loading */}
      {isActive && !isLoading && (
        <span
          className={[
            "ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
            target === "mainnet" ? "bg-amber-400" : "bg-blue-400",
          ].join(" ")}
          aria-hidden="true"
        />
      )}
    </button>
  );
});

NetworkSegment.displayName = "NetworkSegment";

// ─────────────────────────────────────────────────────────────────────────────
// NetworkSelector
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkSelectorProps {
  /** Additional CSS class names applied to the outermost wrapper */
  className?: string;
}

/**
 * NetworkSelector
 *
 * Drop-in navigation widget for toggling between Testnet and Mainnet.
 * Must be rendered inside a `<NetworkProvider>`.
 *
 * @example
 * ```tsx
 * // In the nav bar:
 * <NetworkSelector />
 *
 * // Full-width with custom margin:
 * <NetworkSelector className="mt-2 w-full" />
 * ```
 */
export const NetworkSelector = React.memo(function NetworkSelector({
  className = "",
}: NetworkSelectorProps) {
  const { network } = useNetwork();
  const { isSwitching, error } = useNetworkStatus();
  const { switchNetwork } = useNetworkActions();

  const groupId = useId();

  const handleSwitch = useCallback(
    (target: NetworkTarget) => {
      void switchNetwork(target);
    },
    [switchNetwork],
  );

  return (
    <div
      className={`flex flex-col items-start gap-1 ${className}`}
      style={{ contain: "layout style" }}
    >
      {/* ── Toggle pill ─────────────────────────────────────────────────── */}
      <div
        id={groupId}
        role="radiogroup"
        aria-label="Network target"
        className={[
          "inline-flex items-center gap-0.5 rounded-lg border p-0.5",
          "border-gray-800 bg-[#0d1117]",
        ].join(" ")}
      >
        <NetworkSegment
          target="testnet"
          label="Testnet"
          isActive={network === "testnet"}
          isLoading={isSwitching && network === "testnet"}
          showCaution={false}
          onClick={handleSwitch}
          groupId={groupId}
        />
        <NetworkSegment
          target="mainnet"
          label="Mainnet"
          isActive={network === "mainnet"}
          isLoading={isSwitching && network === "mainnet"}
          showCaution
          onClick={handleSwitch}
          groupId={groupId}
        />
      </div>

      {/* ── Error feedback ──────────────────────────────────────────────── */}
      {error && (
        <p
          className="flex items-center gap-1 text-[10px] text-red-400"
          role="alert"
          aria-live="polite"
        >
          <Icon
            id={ICON_IDS.alertTriangle}
            size={10}
            className="text-red-400 shrink-0"
            aria-hidden
          />
          <span className="truncate max-w-[200px]" title={error}>
            {error}
          </span>
        </p>
      )}
    </div>
  );
});

NetworkSelector.displayName = "NetworkSelector";

export default NetworkSelector;
