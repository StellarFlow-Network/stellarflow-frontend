"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, FileUp, LoaderCircle, ShieldAlert } from "lucide-react";
import {
  validateShieldedRemittanceNote,
  type ShieldedRemittanceNote,
  type ShieldedNoteValidation,
} from "@/lib/shieldedRemittanceNote";
import {
  ShieldedProofProgress,
  type ShieldedProofStage,
  type ShieldedProofStatus,
} from "./ShieldedProofProgress";

type NoteValidationState =
  | { status: "empty" }
  | { status: "checking" }
  | { status: "invalid"; error: string }
  | { status: "valid"; credentials: ShieldedRemittanceNote };

export interface RedeemNoteFormProps {
  onRedeem?: (
    credentials: ShieldedRemittanceNote,
    reportStage: (stage: ShieldedProofStage) => void,
  ) => Promise<void>;
}

function validationToState(result: ShieldedNoteValidation): NoteValidationState {
  return result.valid
    ? { status: "valid", credentials: result.credentials }
    : { status: "invalid", error: result.error };
}

export function RedeemNoteForm({ onRedeem }: RedeemNoteFormProps) {
  const [note, setNote] = useState("");
  const [validation, setValidation] = useState<NoteValidationState>({ status: "empty" });
  const [status, setStatus] = useState<ShieldedProofStatus>("idle");
  const [currentStage, setCurrentStage] = useState<ShieldedProofStage>("generating-proof");
  const [operationError, setOperationError] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!note.trim()) {
      setValidation({ status: "empty" });
      return;
    }

    let isCurrent = true;
    setValidation({ status: "checking" });
    void validateShieldedRemittanceNote(note).then((result) => {
      if (isCurrent) setValidation(validationToState(result));
    });

    return () => {
      isCurrent = false;
    };
  }, [note]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setFileError("");
    if (!file) return;

    try {
      const backup: unknown = JSON.parse(await file.text());
      if (
        typeof backup !== "object" ||
        backup === null ||
        !("note" in backup) ||
        typeof backup.note !== "string"
      ) {
        throw new Error("This file does not contain a StellarFlow recovery note.");
      }
      setNote(backup.note);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "Could not read this backup file.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onRedeem || !note.trim()) return;

    setOperationError("");
    const result = await validateShieldedRemittanceNote(note);
    setValidation(validationToState(result));
    if (!result.valid) return;

    setCurrentStage("generating-proof");
    setStatus("running");
    try {
      await onRedeem(result.credentials, setCurrentStage);
      setStatus("complete");
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : "Redemption failed.");
      setStatus("error");
    }
  };

  const isBusy = status === "running";
  const isValid = validation.status === "valid";

  return (
    <section className="rounded-xl border border-white/10 bg-[#101713] p-5 text-white sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Redeem privately</p>
          <h3 className="mt-1 text-lg font-semibold">Use a recovery note</h3>
        </div>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-200">
          Note check only
        </span>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="shielded-redeem-note" className="block text-sm font-medium text-white/75">
          Commitment note
        </label>
        <textarea
          id="shielded-redeem-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setStatus("idle");
            setOperationError("");
          }}
          rows={4}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Paste your sfzk1 recovery note"
          disabled={isBusy}
          className="min-h-28 w-full resize-y rounded-lg border border-white/15 bg-black/25 p-3 font-mono text-xs leading-relaxed text-white outline-none focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/15 disabled:opacity-60"
        />

        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
          <div aria-live="polite" className="flex min-h-8 items-center gap-2 text-sm">
            {validation.status === "checking" && (
              <><LoaderCircle size={15} className="animate-spin text-cyan-200" /><span className="text-white/60">Checking note…</span></>
            )}
            {validation.status === "valid" && (
              <><CheckCircle2 size={16} className="text-emerald-300" /><span className="text-emerald-200">Note checksum valid · {validation.credentials.amount} XLM</span></>
            )}
            {validation.status === "invalid" && (
              <><ShieldAlert size={16} className="text-rose-300" /><span className="text-rose-200">{validation.error}</span></>
            )}
            {validation.status === "empty" && <span className="text-xs text-white/45">The note is checked automatically as you enter it.</span>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import recovery note JSON"
            className="sr-only"
            onChange={handleFile}
            disabled={isBusy}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            <FileUp size={16} /> Import backup
          </button>
        </div>
        {fileError && <p role="alert" className="text-sm text-rose-300">{fileError}</p>}

        <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-relaxed text-amber-100/80">
          A valid checksum confirms the note has not changed; it does not prove that funds exist or enable redemption. A shielded pool contract and proof service are not configured.
        </div>

        <button
          type="submit"
          disabled={!onRedeem || !isValid || validation.status === "checking" || isBusy || status === "complete"}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45"
          title={!onRedeem ? "Shielded prover and contract are not configured" : undefined}
        >
          {isBusy ? <LoaderCircle size={17} className="animate-spin" /> : null}
          {onRedeem ? "Redeem note" : "Redemption unavailable"}
        </button>
      </form>

      {status !== "idle" && (
        <ShieldedProofProgress
          status={status}
          currentStage={currentStage}
          error={status === "error" ? operationError : undefined}
          className="mt-4"
        />
      )}
    </section>
  );
}