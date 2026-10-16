"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { assessFrontRunningRisk } from "./frontRunningRisk";

export interface FrontRunningRiskPopoverProps {
  orderSizeUsd: number;
  marketDepthUsd: number;
  currentSlippagePercent?: number;
  onApplyRecommendedSlippage?: (percent: number) => void;
  className?: string;
}

const riskStyles = {
  low: { label: "Low", color: "text-emerald-300", fill: "bg-emerald-400", width: "25%" },
  medium: { label: "Medium", color: "text-amber-300", fill: "bg-amber-400", width: "60%" },
  severe: { label: "Severe", color: "text-rose-300", fill: "bg-rose-400", width: "100%" },
} as const;

export function FrontRunningRiskPopover({
  orderSizeUsd,
  marketDepthUsd,
  currentSlippagePercent = 0.5,
  onApplyRecommendedSlippage,
  className = "",
}: FrontRunningRiskPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const assessment = assessFrontRunningRisk(orderSizeUsd, marketDepthUsd);
  const visual = riskStyles[assessment.risk];
  const needsTighterSlippage = currentSlippagePercent > assessment.recommendedSlippagePercent;
  const orderSizeLabel = Number.isFinite(orderSizeUsd)
    ? `$${Math.max(0, orderSizeUsd).toLocaleString()}`
    : "Unavailable";
  const marketDepthLabel = Number.isFinite(marketDepthUsd)
    ? `$${Math.max(0, marketDepthUsd).toLocaleString()}`
    : "Unavailable";

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-2 border border-white/15 bg-[#101820] px-3 text-sm text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        <ShieldAlert className={`h-4 w-4 ${visual.color}`} aria-hidden="true" />
        Trade risk <span className={`font-semibold ${visual.color}`}>{visual.label}</span>
      </button>
      {open && (
        <section
          id={popoverId}
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[min(21rem,calc(100vw-2rem))] border border-white/15 bg-[#101820] p-4 text-white shadow-xl"
          aria-label="Front-running risk assessment"
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Execution risk</h2>
              <p className={`mt-1 text-xs font-semibold ${visual.color}`}>{visual.label} estimated exposure</p>
            </div>
            <span className="font-mono text-xs text-slate-300">{assessment.depthSharePercent.toFixed(2)}% depth</span>
          </header>
          <div className="mt-3 h-2 bg-slate-700" role="meter" aria-label="Order size relative to visible market depth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={assessment.depthSharePercent} aria-valuetext={`${assessment.depthSharePercent.toFixed(2)}% of visible depth`}>
            <div className={`h-full ${visual.fill}`} style={{ width: visual.width }} />
          </div>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Order size</dt><dd className="font-mono">{orderSizeLabel}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Visible depth</dt><dd className="font-mono">{marketDepthLabel}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Suggested slippage cap</dt><dd className="font-mono">{assessment.recommendedSlippagePercent.toFixed(1)}%</dd></div>
          </dl>
          <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-300">{assessment.recommendation}</p>
          {needsTighterSlippage && <p className="mt-2 text-xs text-amber-200">Your current {currentSlippagePercent.toFixed(2)}% tolerance is above the suggested cap.</p>}
          {onApplyRecommendedSlippage && (
            <button
              type="button"
              className="mt-3 min-h-9 w-full border border-cyan-300/40 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10"
              onClick={() => {
                onApplyRecommendedSlippage(assessment.recommendedSlippagePercent);
                setOpen(false);
              }}
            >
              Apply {assessment.recommendedSlippagePercent.toFixed(1)}% slippage cap
            </button>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Estimate uses order size versus supplied visible depth; it is not a guarantee against MEV or execution loss.</p>
        </section>
      )}
    </div>
  );
}

export default FrontRunningRiskPopover;