"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, LoaderCircle, X } from "lucide-react";
import {
  createSEP24InteractiveUrl,
  getConfiguredSEP24AnchorOrigins,
  parseSEP24AnchorMessage,
  validateSEP24InteractiveUrl,
  type SEP24Operation,
} from "@/lib/sep24Interactive";

type ModalStatus = "idle" | "loading-url" | "ready" | "failed";

export interface SEP24InteractiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: string;
  assetCode?: string;
  initialOperation?: SEP24Operation;
  allowedAnchorOrigins?: readonly string[];
  onComplete?: (transactionId?: string) => void | Promise<void>;
  onFailure?: (message: string) => void;
  onRefresh?: () => void | Promise<void>;
}

const GUIDE_STEPS = [
  {
    title: "Review the transfer",
    description: "Choose a deposit or withdrawal and confirm the asset and amount before opening the anchor page.",
  },
  {
    title: "Complete the anchor form",
    description: "The trusted anchor may request identity or payment details. Check its domain before entering sensitive information.",
  },
  {
    title: "Return for confirmation",
    description: "The anchor reports completion or failure through a verified cross-origin message. You can also close this window at any time.",
  },
];

function validAmount(value: string): boolean {
  return /^\d+(?:\.\d{1,7})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0;
}

export function SEP24InteractiveModal({
  isOpen,
  onClose,
  account,
  assetCode = "XLM",
  initialOperation = "deposit",
  allowedAnchorOrigins = getConfiguredSEP24AnchorOrigins(),
  onComplete,
  onFailure,
  onRefresh,
}: SEP24InteractiveModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [operation, setOperation] = useState<SEP24Operation>(initialOperation);
  const [amount, setAmount] = useState("");
  const [interactiveUrl, setInteractiveUrl] = useState("");
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [error, setError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const clearFlow = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setInteractiveUrl("");
    setStatus("idle");
    setError("");
    setIsGuideOpen(false);
    setAmount("");
    setOperation(initialOperation);
  }, [initialOperation]);

  useEffect(() => {
    if (!isOpen) {
      requestRef.current?.abort();
      requestRef.current = null;
    }
    return () => requestRef.current?.abort();
  }, [isOpen]);

  const handleClose = () => {
    clearFlow();
    onClose();
  };

  const handleStart = async () => {
    setError("");
    setInteractiveUrl("");
    if (!account) {
      setError("Connect a Stellar wallet before starting an anchor flow.");
      return;
    }
    if (!validAmount(amount)) {
      setError("Enter an amount greater than zero with up to 7 decimal places.");
      return;
    }
    if (allowedAnchorOrigins.length === 0) {
      setError("No trusted SEP-24 anchor origins are configured. Contact support before proceeding.");
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading-url");

    try {
      const returnedUrl = await createSEP24InteractiveUrl(
        { operation, assetCode, amount, account },
        controller.signal,
      );
      const trustedUrl = validateSEP24InteractiveUrl(returnedUrl, allowedAnchorOrigins);
      if (controller.signal.aborted) return;
      setInteractiveUrl(trustedUrl);
      setStatus("ready");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not start the SEP-24 flow.");
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (!isOpen || !interactiveUrl || status !== "ready") return;

    let trustedOrigin: string;
    try {
      trustedOrigin = new URL(validateSEP24InteractiveUrl(interactiveUrl, allowedAnchorOrigins)).origin;
    } catch {
      setInteractiveUrl("");
      setStatus("failed");
      setError("The interactive URL failed the trusted-origin check.");
      return;
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== trustedOrigin || event.source !== iframeRef.current?.contentWindow) return;
      const message = parseSEP24AnchorMessage(event.data);
      if (!message) return;

      if (message.type === "sep24:completed") {
        clearFlow();
        onClose();
        void Promise.allSettled([
          Promise.resolve().then(() => onComplete?.(message.transactionId)),
          Promise.resolve().then(() => onRefresh?.()),
        ]);
        return;
      }

      const failureMessage = message.message?.trim() || "The anchor could not complete this transfer.";
      setInteractiveUrl("");
      setStatus("failed");
      setError(failureMessage);
      onFailure?.(failureMessage);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [allowedAnchorOrigins, clearFlow, interactiveUrl, isOpen, onClose, onComplete, onFailure, onRefresh, status]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close SEP-24 transfer dialog"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sep24-modal-title"
        className="relative z-[1] flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#101713] text-white shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.18 }}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">Stellar anchor</p>
            <h2 id="sep24-modal-title" className="mt-1 text-lg font-semibold">SEP-24 interactive transfer</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm text-white/70 hover:bg-white/5 hover:text-white"
            >
              <CircleHelp size={17} /> Guide
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close SEP-24 transfer dialog"
              className="flex h-12 w-12 items-center justify-center rounded-lg text-white/70 hover:bg-white/5 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {!interactiveUrl ? (
            <div className="mx-auto max-w-xl space-y-5">
              <p className="text-sm leading-relaxed text-white/60">
                Complete a deposit or withdrawal through a Stellar anchor. The anchor page is embedded only after its HTTPS origin matches the configured trust list.
              </p>

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1" role="group" aria-label="Transfer operation">
                {(["deposit", "withdrawal"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={operation === value}
                    onClick={() => setOperation(value)}
                    disabled={status === "loading-url"}
                    className={`min-h-12 rounded-md px-3 text-sm font-semibold capitalize transition-colors ${operation === value ? "bg-lime-300 text-neutral-950" : "text-white/60 hover:text-white"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-white/75">
                  <span>Asset</span>
                  <input value={assetCode} readOnly className="min-h-12 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-white/65" />
                </label>
                <label className="space-y-2 text-sm font-medium text-white/75">
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0.0000001"
                    step="0.0000001"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    disabled={status === "loading-url"}
                    className="min-h-12 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-white outline-none focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/15 disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100/85">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
                <p>Only enter sensitive information on the anchor domain shown by the browser. StellarFlow will not ask you to share your wallet secret key.</p>
              </div>

              {!account && (
                <p role="alert" className="text-sm text-amber-200">Connect a Stellar wallet before starting an anchor flow.</p>
              )}
              {allowedAnchorOrigins.length === 0 && (
                <p role="alert" className="text-sm text-amber-200">No trusted anchor origins are configured. Set `NEXT_PUBLIC_SEP24_ANCHOR_ORIGINS` to an explicit comma-separated HTTPS origin allowlist.</p>
              )}

              {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={status === "loading-url" || !account || allowedAnchorOrigins.length === 0}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-lime-200 disabled:cursor-wait disabled:opacity-70"
              >
                {status === "loading-url" && <LoaderCircle size={17} className="animate-spin" />}
                {status === "loading-url" ? "Connecting to anchor…" : `Start ${operation}`}
              </button>
            </div>
          ) : (
            <div className="flex h-[min(68dvh,620px)] min-h-[340px] flex-col overflow-hidden rounded-lg border border-white/10 bg-white">
              <div className="flex min-h-11 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-600">
                <span className="truncate">Trusted anchor: {new URL(interactiveUrl).host}</span>
                <button
                  type="button"
                  onClick={() => {
                    setInteractiveUrl("");
                    setStatus("idle");
                  }}
                  className="ml-3 inline-flex min-h-9 shrink-0 items-center gap-1 rounded px-2 font-medium hover:bg-neutral-200"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
              <iframe
                ref={iframeRef}
                key={interactiveUrl}
                src={interactiveUrl}
                title="Trusted SEP-24 anchor transfer"
                sandbox="allow-scripts allow-forms allow-same-origin"
                referrerPolicy="no-referrer"
                className="h-full w-full flex-1 border-0"
              />
            </div>
          )}
        </div>

        {status === "loading-url" && (
          <div className="absolute inset-x-0 bottom-0 top-[73px] z-[2] flex items-center justify-center bg-[#101713]/95 p-6" role="status" aria-live="polite">
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium text-white/80">
                <LoaderCircle size={18} className="animate-spin text-lime-300" /> Requesting a secure anchor session
              </div>
              <div className="h-3 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
              <div className="h-40 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
            </div>
          </div>
        )}

        <AnimatePresence>
          {isGuideOpen && (
            <motion.div
              className="absolute inset-0 z-[3] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <section role="dialog" aria-modal="true" aria-labelledby="sep24-guide-title" className="w-full max-w-lg rounded-xl border border-white/10 bg-[#151e19] p-5 shadow-2xl sm:p-6">
                <header className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">Quick guide</p>
                    <h3 id="sep24-guide-title" className="mt-1 text-lg font-semibold">Your anchor transfer</h3>
                  </div>
                  <button type="button" onClick={() => setIsGuideOpen(false)} aria-label="Close guide" className="flex h-12 w-12 items-center justify-center rounded-lg text-white/65 hover:bg-white/5 hover:text-white">
                    <X size={19} />
                  </button>
                </header>
                <ol className="space-y-4">
                  {GUIDE_STEPS.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-lime-300/30 bg-lime-300/10 text-xs font-semibold text-lime-200">{index + 1}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-white/90">{step.title}</h4>
                        <p className="mt-1 text-sm leading-relaxed text-white/55">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={() => setIsGuideOpen(false)} className="mt-6 min-h-12 w-full rounded-lg bg-lime-300 px-4 text-sm font-semibold text-neutral-950 hover:bg-lime-200">Got it</button>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}