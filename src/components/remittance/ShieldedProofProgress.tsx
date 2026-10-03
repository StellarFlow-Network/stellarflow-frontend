"use client";

import { Check, Circle, LoaderCircle } from "lucide-react";

export type ShieldedProofStage = "generating-proof" | "verifying" | "submitting";
export type ShieldedProofStatus = "idle" | "running" | "complete" | "error";

const STAGES: { id: ShieldedProofStage; label: string }[] = [
  { id: "generating-proof", label: "Generating proof" },
  { id: "verifying", label: "Verifying" },
  { id: "submitting", label: "Submitting" },
];

interface ShieldedProofProgressProps {
  status: ShieldedProofStatus;
  currentStage: ShieldedProofStage;
  error?: string;
  className?: string;
}

export function ShieldedProofProgress({
  status,
  currentStage,
  error,
  className = "",
}: ShieldedProofProgressProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === currentStage);

  return (
    <div className={`space-y-3 ${className}`} aria-live="polite" role="status">
      <ol className="grid grid-cols-3 gap-2">
        {STAGES.map((stage, index) => {
          const isComplete = status === "complete" || (status === "running" && index < currentIndex);
          const isCurrent = status === "running" && stage.id === currentStage;
          return (
            <li
              key={stage.id}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs ${
                isCurrent
                  ? "border-lime-400/50 bg-lime-400/10 text-lime-200"
                  : isComplete
                    ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
                    : "border-white/10 bg-white/[0.02] text-white/45"
              }`}
            >
              {isCurrent ? (
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              ) : isComplete ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Circle size={15} aria-hidden="true" />
              )}
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>
      {status === "error" && error && (
        <p className="text-sm text-rose-300" role="alert">{error}</p>
      )}
      {status === "complete" && (
        <p className="text-sm text-emerald-300">Operation confirmed by the configured adapter.</p>
      )}
    </div>
  );
}