"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, ChevronDown, LoaderCircle, Maximize2, Minimize2, Share2, X } from "lucide-react";

import { CongestionFeeAlert } from "./CongestionFeeAlert";

export type TransactionStepStatus = "pending" | "processing" | "completed" | "failed";

export interface TransactionTimelineStep {
  id: string;
  label: string;
  status: TransactionStepStatus;
  description?: string;
  error?: string;
  rawXdr?: string;
  gasConsumed?: string | number;
}

export interface TransactionTimelineModalProps {
  transactionId: string;
  txHash?: string;
  steps: TransactionTimelineStep[];
  isOpen?: boolean;
  onClose?: () => void;
}

type TransactionStepUpdate = { transactionId: string } & Partial<TransactionTimelineStep>;

export default function TransactionTimelineModal({ transactionId, txHash, steps, isOpen = true, onClose }: TransactionTimelineModalProps) {
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [timelineSteps, setTimelineSteps] = useState(steps);

  useEffect(() => setTimelineSteps(steps), [steps]);

  useEffect(() => {
    const handleStepUpdate = (event: Event) => {
      const update = (event as CustomEvent<TransactionStepUpdate>).detail;
      if (!update || update.transactionId !== transactionId || !update.id) return;
      setTimelineSteps((current) => current.map((step) => step.id === update.id ? { ...step, ...update } : step));
    };
    window.addEventListener("stellarflow:transaction-step", handleStepUpdate);
    return () => window.removeEventListener("stellarflow:transaction-step", handleStepUpdate);
  }, [transactionId]);

  if (!isOpen) return null;
  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const shareTransaction = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("tx", txHash || transactionId);
    try {
      if (navigator.share) await navigator.share({ title: "Transaction status", url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); setShareMessage("Transaction link copied"); }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setShareMessage("Could not share transaction link");
    }
    window.setTimeout(() => setShareMessage(""), 2500);
  };

  if (minimized) return <aside className="fixed bottom-4 right-4 z-[60] flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white shadow-2xl" aria-label="Transaction running in background"><LoaderCircle className="animate-spin text-lime-400" size={18} /><span className="max-w-48 truncate text-sm">Transaction processing</span><button type="button" aria-label="Restore transaction timeline" onClick={() => setMinimized(false)} className="rounded p-1 text-slate-400 hover:text-white"><Maximize2 size={17} /></button><button type="button" aria-label="Close transaction timeline" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white"><X size={17} /></button></aside>;

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="transaction-timeline-title">
    <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-800 p-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-lime-400">Transaction execution</p><h2 id="transaction-timeline-title" className="mt-1 text-xl font-bold text-white">Transaction timeline</h2><p className="mt-1 max-w-sm truncate font-mono text-xs text-slate-500">{txHash || transactionId}</p></div><div className="flex gap-2"><button type="button" onClick={shareTransaction} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"><Share2 size={16} /><span className="hidden sm:inline">Share link</span></button><button type="button" aria-label="Minimize transaction timeline" onClick={() => setMinimized(true)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"><Minimize2 size={17} /></button><button type="button" aria-label="Close transaction timeline" onClick={onClose} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"><X size={17} /></button></div></header>
      <div className="overflow-y-auto p-5">
        <CongestionFeeAlert className="mb-4" />
        <ol className="space-y-1">{timelineSteps.map((step, index) => {
          const isExpanded = expanded.includes(step.id);
          const hasDetails = Boolean(step.rawXdr || step.gasConsumed !== undefined || step.description || step.error);
          const icon = step.status === "completed" ? <CheckCircle2 className="text-emerald-400" size={20} /> : step.status === "failed" ? <CircleAlert className="text-rose-400" size={20} /> : step.status === "processing" ? <LoaderCircle className="animate-spin text-sky-400" size={20} /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-xs text-slate-500">{index + 1}</span>;
          return <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0"><div className="relative flex flex-col items-center">{icon}{index < timelineSteps.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-800" />}</div><div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className={`font-semibold ${step.status === "failed" ? "text-rose-300" : "text-white"}`}>{step.label}</h3><p className={`mt-1 text-sm ${step.status === "failed" ? "text-rose-300" : "text-slate-400"}`}>{step.error || step.description || (step.status === "completed" ? "Completed" : step.status === "processing" ? "In progress…" : step.status === "failed" ? "Step failed" : "Waiting for previous step")}</p></div>{hasDetails && <button type="button" aria-expanded={isExpanded} onClick={() => toggleExpanded(step.id)} className="rounded p-1 text-slate-400 hover:text-white"><ChevronDown size={18} className={isExpanded ? "rotate-180" : ""} /></button>}</div>{isExpanded && hasDetails && <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">{step.gasConsumed !== undefined && <p className="text-xs text-slate-400">Gas consumed: <span className="font-mono text-slate-200">{step.gasConsumed}</span></p>}{step.rawXdr && <div><p className="mb-1 text-xs font-medium text-slate-400">Raw XDR</p><pre className="max-h-32 overflow-auto break-all rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300">{step.rawXdr}</pre></div>}</div>}</div></li>;
        })}</ol>
        {shareMessage && <p role="status" className="mt-4 text-sm text-lime-300">{shareMessage}</p>}
      </div>
    </section>
  </div>;
}

export function publishTransactionStepUpdate(update: TransactionStepUpdate) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stellarflow:transaction-step", { detail: update }));
}
