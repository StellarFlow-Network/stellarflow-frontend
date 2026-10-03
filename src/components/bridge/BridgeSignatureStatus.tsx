"use client";

import React from "react";
import { AlertTriangle, Check, Clock3, ShieldCheck } from "lucide-react";
import type { BridgeValidatorApproval } from "@/types/bridge";

export interface BridgeSignatureStatusProps {
  gatheredSignatures: number;
  requiredSignatures: number;
  validators: BridgeValidatorApproval[];
}

export function BridgeSignatureStatus({
  gatheredSignatures,
  requiredSignatures,
  validators,
}: BridgeSignatureStatusProps) {
  const progress = Math.min(
    100,
    (gatheredSignatures / Math.max(requiredSignatures, 1)) * 100,
  );
  const timedOutValidators = validators.filter(
    (validator) => validator.status === "timed_out",
  );
  const thresholdMet = gatheredSignatures >= requiredSignatures;

  return (
    <section
      aria-label="Validator signature progress"
      className="mt-4 rounded-lg border border-gray-800 bg-[#0d1117] p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-300">
          <ShieldCheck size={14} className="text-blue-400" />
          Validator signatures
        </div>
        <span className="font-mono text-sm text-gray-200">
          {gatheredSignatures} / {requiredSignatures}
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={requiredSignatures}
        aria-valuenow={Math.min(gatheredSignatures, requiredSignatures)}
        aria-label={`${gatheredSignatures} of ${requiredSignatures} validator signatures`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            thresholdMet ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {validators.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {validators.map((validator) => {
            const timedOut = validator.status === "timed_out";
            const approved = validator.status === "approved";
            return (
              <span
                key={validator.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                  timedOut
                    ? "border-rose-500/40 bg-rose-950/20 text-rose-300"
                    : approved
                      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                      : "border-gray-700 text-gray-500"
                }`}
              >
                {timedOut ? (
                  <AlertTriangle size={11} />
                ) : approved ? (
                  <Check size={11} />
                ) : (
                  <Clock3 size={11} />
                )}
                {validator.name}
              </span>
            );
          })}
        </div>
      )}

      {timedOutValidators.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-300" role="alert">
          <AlertTriangle size={13} />
          {timedOutValidators.length === 1
            ? `${timedOutValidators[0].name} timed out while attesting.`
            : `${timedOutValidators.length} bridge validators timed out while attesting.`}
        </p>
      )}
    </section>
  );
}

export default React.memo(BridgeSignatureStatus);
