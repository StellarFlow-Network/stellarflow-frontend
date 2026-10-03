"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Clipboard, Download, LoaderCircle, X } from "lucide-react";
import {
  createShieldedRemittanceNote,
  type ShieldedRemittanceNote,
} from "@/lib/shieldedRemittanceNote";
import {
  ShieldedProofProgress,
  type ShieldedProofStage,
  type ShieldedProofStatus,
} from "./ShieldedProofProgress";

export interface ShieldedDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit?: (
    credentials: ShieldedRemittanceNote,
    reportStage: (stage: ShieldedProofStage) => void,
  ) => Promise<void>;
}

export function ShieldedDepositModal({ isOpen, onClose, onDeposit }: ShieldedDepositModalProps) {
  const [amount, setAmount] = useState("");
  const [credentials, setCredentials] = useState<ShieldedRemittanceNote | null>(null);
  const [status, setStatus] = useState<ShieldedProofStatus>("idle");
  const [currentStage, setCurrentStage] = useState<ShieldedProofStage>("generating-proof");
  const [error, setError] = useState("");
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    if (status === "running") return;
    setAmount("");
    setCredentials(null);
    setStatus("idle");
    setCurrentStage("generating-proof");
    setError("");
    setCopied(false);
    onClose();
  };

  const handleGenerateNote = async () => {
    setError("");
    setCredentials(null);
    setCopied(false);
    setStatus("idle");
    setCurrentStage("generating-proof");
    setIsGeneratingNote(true);
    try {
      setCredentials(await createShieldedRemittanceNote(amount));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a recovery note.");
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const handleDeposit = async () => {
    if (!credentials || !onDeposit) return;
    setError("");
    setCurrentStage("generating-proof");
    setStatus("running");
    try {
      await onDeposit(credentials, setCurrentStage);
      setStatus("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Shielded deposit failed.");
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    if (!credentials) return;
    const accepted = window.confirm(
      "This note contains the secret needed to redeem the funds. Anyone who gets it may be able to spend them. Store and share it only with the intended recipient. Copy anyway?",
    );
    if (!accepted) return;

    try {
      await navigator.clipboard.writeText(credentials.note);
      setCopied(true);
    } catch {
      setError("Clipboard access was denied. Use the download backup instead.");
    }
  };

  const handleDownload = () => {
    if (!credentials) return;
    const content = JSON.stringify(
      {
        schema: "stellarflow-shielded-remittance-note/v1",
        network: "stellar",
        ...credentials,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stellarflow-note-${credentials.commitment.slice(0, 12)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <motion.button
            type="button"
            aria-label="Close deposit dialog"
            className="absolute inset-0 cursor-default"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shielded-deposit-title"
            className="relative z-[1] max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#101713] p-5 text-white shadow-2xl sm:rounded-2xl sm:p-7"
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.99 }}
            transition={{ duration: 0.2 }}
          >
            <header className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">Private note</p>
                <h2 id="shielded-deposit-title" className="mt-1 text-xl font-semibold">Create a shielded deposit note</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={status === "running"}
                aria-label="Close deposit dialog"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </header>

            <div className="mb-5 flex gap-3 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] p-3 text-sm text-amber-100/90">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <p>This creates a locally verifiable recovery note only. No ZK prover or shielded pool contract is connected, so no funds will be deposited.</p>
            </div>

            <label htmlFor="shielded-deposit-amount" className="mb-2 block text-sm font-medium text-white/80">
              Deposit amount <span className="text-white/45">(XLM)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="shielded-deposit-amount"
                type="number"
                min="0.0000001"
                step="0.0000001"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                disabled={isGeneratingNote || status === "running"}
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 text-base text-white outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/15 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleGenerateNote}
                disabled={isGeneratingNote || status === "running"}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isGeneratingNote ? <LoaderCircle size={17} className="animate-spin" /> : null}
                Create note
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-rose-300" role="alert">{error}</p>}

            {credentials && (
              <div className="mt-5 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Recovery note created</span>
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                    Local only · not shielded
                  </span>
                </div>
                <code className="block max-h-24 overflow-auto break-all rounded-md bg-black/35 p-3 text-xs leading-relaxed text-lime-100">
                  {credentials.note}
                </code>
                <p className="text-xs leading-relaxed text-white/55">
                  Keep this note private. The downloadable JSON includes the recovery secret and can authorize redemption when a shielded pool is connected.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
                  >
                    {copied ? <Check size={16} /> : <Clipboard size={16} />}
                    {copied ? "Copied" : "Copy commitment note"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/5"
                  >
                    <Download size={16} />
                    Download .json
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={!onDeposit || status === "running" || status === "complete"}
                  className="flex min-h-12 w-full items-center justify-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white/70 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  title={!onDeposit ? "Shielded prover and contract are not configured" : undefined}
                >
                  {onDeposit ? "Shield XLM" : "Shielded deposit unavailable"}
                </button>
                {status !== "idle" && (
                  <ShieldedProofProgress
                    status={status}
                    currentStage={currentStage}
                    error={status === "error" ? error : undefined}
                  />
                )}
              </div>
            )}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}