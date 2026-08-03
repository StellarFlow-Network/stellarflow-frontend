"use client";

import React, { useMemo } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  REMITTANCE_STEPS,
  RemittanceStatus,
  RemittanceStep,
  isStepActive,
  isStepCompleted,
  stepIndex,
  stellarExpertTxUrl,
} from "@/hooks/useRemittanceStatus";

// ---------------------------------------------------------------------------
// Step display metadata
// ---------------------------------------------------------------------------

interface StepDisplayMeta {
  label: string;
  description: string;
  iconId: (typeof ICON_IDS)[keyof typeof ICON_IDS];
}

const STEP_DISPLAY: Record<RemittanceStep, StepDisplayMeta> = {
  deposited: {
    label: "Deposited",
    description: "Funds received and confirmed on-chain.",
    iconId: ICON_IDS.wallet,
  },
  swap_completed: {
    label: "Swap Completed",
    description: "XLM ↔ local currency swap executed.",
    iconId: ICON_IDS.zap,
  },
  anchor_processing: {
    label: "Anchor Processing",
    description: "Licensed anchor validating the off-ramp request.",
    iconId: ICON_IDS.shield,
  },
  offramp_dispatched: {
    label: "Off-Ramp Dispatched",
    description: "Payment instruction sent to local payout rail.",
    iconId: ICON_IDS.upload,
  },
  delivered: {
    label: "Delivered",
    description: "Funds landed in the recipient's account.",
    iconId: ICON_IDS.checkCircle,
  },
};

// ---------------------------------------------------------------------------
// Sub-component: individual step node
// ---------------------------------------------------------------------------

interface StepNodeProps {
  step: RemittanceStep;
  completed: boolean;
  active: boolean;
  failed: boolean;
  txHash?: string;
  completedAt?: string;
  network?: "mainnet" | "testnet";
  isLast: boolean;
}

const StepNode = React.memo(function StepNode({
  step,
  completed,
  active,
  failed,
  txHash,
  completedAt,
  network = "mainnet",
  isLast,
}: StepNodeProps) {
  const meta = STEP_DISPLAY[step];

  // Circle state styles
  const circleBase =
    "relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500";

  const circleClass = failed
    ? `${circleBase} border-red-500 bg-red-950/40`
    : completed
      ? `${circleBase} border-emerald-500 bg-emerald-950/50 shadow-[0_0_10px_2px_rgba(52,211,153,0.25)]`
      : active
        ? `${circleBase} border-blue-400 bg-blue-950/50 shadow-[0_0_12px_3px_rgba(96,165,250,0.3)] ring-2 ring-blue-500/20 ring-offset-2 ring-offset-[#0d1117]`
        : `${circleBase} border-gray-700 bg-gray-900`;

  const iconColor = failed
    ? "text-red-400"
    : completed
      ? "text-emerald-400"
      : active
        ? "text-blue-400"
        : "text-gray-600";

  const labelColor = failed
    ? "text-red-300"
    : completed
      ? "text-emerald-300"
      : active
        ? "text-blue-300 font-semibold"
        : "text-gray-500";

  const descColor = failed
    ? "text-red-400/70"
    : completed
      ? "text-gray-400"
      : active
        ? "text-gray-300"
        : "text-gray-600";

  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <li className="relative flex gap-4">
      {/* Vertical connector line — hidden for the last item */}
      {!isLast && (
        <div
          aria-hidden
          className={`absolute left-[19px] top-10 h-full w-0.5 transition-colors duration-500 ${
            completed ? "bg-emerald-700/60" : "bg-gray-800"
          }`}
        />
      )}

      {/* Step icon node */}
      <div className={circleClass} aria-hidden>
        {completed ? (
          <Icon
            id={ICON_IDS.check}
            size={18}
            className={iconColor}
            strokeWidth={2.5}
          />
        ) : failed ? (
          <Icon
            id={ICON_IDS.alertTriangle}
            size={18}
            className={iconColor}
          />
        ) : active ? (
          /* Pulsing ring for the active step */
          <>
            <Icon id={meta.iconId} size={18} className={iconColor} />
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-30 bg-blue-400"
              aria-hidden
            />
          </>
        ) : (
          <Icon id={meta.iconId} size={18} className={iconColor} />
        )}
      </div>

      {/* Step text content */}
      <div className="min-w-0 flex-1 pb-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`text-sm transition-colors duration-300 ${labelColor}`}>
            {meta.label}
          </span>

          {active && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-950/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden />
              In Progress
            </span>
          )}

          {completed && (
            <span className="rounded-full border border-emerald-800/40 bg-emerald-950/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-600">
              Done
            </span>
          )}
        </div>

        <p className={`mt-0.5 text-xs leading-relaxed ${descColor}`}>
          {meta.description}
        </p>

        {/* Completion timestamp */}
        {formattedDate && (
          <p className="mt-1 text-[11px] font-mono text-gray-600">
            <Icon
              id={ICON_IDS.clock}
              size={11}
              className="mr-1 inline-block align-middle text-gray-700"
            />
            {formattedDate}
          </p>
        )}

        {/* Stellar Expert block explorer link */}
        {txHash && (
          <a
            href={stellarExpertTxUrl(txHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-mono text-blue-500 hover:text-blue-400 underline-offset-2 hover:underline transition-colors"
            aria-label={`View transaction ${txHash.slice(0, 8)}… on Stellar Expert`}
          >
            <Icon id={ICON_IDS.externalLink} size={11} className="flex-shrink-0" />
            {txHash.slice(0, 8)}…{txHash.slice(-8)}
          </a>
        )}
      </div>
    </li>
  );
});

// ---------------------------------------------------------------------------
// Progress bar sub-component
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  currentStep: RemittanceStep | null;
  failed: boolean;
}

const ProgressBar = React.memo(function ProgressBar({
  currentStep,
  failed,
}: ProgressBarProps) {
  const totalSteps = REMITTANCE_STEPS.length;
  const idx = stepIndex(currentStep);
  // Progress completes fully at the last step.
  const pct = failed
    ? 100
    : idx < 0
      ? 0
      : Math.round(((idx + 1) / totalSteps) * 100);

  const barColor = failed
    ? "bg-gradient-to-r from-red-700 to-red-500"
    : pct === 100
      ? "bg-gradient-to-r from-emerald-700 to-emerald-400"
      : "bg-gradient-to-r from-blue-700 to-blue-400";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Progress
        </span>
        <span
          className={`text-xs font-mono font-semibold tabular-nums ${
            failed
              ? "text-red-400"
              : pct === 100
                ? "text-emerald-400"
                : "text-blue-400"
          }`}
          aria-live="polite"
          aria-atomic
        >
          {pct}%
        </span>
      </div>

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Remittance progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step count label */}
      <p className="mt-1.5 text-[11px] text-gray-600 font-mono">
        Step{" "}
        {idx < 0 ? "—" : `${idx + 1} / ${totalSteps}`}
        {currentStep && (
          <> · {STEP_DISPLAY[currentStep].label}</>
        )}
      </p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Connection indicator sub-component
// ---------------------------------------------------------------------------

interface ConnectionBadgeProps {
  isConnected: boolean;
  isPolling: boolean;
}

const ConnectionBadge = React.memo(function ConnectionBadge({
  isConnected,
  isPolling,
}: ConnectionBadgeProps) {
  if (!isConnected && !isPolling) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isConnected
          ? "border-emerald-800/40 bg-emerald-950/20 text-emerald-500"
          : "border-gray-700/60 bg-gray-900/40 text-gray-500"
      }`}
      aria-label={isConnected ? "Live via WebSocket" : "Polling for updates"}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
        }`}
        aria-hidden
      />
      {isConnected ? "Live" : "Polling"}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main StatusStepper component
// ---------------------------------------------------------------------------

export interface StatusStepperProps {
  /** Live status object from `useRemittanceStatus`. */
  status: RemittanceStatus | null;
  /** Whether the WebSocket channel is currently open. */
  isConnected?: boolean;
  /** Whether the hook is currently HTTP-polling. */
  isPolling?: boolean;
  /** Error string from the hook, if any. */
  error?: string | null;
  /** Callback for the retry / refetch button. */
  onRefetch?: () => void;
  /** "mainnet" or "testnet" — controls the Stellar Expert URL. Default: mainnet. */
  network?: "mainnet" | "testnet";
  /** Additional class names for the outer container. */
  className?: string;
}

/**
 * `StatusStepper` — a vertical progress stepper that visualises a remittance
 * transaction moving through five states:
 *
 *   Deposited → Swap Completed → Anchor Processing → Off-Ramp Dispatched → Delivered
 *
 * Features:
 * - Animated progress bar showing the percentage of steps completed
 * - Per-step icons, labels, and descriptions
 * - Pulsing active-step indicator
 * - Inline timestamps for completed steps
 * - Direct links to Stellar Expert block explorer for verified on-chain steps
 * - Live / Polling connection badge
 * - Error and loading states
 * - Fully accessible (ARIA roles, live regions, keyboard-reachable links)
 */
export const StatusStepper = React.memo(function StatusStepper({
  status,
  isConnected = false,
  isPolling = false,
  error = null,
  onRefetch,
  network = "mainnet",
  className = "",
}: StatusStepperProps) {
  const { currentStep, phase, stepMeta } = status ?? {
    currentStep: null,
    phase: "idle" as const,
    stepMeta: {},
  };

  const isFailed = phase === "failed";
  const isDelivered = currentStep === "delivered" && phase === "completed";

  // Build a stable list of step props for rendering — avoids per-render object churn.
  const steps = useMemo(
    () =>
      REMITTANCE_STEPS.map((step, i) => ({
        step,
        completed: isStepCompleted(step, currentStep),
        active: isStepActive(step, currentStep),
        failed: isFailed && isStepActive(step, currentStep),
        txHash: stepMeta[step]?.txHash,
        completedAt: stepMeta[step]?.completedAt,
        isLast: i === REMITTANCE_STEPS.length - 1,
      })),
    [currentStep, isFailed, stepMeta],
  );

  return (
    <section
      aria-label="Remittance progress tracker"
      className={`w-full rounded-2xl border border-gray-800 bg-[#0d1117] p-5 shadow-xl ${className}`}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-200">
            <Icon id={ICON_IDS.activity} size={15} className="text-blue-400" />
            Transfer Status
          </h2>
          {status?.txId && (
            <p className="mt-0.5 font-mono text-[11px] text-gray-600">
              ID: {status.txId.slice(0, 10)}…{status.txId.slice(-10)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ConnectionBadge isConnected={isConnected} isPolling={isPolling} />

          {onRefetch && !isDelivered && (
            <button
              type="button"
              onClick={onRefetch}
              aria-label="Refresh transfer status"
              className="rounded-lg border border-gray-700 p-1.5 text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-gray-200"
            >
              <Icon id={ICON_IDS.refresh} size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {phase !== "idle" && (
        <ProgressBar currentStep={currentStep} failed={isFailed} />
      )}

      {/* Loading skeleton */}
      {(phase === "loading" || phase === "idle") && !error && (
        <div className="space-y-5" aria-busy aria-label="Loading transfer status">
          {REMITTANCE_STEPS.map((step) => (
            <div key={step} className="flex gap-4">
              <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-gray-800" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-24 animate-pulse rounded bg-gray-800" />
                <div className="h-2.5 w-40 animate-pulse rounded bg-gray-800/60" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-300"
        >
          <Icon
            id={ICON_IDS.alertTriangle}
            size={15}
            className="mt-0.5 flex-shrink-0 text-red-400"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Unable to load status</p>
            <p className="mt-0.5 text-xs text-red-400/80">{error}</p>
          </div>
          {onRefetch && (
            <button
              type="button"
              onClick={onRefetch}
              className="flex-shrink-0 rounded border border-red-700/40 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Step list */}
      {phase !== "idle" && phase !== "loading" && (
        <ol
          aria-label="Remittance steps"
          className="space-y-0"
        >
          {steps.map(({ step, completed, active, failed, txHash, completedAt, isLast }) => (
            <StepNode
              key={step}
              step={step}
              completed={completed}
              active={active}
              failed={failed}
              txHash={txHash}
              completedAt={completedAt}
              network={network}
              isLast={isLast}
            />
          ))}
        </ol>
      )}

      {/* Delivered celebration banner */}
      {isDelivered && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3"
        >
          <Icon
            id={ICON_IDS.checkCircle}
            size={20}
            className="flex-shrink-0 text-emerald-400"
          />
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              Transfer Delivered
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Funds have arrived in the recipient&apos;s account.
            </p>
          </div>
        </div>
      )}

      {/* Failed banner */}
      {isFailed && status?.errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-700/40 bg-red-950/20 px-4 py-3"
        >
          <Icon
            id={ICON_IDS.alertTriangle}
            size={18}
            className="flex-shrink-0 mt-0.5 text-red-400"
          />
          <div>
            <p className="text-sm font-semibold text-red-300">Transfer Failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{status.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Estimated delivery */}
      {status?.estimatedDeliveryMs && !isDelivered && !isFailed && (
        <div className="mt-5 flex items-center gap-1.5 border-t border-gray-800/60 pt-3 text-xs text-gray-600">
          <Icon id={ICON_IDS.clock} size={12} className="text-gray-700" />
          Estimated delivery:{" "}
          <span className="font-mono text-gray-500">
            {new Date(status.estimatedDeliveryMs).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </section>
  );
});

StatusStepper.displayName = "StatusStepper";
export default StatusStepper;
