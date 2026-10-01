"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Flame, RefreshCw, Zap, X } from "lucide-react";
import { useSorobanNetworkHealth } from "@/hooks/useSorobanNetworkHealth";

export interface CongestionFeeAlertProps {
  /** Optional custom title override */
  title?: string;
  /** Optional custom message override */
  message?: string;
  /** Compact variant for tighter modal header spaces */
  compact?: boolean;
  /** Allow closing/dismissing the alert in current session */
  dismissable?: boolean;
  /** Optional custom CSS class */
  className?: string;
  /** Force show regardless of network state (useful for previews) */
  forceShow?: boolean;
}

export function CongestionFeeAlert({
  title = "High Network Congestion Detected",
  message,
  compact = false,
  dismissable = true,
  className = "",
  forceShow = false,
}: CongestionFeeAlertProps) {
  const { metrics, isSimulatingHighCongestion, toggleSimulateHighCongestion } =
    useSorobanNetworkHealth();

  const [dismissed, setDismissed] = useState(false);
  const [highCongestionState, setHighCongestionState] = useState(
    metrics.isHighCongestion || forceShow
  );

  useEffect(() => {
    setHighCongestionState(metrics.isHighCongestion || forceShow);
  }, [metrics.isHighCongestion, forceShow]);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.isHighCongestion === "boolean") {
        setHighCongestionState(detail.isHighCongestion);
        if (detail.isHighCongestion) {
          setDismissed(false); // Reset dismissal on new high congestion alert
        }
      }
    };

    window.addEventListener("stellarflow:network-health-update", handleUpdate);
    return () => {
      window.removeEventListener("stellarflow:network-health-update", handleUpdate);
    };
  }, []);

  if (!highCongestionState || dismissed) return null;

  const defaultMessage = `Network transaction traffic is currently elevated (~${metrics.currentFeeStroops} stroops base fee). Inclusion may take longer unless a higher priority fee is attached.`;

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-200 shadow-lg ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Flame className="h-4 w-4 shrink-0 text-rose-400 animate-pulse" />
          <span className="truncate font-medium">
            <strong className="font-bold text-rose-300">High Congestion:</strong> inclusion fees elevated (~{metrics.currentFeeStroops} stroops)
          </span>
        </div>
        {dismissable && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss alert"
            className="rounded p-1 text-rose-400 hover:bg-rose-900/50 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-slate-900 p-4 shadow-xl ${className}`}
      role="alert"
    >
      <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-rose-500/10 blur-xl pointer-events-none" />

      <div className="flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/20 text-rose-400">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <span>{title}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Fee Alert 🚨
              </span>
            </h4>
            {dismissable && (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss alert"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            {message || defaultMessage}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rose-900/40 pt-2.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-mono text-rose-300">
              <Zap size={13} className="text-amber-400" />
              Est. Confirmation: <strong className="text-white">{metrics.estimatedSpeedText}</strong>
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="font-mono text-slate-300">
              Current Fee: <strong className="text-rose-300">{metrics.currentFeeStroops} stroops</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CongestionFeeAlert;
