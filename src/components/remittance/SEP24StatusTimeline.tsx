"use client";

import { CheckCircle2, Circle, Clock3, Loader2, OctagonAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalToast } from "@/components/ui/ToastQueue";

export type SEP24TransactionStatus = "pending_user_transfer_start" | "pending_anchor" | "completed" | "no_market" | string;
export interface SEP24Transaction { id?: string; status: SEP24TransactionStatus; status_eta?: number; more_info_url?: string; [key: string]: unknown }
export interface SEP24StatusTimelineProps { transactionId: string; statusUrl?: string; pollInterval?: number; onStatusChange?: (transaction: SEP24Transaction) => void; }

const steps = [
  { status: "pending_user_transfer_start", title: "Send funds to the anchor", description: "Start the transfer using the payment instructions provided by the anchor." },
  { status: "pending_anchor", title: "Anchor is processing", description: "The anchor has your transfer and is completing the fiat conversion or payout." },
  { status: "completed", title: "Transfer completed", description: "Your recipient's payout is complete. Your receipt is ready." },
];

export function statusDescription(status: SEP24TransactionStatus) {
  if (status === "no_market") return "This corridor is temporarily unavailable because the anchor cannot quote the requested market.";
  return steps.find((step) => step.status === status)?.description ?? "The anchor is updating this transfer's status.";
}

/** Polls a SEP-24 transaction endpoint while a transfer is active and stops on its terminal status. */
export function SEP24StatusTimeline({ transactionId, statusUrl, pollInterval = 5000, onStatusChange }: SEP24StatusTimelineProps) {
  const [transaction, setTransaction] = useState<SEP24Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completedNotified = useRef(false);
  const toast = useOptionalToast();
  const endpoint = statusUrl ?? `/api/sep24/transaction?id=${encodeURIComponent(transactionId)}`;

  const poll = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Status request failed (${response.status})`);
      const next = (await response.json()) as SEP24Transaction;
      setTransaction(next); setError(null); onStatusChange?.(next);
      if (next.status === "completed" && !completedNotified.current) {
        completedNotified.current = true;
        toast?.addToast({ title: "Remittance completed", description: "Your SEP-24 transfer has been completed successfully.", status: "confirmed" });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update transfer status."); }
  }, [endpoint, onStatusChange, toast]);

  useEffect(() => {
    completedNotified.current = false; setTransaction(null); setError(null); void poll();
  }, [transactionId, poll]);
  useEffect(() => {
    if (transaction?.status === "completed" || transaction?.status === "no_market") return;
    const interval = window.setInterval(() => void poll(), pollInterval);
    return () => window.clearInterval(interval);
  }, [poll, pollInterval, transaction?.status]);

  const activeIndex = transaction?.status === "completed" ? 2 : transaction?.status === "pending_anchor" ? 1 : 0;
  const unavailable = transaction?.status === "no_market";
  return <section aria-live="polite" className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Transfer progress</h2><p className="mt-1 text-xs text-neutral-400">Updated every {pollInterval / 1000} seconds while processing.</p></div>{transaction?.status === "completed" ? <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Completed</span> : <Loader2 className="animate-spin text-blue-300" size={20} />}</div>
    <ol className="mt-5 space-y-4">{steps.map((step, index) => { const complete = activeIndex > index || transaction?.status === "completed"; const active = activeIndex === index && !complete; return <li key={step.status} className="flex gap-3"><div className="pt-0.5">{complete ? <CheckCircle2 className="text-emerald-400" size={20} /> : active ? <Clock3 className="text-blue-300" size={20} /> : <Circle className="text-neutral-700" size={20} />}</div><div><p className={complete ? "font-medium text-emerald-200" : active ? "font-medium text-white" : "text-neutral-500"}>{step.title}</p><p className="mt-1 text-xs leading-5 text-neutral-400">{step.description}</p></div></li>; })}</ol>
    {unavailable && <p className="mt-4 flex gap-2 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200"><OctagonAlert size={18} className="shrink-0" />{statusDescription("no_market")}</p>}
    {error && <p className="mt-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error} We&apos;ll keep trying while this transfer is active.</p>}
    {transaction?.more_info_url && <a className="mt-4 inline-block text-sm text-blue-300 hover:underline" href={transaction.more_info_url} target="_blank" rel="noreferrer">View anchor receipt</a>}
  </section>;
}
export default SEP24StatusTimeline;
