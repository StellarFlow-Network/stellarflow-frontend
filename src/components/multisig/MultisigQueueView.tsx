"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  Key,
  Layers,
  PenTool,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { SignatureStatusCard, CoSigner, SignerStatus } from "./SignatureStatusCard";
import { triggerHaptic } from "@/lib/haptics";
import {
  DEMO_CO_SIGNER_PUBLIC_KEY,
  isEnvelopeAwaitingSigner,
  type MultisigQueueFilter,
} from "@/services/multisigNotifications";

export type { MultisigQueueFilter };

export interface MultisigTransaction {
  id: string;
  title: string;
  description: string;
  category: "treasury" | "operations" | "upgrade" | "emergency";
  amount?: string;
  asset?: string;
  destination?: string;
  createdAt: string;
  expiresAt?: string;
  threshold: number; // Required weight or number of signatures
  currentWeight: number; // Current accumulated weight
  coSigners: CoSigner[];
  xdr?: string;
  status: "pending_signatures" | "ready_to_execute" | "executed" | "rejected";
  executedAt?: string;
  txHash?: string;
}

export interface MultisigQueueViewProps {
  initialTransactions?: MultisigTransaction[];
  connectedUserPublicKey?: string | null;
  /** Initial queue filter, driven by `?filter=pending` deep links (#962). */
  initialFilter?: MultisigQueueFilter;
  /** Envelope to focus, driven by `?request=` deep links (#962). */
  highlightRequestId?: string | null;
  onExecuteTransaction?: (tx: MultisigTransaction) => Promise<void>;
  onSignTransaction?: (txId: string, signerPublicKey: string) => Promise<void>;
  onRevokeSignature?: (txId: string, signerPublicKey: string) => Promise<void>;
}

/**
 * Whether `viewerPublicKey` still has to sign before `tx` can execute.
 *
 * Drives the "Awaiting my signature" filter the co-signer badge deep links
 * into (#962); the rule itself lives in the notification service so it can be
 * unit tested without a DOM.
 */
function awaitsViewerSignature(
  tx: MultisigTransaction,
  viewerPublicKey: string,
): boolean {
  return isEnvelopeAwaitingSigner(tx, viewerPublicKey);
}

const MULTISIG_QUEUE_FILTERS: {
  value: MultisigQueueFilter;
  label: string;
}[] = [
  { value: "all", label: "All envelopes" },
  { value: "pending", label: "Awaiting my signature" },
];

const DEFAULT_MOCK_MULTISIG_TXS: MultisigTransaction[] = [
  {
    id: "TX-MSIG-2048",
    title: "Treasury Quarterly Liquidity Allocation",
    description: "Disburse 50,000 USDC from reserve multi-sig to StellarFlow AMM Pool #4 (USDC/XLM)",
    category: "treasury",
    amount: "50,000.00",
    asset: "USDC",
    destination: "GBUSDCPOOLRESERVE777XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX492",
    createdAt: "25 minutes ago",
    threshold: 3,
    currentWeight: 2,
    status: "pending_signatures",
    xdr: "AAAAAgAAAABg...",
    coSigners: [
      {
        publicKey: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
        name: "Elena (Lead Treasury)",
        role: "Primary Signer",
        weight: 1,
        status: "approved",
        signedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      },
      {
        publicKey: "GCIXQ7BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ94827104ABC",
        name: "Marcus (Security Officer)",
        role: "Risk Officer",
        weight: 1,
        status: "approved",
        signedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
      {
        publicKey: "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXDV90210",
        name: "Connected User / Co-signer",
        role: "Operations Key",
        weight: 1,
        status: "pending",
      },
    ],
  },
  {
    id: "TX-MSIG-7721",
    title: "Relayer Reserve Top-Up & Gas Subsidies",
    description: "Transfer 5,000 XLM to bridge relayers for sponsored transaction fee coverage",
    category: "operations",
    amount: "5,000.00",
    asset: "XLM",
    destination: "GARELAYERGASPOOL999XXXXXXXXXXXXXXXXXXXXXXXXXXXXX1028",
    createdAt: "1 hour ago",
    threshold: 3,
    currentWeight: 1,
    status: "pending_signatures",
    xdr: "AAAAAgAAAABy...",
    coSigners: [
      {
        publicKey: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
        name: "Elena (Lead Treasury)",
        role: "Primary Signer",
        weight: 1,
        status: "approved",
        signedAt: new Date(Date.now() - 50 * 60_000).toISOString(),
      },
      {
        publicKey: "GCIXQ7BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ94827104ABC",
        name: "Marcus (Security Officer)",
        role: "Risk Officer",
        weight: 1,
        status: "pending",
      },
      {
        publicKey: "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXDV90210",
        name: "Connected User / Co-signer",
        role: "Operations Key",
        weight: 1,
        status: "pending",
      },
    ],
  },
];

export function MultisigQueueView({
  initialTransactions = DEFAULT_MOCK_MULTISIG_TXS,
  connectedUserPublicKey = DEMO_CO_SIGNER_PUBLIC_KEY,
  initialFilter = "all",
  highlightRequestId = null,
  onExecuteTransaction,
  onSignTransaction,
  onRevokeSignature,
}: MultisigQueueViewProps) {
  // A visitor without a wallet extension still sees the demo envelopes this
  // queue ships with, so fall back to the demo co-signer key instead of
  // rendering an empty "awaiting you" filter.
  const viewerPublicKey = connectedUserPublicKey || DEMO_CO_SIGNER_PUBLIC_KEY;

  const [transactions, setTransactions] = useState<MultisigTransaction[]>(initialTransactions);
  const [filter, setFilter] = useState<MultisigQueueFilter>(initialFilter);
  const [selectedTxId, setSelectedTxId] = useState<string>(() => {
    const highlighted = highlightRequestId
      ? initialTransactions.find((t) => t.id === highlightRequestId)
      : undefined;
    if (highlighted) return highlighted.id;
    const firstVisible =
      initialFilter === "pending"
        ? initialTransactions.find((t) => awaitsViewerSignature(t, viewerPublicKey))
        : initialTransactions[0];
    return firstVisible?.id || "";
  });
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const appliedHighlightRef = useRef<string | null>(null);

  const awaitingCount = useMemo(
    () => transactions.filter((t) => awaitsViewerSignature(t, viewerPublicKey)).length,
    [transactions, viewerPublicKey]
  );

  const visibleTransactions = useMemo(
    () =>
      filter === "pending"
        ? transactions.filter((t) => awaitsViewerSignature(t, viewerPublicKey))
        : transactions,
    [transactions, filter, viewerPublicKey]
  );

  const selectedTx = useMemo(
    () =>
      visibleTransactions.find((t) => t.id === selectedTxId) ||
      visibleTransactions[0] ||
      null,
    [visibleTransactions, selectedTxId]
  );

  // Keep the detail pane pointing at something the current filter can show.
  useEffect(() => {
    if (visibleTransactions.length === 0) return;
    if (!visibleTransactions.some((t) => t.id === selectedTxId)) {
      setSelectedTxId(visibleTransactions[0].id);
    }
  }, [visibleTransactions, selectedTxId]);

  // Follow `?filter=` deep links pushed while this page is already mounted.
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  // Open the envelope a notification pointed at, even on an in-page navigation
  // where the component does not remount.
  useEffect(() => {
    if (!highlightRequestId || appliedHighlightRef.current === highlightRequestId) {
      return;
    }
    appliedHighlightRef.current = highlightRequestId;
    setSelectedTxId(highlightRequestId);
  }, [highlightRequestId]);

  // Recalculate weights and threshold status
  const calculateTotalApprovedWeight = (signers: CoSigner[]): number => {
    return signers.reduce((sum, s) => (s.status === "approved" ? sum + s.weight : sum), 0);
  };

  // Sign handler
  const handleApproveAndSign = useCallback(
    async (txId: string, signerKey: string) => {
      setIsActionBusy(true);
      setActionSuccessMessage(null);
      triggerHaptic("selection");

      try {
        if (onSignTransaction) {
          await onSignTransaction(txId, signerKey);
        } else {
          // Synthetic delay for realistic UX
          await new Promise((res) => setTimeout(res, 600));
        }

        setTransactions((prev) =>
          prev.map((t) => {
            if (t.id !== txId) return t;
            const nextSigners = t.coSigners.map((s) =>
              s.publicKey === signerKey || s.publicKey === viewerPublicKey
                ? {
                    ...s,
                    status: "approved" as SignerStatus,
                    signedAt: new Date().toISOString(),
                  }
                : s
            );
            const totalWeight = calculateTotalApprovedWeight(nextSigners);
            const isReady = totalWeight >= t.threshold;

            return {
              ...t,
              coSigners: nextSigners,
              currentWeight: totalWeight,
              status: isReady ? "ready_to_execute" : "pending_signatures",
            };
          })
        );

        triggerHaptic("txConfirm", true);
        setActionSuccessMessage("Signature appended and confirmed on queue!");
      } finally {
        setIsActionBusy(false);
      }
    },
    [viewerPublicKey, onSignTransaction]
  );

  // Revoke signature handler
  const handleRevokeSignature = useCallback(
    async (txId: string, signerKey: string) => {
      setIsActionBusy(true);
      setActionSuccessMessage(null);
      triggerHaptic("warning");

      try {
        if (onRevokeSignature) {
          await onRevokeSignature(txId, signerKey);
        } else {
          await new Promise((res) => setTimeout(res, 500));
        }

        setTransactions((prev) =>
          prev.map((t) => {
            if (t.id !== txId) return t;
            const nextSigners = t.coSigners.map((s) =>
              s.publicKey === signerKey || s.publicKey === viewerPublicKey
                ? {
                    ...s,
                    status: "revoked" as SignerStatus,
                    signedAt: undefined,
                  }
                : s
            );
            const totalWeight = calculateTotalApprovedWeight(nextSigners);

            return {
              ...t,
              coSigners: nextSigners,
              currentWeight: totalWeight,
              status: "pending_signatures",
            };
          })
        );

        setActionSuccessMessage("Approval signature revoked successfully.");
      } finally {
        setIsActionBusy(false);
      }
    },
    [viewerPublicKey, onRevokeSignature]
  );

  // Execute on-chain trigger
  const handleExecuteOnChain = useCallback(
    async (tx: MultisigTransaction) => {
      setIsActionBusy(true);
      setActionSuccessMessage(null);
      triggerHaptic("selection");

      try {
        if (onExecuteTransaction) {
          await onExecuteTransaction(tx);
        } else {
          await new Promise((res) => setTimeout(res, 800));
        }

        setTransactions((prev) =>
          prev.map((t) =>
            t.id === tx.id
              ? {
                  ...t,
                  status: "executed",
                  executedAt: new Date().toISOString(),
                  txHash: "9a4f2e1c7b8d0e5a6f3b2c1d4e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f",
                }
              : t
          )
        );

        triggerHaptic("txConfirm", true);
        setActionSuccessMessage(`Transaction ${tx.id} broadcast and finalized on Stellar ledger!`);
      } finally {
        setIsActionBusy(false);
      }
    },
    [onExecuteTransaction]
  );

  if (!selectedTx) {
    return (
      <div
        data-testid="multisig-queue-empty"
        className="rounded-2xl border border-white/10 bg-[#0d1a21] p-8 text-center text-slate-400"
      >
        <FileSignature size={32} className="mx-auto mb-2 text-slate-500" />
        <p>
          {filter === "pending"
            ? "Nothing is waiting on your signature right now."
            : "No multi-signature envelopes in queue."}
        </p>
        {filter === "pending" && transactions.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-4 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
          >
            Show all {transactions.length} envelopes
          </button>
        )}
      </div>
    );
  }

  const thresholdMet = selectedTx.currentWeight >= selectedTx.threshold;
  const progressPercent = Math.min(
    100,
    Math.round((selectedTx.currentWeight / selectedTx.threshold) * 100)
  );

  const currentUserSigner = selectedTx.coSigners.find(
    (s) => s.publicKey === viewerPublicKey
  );

  const userCanSign = currentUserSigner?.status === "pending" && !thresholdMet && selectedTx.status !== "executed";
  const userCanRevoke = currentUserSigner?.status === "approved" && selectedTx.status !== "executed";

  return (
    <div className="space-y-8">
      {/* Top Banner Alert on action */}
      {actionSuccessMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-center justify-between animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Grid: Left = Queue Items List, Right = Selected Envelope Tracker & Actions */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column (5 cols): Queue Envelopes */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <Layers size={16} className="text-[#f5c842]" />
              <span>Pending multisig payloads</span>
            </div>
            <span
              data-testid="multisig-queue-count"
              className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-slate-300"
            >
              {visibleTransactions.length} / {transactions.length} items
            </span>
          </div>

          {/*
            Queue filter — the `?filter=pending` deep link from the top-bar
            badge (#962) preselects "Awaiting my signature".
          */}
          <div
            role="group"
            aria-label="Filter multisig queue"
            className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0a151d] p-1"
          >
            {MULTISIG_QUEUE_FILTERS.map(({ value, label }) => {
              const isActive = filter === value;
              const count = value === "all" ? transactions.length : awaitingCount;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  data-testid={`multisig-filter-${value}`}
                  onClick={() => {
                    setFilter(value);
                    setActionSuccessMessage(null);
                    triggerHaptic("tap");
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-[#f5c842] text-[#071016]"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded px-1 font-mono text-[10px] ${
                      isActive ? "bg-[#071016]/15" : "bg-white/10"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {visibleTransactions.map((tx) => {
              const isSelected = tx.id === selectedTx.id;
              const isTxReady = tx.currentWeight >= tx.threshold;
              const isExecuted = tx.status === "executed";

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => {
                    setSelectedTxId(tx.id);
                    setActionSuccessMessage(null);
                    triggerHaptic("tap");
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-[#f5c842] bg-[#0d1a21] shadow-lg shadow-[#f5c842]/10"
                      : "border-white/10 bg-[#0a151d] hover:border-white/20 hover:bg-[#0d1a21]/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#f5c842]">
                          {tx.id}
                        </span>
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                          {tx.category}
                        </span>
                      </div>
                      <h3 className="mt-1 font-medium text-sm text-white line-clamp-1">
                        {tx.title}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      {isExecuted ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 size={11} /> Executed
                        </span>
                      ) : isTxReady ? (
                        <span className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 animate-pulse">
                          <Sparkles size={11} /> Ready
                        </span>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-slate-300">
                          {tx.currentWeight} / {tx.threshold}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
                    <span>Created {tx.createdAt}</span>
                    {tx.amount && (
                      <span className="font-mono text-white font-medium">
                        {tx.amount} {tx.asset}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 cols): Active Envelope Details, Threshold Progress & Co-Signer Tracker */}
        <div className="space-y-6 lg:col-span-7">
          {/* Active Envelope Card */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 sm:p-7 shadow-xl space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#f5c842] bg-[#f5c842]/10 border border-[#f5c842]/30 px-2.5 py-0.5 rounded">
                    {selectedTx.id}
                  </span>
                  <span className="text-xs text-slate-400">Created {selectedTx.createdAt}</span>
                </div>
                <h2 className="mt-2 text-xl font-bold text-white">{selectedTx.title}</h2>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {selectedTx.description}
                </p>
              </div>

              {selectedTx.amount && (
                <div className="rounded-xl border border-white/10 bg-[#071016] p-3 text-right shrink-0">
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Total Value
                  </span>
                  <p className="font-mono text-lg font-bold text-emerald-400">
                    {selectedTx.amount} {selectedTx.asset}
                  </p>
                </div>
              )}
            </div>

            {/* Signature Threshold Progress Meter */}
            <section className="space-y-3 rounded-xl border border-white/10 bg-[#071016] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-[#f5c842]" />
                  <h3 className="text-sm font-semibold text-white">
                    Signature Threshold Progress
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">
                    {selectedTx.currentWeight} of {selectedTx.threshold} Signatures Collected
                  </span>
                  <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-cyan-300 font-semibold">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar with markers */}
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    thresholdMet
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_12px_#34d399]"
                      : "bg-gradient-to-r from-[#f5c842] to-amber-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                {thresholdMet ? (
                  <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                    <CheckCircle2 size={14} /> Threshold Satisfied • Ready to Execute
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Clock size={14} className="animate-spin" /> Awaiting{" "}
                    {selectedTx.threshold - selectedTx.currentWeight} more signature(s)
                  </span>
                )}
                <span className="text-slate-400 text-[11px]">
                  Required Quorum: {selectedTx.threshold}
                </span>
              </div>
            </section>

            {/* Co-Signers Status List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold uppercase tracking-wider">
                  <Users size={15} className="text-cyan-400" />
                  <span>Authorized Co-Signers & Approvals</span>
                </div>
                <span className="text-xs text-slate-400">
                  {selectedTx.coSigners.filter((s) => s.status === "approved").length} of{" "}
                  {selectedTx.coSigners.length} Approved
                </span>
              </div>

              <div className="space-y-3">
                {selectedTx.coSigners.map((signer) => (
                  <SignatureStatusCard
                    key={signer.publicKey}
                    signer={signer}
                    isCurrentUser={Boolean(viewerPublicKey) && signer.publicKey === viewerPublicKey}
                    canSign={userCanSign}
                    canRevoke={userCanRevoke}
                    isSubmitting={isActionBusy}
                    onApprove={() => handleApproveAndSign(selectedTx.id, signer.publicKey)}
                    onRevoke={() => handleRevokeSignature(selectedTx.id, signer.publicKey)}
                  />
                ))}
              </div>
            </section>

            {/* Execution / Sign Actions Footer Bar */}
            <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                {selectedTx.status === "executed" ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={14} /> Finalized on Stellar ledger
                  </span>
                ) : thresholdMet ? (
                  <span className="text-cyan-300 font-medium flex items-center gap-1">
                    <Sparkles size={14} /> Quorum reached! Any co-signer can broadcast this envelope.
                  </span>
                ) : (
                  <span>Signatures are cryptographically appended to envelope XDR.</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {userCanSign && (
                  <button
                    type="button"
                    disabled={isActionBusy}
                    onClick={() =>
                      handleApproveAndSign(
                        selectedTx.id,
                        viewerPublicKey || selectedTx.coSigners[0].publicKey
                      )
                    }
                    className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-[#071016] transition hover:bg-emerald-400 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    <PenTool size={15} />
                    <span>{isActionBusy ? "Signing..." : "Approve & Sign Transaction"}</span>
                  </button>
                )}

                {userCanRevoke && (
                  <button
                    type="button"
                    disabled={isActionBusy}
                    onClick={() =>
                      handleRevokeSignature(
                        selectedTx.id,
                        viewerPublicKey || selectedTx.coSigners[0].publicKey
                      )
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    <span>Revoke Signature</span>
                  </button>
                )}

                {thresholdMet && selectedTx.status !== "executed" && (
                  <button
                    type="button"
                    disabled={isActionBusy}
                    onClick={() => handleExecuteOnChain(selectedTx)}
                    className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-2.5 text-xs font-bold text-[#071016] transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-cyan-500/30"
                  >
                    <Play size={15} />
                    <span>{isActionBusy ? "Broadcasting..." : "Broadcast & Execute On-Chain"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultisigQueueView;
