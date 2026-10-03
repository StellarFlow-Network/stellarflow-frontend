"use client";

import React from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { BRIDGE_UNLOCK_STAGES, type BridgeUnlockStage } from "@/types/bridge";

const STAGE_LABELS: Record<BridgeUnlockStage, string> = {
  claim_submitted: "Claim Submitted",
  validator_attestation: "Validator Attestation",
  origin_unlock: "Origin Chain Unlock",
  funds_returned: "Funds Returned",
};

export interface BridgeUnlockStepperProps {
  /** Highest stage the refund has reached; null when not yet triggered */
  currentStage: BridgeUnlockStage | null;
  /** Whether `currentStage` itself has finished (vs. still in flight) */
  stageCompleted: boolean;
}

/**
 * Compact horizontal progress stepper showing unlock status across the
 * origin chain as a bridge refund claim moves from submission through to
 * the funds landing back in the sender's account.
 */
export function BridgeUnlockStepper({
  currentStage,
  stageCompleted,
}: BridgeUnlockStepperProps) {
  const currentIndex = currentStage
    ? BRIDGE_UNLOCK_STAGES.indexOf(currentStage)
    : -1;

  return (
    <ol
      aria-label="Origin chain unlock progress"
      className="flex items-center gap-1.5"
    >
      {BRIDGE_UNLOCK_STAGES.map((stage, i) => {
        const isCompleted = i < currentIndex || (i === currentIndex && stageCompleted);
        const isActive = i === currentIndex && !stageCompleted;

        return (
          <li key={stage} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "border-emerald-500 bg-emerald-950/50 text-emerald-400"
                    : isActive
                      ? "border-blue-400 bg-blue-950/50 text-blue-400"
                      : "border-gray-700 bg-gray-900 text-gray-600"
                }`}
                aria-hidden
              >
                {isCompleted ? (
                  <Icon id={ICON_IDS.check} size={12} strokeWidth={2.5} />
                ) : isActive ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={`max-w-[5.5rem] text-center text-[10px] leading-tight ${
                  isCompleted
                    ? "text-emerald-400"
                    : isActive
                      ? "font-semibold text-blue-300"
                      : "text-gray-600"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>

            {i < BRIDGE_UNLOCK_STAGES.length - 1 && (
              <div
                aria-hidden
                className={`mb-4 h-0.5 flex-1 rounded ${
                  i < currentIndex ? "bg-emerald-700/60" : "bg-gray-800"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default BridgeUnlockStepper;
