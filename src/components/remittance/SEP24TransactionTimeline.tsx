"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  Globe,
  Loader2,
  OctagonAlert,
  RefreshCw,
  Search,
  ShieldCheck,
  Building2,
  Receipt,
  ChevronRight,
} from "lucide-react";
import type {
  AnchorPartnerInfo,
  SEP24HistoricalTransaction,
  SEP24OperationKind,
  SEP24OverallStatus,
  SEP24TransactionTimelineProps,
} from "@/types/sep24Timeline";

// ─────────────────────────────────────────────────────────────────────────────
// Default Anchor Partners & Historical Fixtures
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_ANCHORS: Record<string, AnchorPartnerInfo> = {
  cowrie: {
    name: "Cowrie Integrated Systems",
    domain: "cowrie.exchange",
    code: "cowrie",
    region: "Nigeria (NGN)",
    badgeColor: "bg-emerald-950/70 text-emerald-300 border-emerald-800/60",
  },
  kotani: {
    name: "Kotani Pay",
    domain: "kotanipay.com",
    code: "kotani",
    region: "Kenya (KES)",
    badgeColor: "bg-sky-950/70 text-sky-300 border-sky-800/60",
  },
  yellowcard: {
    name: "Yellow Card",
    domain: "yellowcard.io",
    code: "yellowcard",
    region: "Ghana (GHS)",
    badgeColor: "bg-amber-950/70 text-amber-300 border-amber-800/60",
  },
  tempo: {
    name: "Tempo France",
    domain: "tempo.eu.com",
    code: "tempo",
    region: "Europe (EUR)",
    badgeColor: "bg-indigo-950/70 text-indigo-300 border-indigo-800/60",
  },
};

export const DEFAULT_HISTORICAL_TRANSACTIONS: SEP24HistoricalTransaction[] = [
  {
    id: "sep24-dep-9001",
    operation: "deposit",
    status: "completed",
    anchor: DEFAULT_ANCHORS.cowrie,
    amountIn: 750000,
    assetIn: "NGN",
    amountOut: 500,
    assetOut: "USDC",
    fee: 2500,
    feeAsset: "NGN",
    startedAt: "2026-10-17T03:10:00Z",
    completedAt: "2026-10-17T03:14:22Z",
    updatedAt: "2026-10-17T03:14:22Z",
    moreInfoUrl: "https://anchor.cowrie.exchange/receipts/sep24-dep-9001",
    stellarTxHash: "4f7a2b9e1c3d5f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f",
    externalRef: "NIBSS-TRF-884920194",
    account: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFL4U",
    stepLogs: [
      {
        id: "step-1",
        stepKey: "interactive_auth",
        title: "Interactive Webview Auth & KYC",
        description: "Authenticated with Cowrie anchor; KYC Tier 2 verified.",
        status: "completed",
        timestamp: "2026-10-17T03:10:00Z",
      },
      {
        id: "step-2",
        stepKey: "fiat_transfer",
        title: "Fiat Payment Received via NIBSS",
        description: "Inbound NGN 750,000 confirmed from Guaranty Trust Bank.",
        status: "completed",
        timestamp: "2026-10-17T03:11:45Z",
        externalRef: "NIBSS-TRF-884920194",
      },
      {
        id: "step-3",
        stepKey: "anchor_clearing",
        title: "Anchor Compliance & FX Conversion",
        description: "Currency exchange locked at 1,500 NGN/USDC without slippage.",
        status: "completed",
        timestamp: "2026-10-17T03:12:30Z",
      },
      {
        id: "step-4",
        stepKey: "stellar_issuance",
        title: "Stellar Minting & Transfer",
        description: "500 USDC minted and transferred to your Stellar account.",
        status: "completed",
        timestamp: "2026-10-17T03:14:10Z",
        txHash: "4f7a2b9e1c3d5f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f",
      },
      {
        id: "step-5",
        stepKey: "completed",
        title: "Transfer Settlement Complete",
        description: "Funds credited. Official anchor receipt generated.",
        status: "completed",
        timestamp: "2026-10-17T03:14:22Z",
      },
    ],
  },
  {
    id: "sep24-wd-9002",
    operation: "withdrawal",
    status: "completed",
    anchor: DEFAULT_ANCHORS.kotani,
    amountIn: 200,
    assetIn: "USDC",
    amountOut: 26000,
    assetOut: "KES",
    fee: 1.5,
    feeAsset: "USDC",
    startedAt: "2026-10-16T18:40:00Z",
    completedAt: "2026-10-16T18:43:15Z",
    updatedAt: "2026-10-16T18:43:15Z",
    moreInfoUrl: "https://kotanipay.com/receipts/sep24-wd-9002",
    stellarTxHash: "8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c",
    externalRef: "MPESA-B2C-7749102",
    account: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFL4U",
    stepLogs: [
      {
        id: "step-w1",
        stepKey: "interactive_auth",
        title: "Interactive Withdrawal Auth",
        description: "Selected Safaricom M-Pesa recipient destination.",
        status: "completed",
        timestamp: "2026-10-16T18:40:00Z",
      },
      {
        id: "step-w2",
        stepKey: "stellar_payment",
        title: "Stellar Payment to Anchor Vault",
        description: "Sent 200 USDC on-chain to Kotani distribution vault.",
        status: "completed",
        timestamp: "2026-10-16T18:41:05Z",
        txHash: "8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c",
      },
      {
        id: "step-w3",
        stepKey: "anchor_clearing",
        title: "Anchor Liquidity Verification",
        description: "Anchor verified on-chain confirmation and approved fiat release.",
        status: "completed",
        timestamp: "2026-10-16T18:41:50Z",
      },
      {
        id: "step-w4",
        stepKey: "fiat_delivery",
        title: "Safaricom M-Pesa Payout",
        description: "KES 26,000 dispatched via Safaricom B2C API.",
        status: "completed",
        timestamp: "2026-10-16T18:43:00Z",
        externalRef: "MPESA-B2C-7749102",
      },
      {
        id: "step-w5",
        stepKey: "completed",
        title: "Payout Received by Recipient",
        description: "Recipient confirmed SMS delivery notice.",
        status: "completed",
        timestamp: "2026-10-16T18:43:15Z",
      },
    ],
  },
  {
    id: "sep24-dep-9003",
    operation: "deposit",
    status: "pending_anchor",
    anchor: DEFAULT_ANCHORS.tempo,
    amountIn: 300,
    assetIn: "EUR",
    amountOut: 300,
    assetOut: "EURC",
    fee: 1.0,
    feeAsset: "EUR",
    startedAt: "2026-10-17T05:30:00Z",
    updatedAt: "2026-10-17T05:32:10Z",
    moreInfoUrl: "https://tempo.eu.com/portal/tx/sep24-dep-9003",
    account: "GCAV4G63V7D73J7KDEV5WTR9DUWV4PY4DTQEVFL5NBV5BRH4AMMFL5V",
    stepLogs: [
      {
        id: "step-t1",
        stepKey: "interactive_auth",
        title: "SEPA Instant Initiation",
        description: "Selected SEPA transfer; KYC passport verified.",
        status: "completed",
        timestamp: "2026-10-17T05:30:00Z",
      },
      {
        id: "step-t2",
        stepKey: "fiat_transfer",
        title: "SEPA Payment Received",
        description: "EUR 300 received by Tempo clearing bank.",
        status: "completed",
        timestamp: "2026-10-17T05:31:30Z",
        externalRef: "SEPA-FR-99382103",
      },
      {
        id: "step-t3",
        stepKey: "anchor_clearing",
        title: "Anchor Verification in Progress",
        description: "Tempo is allocating EURC minting authorization.",
        status: "in_progress",
        timestamp: "2026-10-17T05:32:10Z",
      },
      {
        id: "step-t4",
        stepKey: "stellar_issuance",
        title: "Stellar Asset Minting",
        description: "Awaiting Stellar ledger ledger close and token dispatch.",
        status: "pending",
        timestamp: "Estimated: ~1 min",
      },
    ],
  },
  {
    id: "sep24-wd-9004",
    operation: "withdrawal",
    status: "failed",
    anchor: DEFAULT_ANCHORS.yellowcard,
    amountIn: 100,
    assetIn: "USDC",
    amountOut: 1380,
    assetOut: "GHS",
    fee: 2.0,
    feeAsset: "USDC",
    startedAt: "2026-10-15T12:00:00Z",
    completedAt: "2026-10-15T12:05:40Z",
    updatedAt: "2026-10-15T12:05:40Z",
    account: "GDCE5H74W8E84K8LDEV6XUS0EUWV5QZ5ETQEVFL6NCW6CSI5SAVFL6W",
    stepLogs: [
      {
        id: "step-y1",
        stepKey: "interactive_auth",
        title: "MTN Mobile Money Initiation",
        description: "Interactive withdrawal form submitted.",
        status: "completed",
        timestamp: "2026-10-15T12:00:00Z",
      },
      {
        id: "step-y2",
        stepKey: "stellar_payment",
        title: "Stellar Transfer to Anchor",
        description: "USDC debited from user wallet.",
        status: "completed",
        timestamp: "2026-10-15T12:01:10Z",
        txHash: "2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f",
      },
      {
        id: "step-y3",
        stepKey: "fiat_delivery",
        title: "MTN Mobile Money Rail Error",
        description: "Mobile wallet account reached daily regulatory limit.",
        status: "failed",
        timestamp: "2026-10-15T12:05:40Z",
        errorMessage: "Destination account KYC tier ceiling exceeded. Automatic USDC refund queued.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Presentation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Formats an ISO string into compact readable date/time (e.g. 'Oct 17, 03:14 AM') */
export function formatTimelineTimestamp(isoOrDate: string): string {
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoOrDate;
  }
}

/** Truncates a Stellar transaction hash or account */
export function truncateHash(hash: string, start = 6, end = 6): string {
  if (!hash || hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}…${hash.slice(-end)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents: Badges & Icons
// ─────────────────────────────────────────────────────────────────────────────

export const OperationBadge = React.memo(function OperationBadge({
  operation,
}: {
  operation: SEP24OperationKind;
}) {
  const isDeposit = operation === "deposit";
  const IconComponent = isDeposit ? ArrowDownLeft : ArrowUpRight;

  return (
    <span
      data-testid={`badge-op-${operation}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
        isDeposit
          ? "bg-emerald-950/70 text-emerald-400 border-emerald-800/60"
          : "bg-blue-950/70 text-blue-400 border-blue-800/60"
      }`}
    >
      <IconComponent size={12} aria-hidden="true" />
      <span>{operation}</span>
    </span>
  );
});

export const OverallStatusBadge = React.memo(function OverallStatusBadge({
  status,
}: {
  status: SEP24OverallStatus;
}) {
  if (status === "completed") {
    return (
      <span
        data-testid="badge-status-completed"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      >
        <CheckCircle2 size={13} aria-hidden="true" />
        <span>Completed</span>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        data-testid="badge-status-failed"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30"
      >
        <OctagonAlert size={13} aria-hidden="true" />
        <span>Failed</span>
      </span>
    );
  }

  if (status === "no_market") {
    return (
      <span
        data-testid="badge-status-no_market"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-500/10 text-neutral-300 border border-neutral-500/30"
      >
        <Circle size={13} aria-hidden="true" />
        <span>No market</span>
      </span>
    );
  }

  // Active / in-progress states (pending_anchor, pending_user_transfer_start, pending_stellar, etc.)
  return (
    <span
      data-testid={`badge-status-${status}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 animate-pulse"
    >
      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      <span>Processing</span>
    </span>
  );
});

export const AnchorPartnerBadge = React.memo(function AnchorPartnerBadge({
  anchor,
}: {
  anchor: AnchorPartnerInfo;
}) {
  return (
    <div
      data-testid={`anchor-badge-${anchor.code}`}
      className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-neutral-800 bg-neutral-900/80 text-xs"
    >
      <Building2 size={13} className="text-cyan-400" aria-hidden="true" />
      <span className="font-semibold text-neutral-200">{anchor.name}</span>
      <span className="text-neutral-500" aria-hidden="true">•</span>
      <span className="text-neutral-400 flex items-center gap-1">
        <Globe size={11} className="text-neutral-500" aria-hidden="true" />
        {anchor.domain}
      </span>
      {anchor.region && (
        <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-xs bg-neutral-800 text-[10px] text-neutral-300 font-medium">
          {anchor.region}
        </span>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Step Node Component
// ─────────────────────────────────────────────────────────────────────────────

interface StepLogNodeProps {
  step: SEP24ProcessingStepLog;
  isLast: boolean;
  stepNumber: number;
}

const StepLogNode = React.memo(function StepLogNode({
  step,
  isLast,
  stepNumber,
}: StepLogNodeProps) {
  const isCompleted = step.status === "completed";
  const isInProgress = step.status === "in_progress";
  const isFailed = step.status === "failed";

  return (
    <li
      data-testid={`step-log-node-${step.stepKey}`}
      className="relative flex items-start gap-4 pb-6 group"
    >
      {/* Connecting Vertical Track */}
      {!isLast && (
        <div
          data-testid="timeline-connector"
          className={`absolute left-4 top-8 bottom-0 w-0.5 -ml-px transition-colors duration-300 ${
            isCompleted ? "bg-emerald-500/50" : "bg-neutral-800"
          }`}
          aria-hidden="true"
        />
      )}

      {/* Node Icon Circle */}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
          isFailed
            ? "border-rose-500 bg-rose-950/80 text-rose-400 shadow-rose-950/40"
            : isCompleted
            ? "border-emerald-500 bg-emerald-950/80 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
            : isInProgress
            ? "border-cyan-400 bg-cyan-950/80 text-cyan-300 animate-pulse ring-2 ring-cyan-500/30"
            : "border-neutral-700 bg-neutral-900 text-neutral-600"
        }`}
      >
        {isFailed ? (
          <OctagonAlert size={14} aria-hidden="true" />
        ) : isCompleted ? (
          <CheckCircle2 size={14} aria-hidden="true" />
        ) : isInProgress ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <span className="text-[11px] font-bold">{stepNumber}</span>
        )}
      </div>

      {/* Step Body */}
      <div className="flex-1 pt-0.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <h4
              className={`text-sm font-semibold ${
                isCompleted
                  ? "text-neutral-100"
                  : isInProgress
                  ? "text-cyan-300"
                  : isFailed
                  ? "text-rose-300"
                  : "text-neutral-400"
              }`}
            >
              {step.title}
            </h4>

            {isInProgress && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                Active Step
              </span>
            )}
          </div>

          {/* Timestamp */}
          <time
            dateTime={step.timestamp}
            className="text-xs font-mono text-neutral-400 flex items-center gap-1"
          >
            <Clock3 size={11} className="text-neutral-500" aria-hidden="true" />
            {formatTimelineTimestamp(step.timestamp)}
          </time>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-neutral-400">
          {step.description}
        </p>

        {/* Technical references: Stellar Tx Hash or External Ref */}
        {(step.txHash || step.externalRef || step.errorMessage) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {step.txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${step.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View Stellar Transaction"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-cyan-400 transition-colors"
              >
                <span>Tx: {truncateHash(step.txHash)}</span>
                <ExternalLink size={10} aria-hidden="true" />
              </a>
            )}

            {step.externalRef && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                <span>Ref: {step.externalRef}</span>
              </span>
            )}

            {step.errorMessage && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                {step.errorMessage}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: SEP24TransactionTimeline
// ─────────────────────────────────────────────────────────────────────────────

export function SEP24TransactionTimeline({
  transactions = DEFAULT_HISTORICAL_TRANSACTIONS,
  initialSelectedId,
  pollInterval = 4000,
  onPollStatus,
  onStatusChange,
  className = "",
}: SEP24TransactionTimelineProps) {
  // Local transaction state allowing dynamic updates and progression
  const [items, setItems] = useState<SEP24HistoricalTransaction[]>(transactions);

  // Synchronize when transactions prop updates
  useEffect(() => {
    setItems(transactions);
  }, [transactions]);

  // Selected transaction ID
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId || items[0]?.id || ""
  );

  // Filters
  const [opFilter, setOpFilter] = useState<"all" | SEP24OperationKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollInFlightRef = useRef(false);
  const isDemoData = transactions === DEFAULT_HISTORICAL_TRANSACTIONS;

  // Current selected transaction object
  const activeTx = useMemo(() => {
    return items.find((t) => t.id === selectedId) || items[0] || null;
  }, [items, selectedId]);

  // Filtered list of historical transactions
  const filteredItems = useMemo(() => {
    return items.filter((tx) => {
      const matchOp = opFilter === "all" || tx.operation === opFilter;
      const matchSearch =
        !searchQuery.trim() ||
        tx.anchor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.assetIn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.assetOut.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchOp && matchSearch;
    });
  }, [items, opFilter, searchQuery]);

  // ── Dynamic Polling & Status Advancement (Acceptance Criteria 2) ─────────

  const pollActiveTransaction = useCallback(async () => {
    if (!activeTx || !onPollStatus || !activeTx.status.startsWith("pending_") || pollInFlightRef.current) return;

    pollInFlightRef.current = true;
    setIsRefreshing(true);
    setPollError(null);
    try {
      const updatedData = await onPollStatus(activeTx.id);
      if (!updatedData) return;

      const merged: SEP24HistoricalTransaction = {
        ...activeTx,
        ...updatedData,
        stepLogs: updatedData.stepLogs || activeTx.stepLogs,
      };
      setItems((currentItems) =>
        currentItems.map((item) => {
          if (item.id !== activeTx.id) return item;
          return { ...item, ...updatedData, stepLogs: updatedData.stepLogs || item.stepLogs };
        })
      );
      if (merged.status !== activeTx.status) onStatusChange?.(merged);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Unable to refresh transaction status.");
    } finally {
      pollInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [activeTx, onPollStatus, onStatusChange]);

  // Poll only when a real status provider is supplied for a pending SEP-24 state.
  useEffect(() => {
    if (!activeTx || !onPollStatus || !activeTx.status.startsWith("pending_") || pollInterval <= 0) return;

    const timer = window.setInterval(() => {
      void pollActiveTransaction();
    }, pollInterval);

    return () => window.clearInterval(timer);
  }, [activeTx, onPollStatus, pollInterval, pollActiveTransaction]);

  return (
    <div
      data-testid="sep24-transaction-timeline"
      className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6 text-neutral-100 backdrop-blur-md ${className}`}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-100">
              SEP-24 Interactive History Timeline
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-cyan-300 border border-neutral-700/60">
              Interactive On/Off-Ramp
            </span>
            {isDemoData && (
              <span data-testid="sep24-demo-data-badge" className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Sample data
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-neutral-400">
            Audit itemized processing logs, timestamps, and anchor receipts for fiat transfers.
          </p>
        </div>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={() => void pollActiveTransaction()}
          disabled={isRefreshing || !onPollStatus || !activeTx?.status.startsWith("pending_")}
          aria-label="Refresh timeline status"
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700/80 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={isRefreshing ? "animate-spin text-cyan-400" : ""}
            aria-hidden="true"
          />
          <span>{isRefreshing ? "Syncing..." : "Sync Status"}</span>
        </button>
      </div>

      {pollError && (
        <p role="alert" data-testid="sep24-poll-error" className="mt-3 text-xs text-rose-300">
          Status refresh failed: {pollError}
        </p>
      )}

      {/* ── Layout Grid: History Switcher (Left) & Active Timeline (Right) ── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Historical Event Switcher ─────────────────────── */}
        <div className="lg:col-span-5 space-y-3">
          {/* Controls: Op Pills + Search */}
          <div className="flex items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800 text-xs">
              <button
                type="button"
                data-testid="filter-op-all"
                onClick={() => setOpFilter("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  opFilter === "all"
                    ? "bg-neutral-800 text-neutral-100 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                data-testid="filter-op-deposit"
                onClick={() => setOpFilter("deposit")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  opFilter === "deposit"
                    ? "bg-emerald-950 text-emerald-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Deposits
              </button>
              <button
                type="button"
                data-testid="filter-op-withdrawal"
                onClick={() => setOpFilter("withdrawal")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  opFilter === "withdrawal"
                    ? "bg-blue-950 text-blue-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Withdrawals
              </button>
            </div>

            <div className="relative flex-1 max-w-[160px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search transaction history"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <Search
                size={11}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Historical List Items */}
          <div
            data-testid="sep24-transaction-list"
            className="space-y-2 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin"
          >
            {filteredItems.length === 0 && (
              <div className="p-6 text-center rounded-xl border border-dashed border-neutral-800 text-neutral-500 text-xs">
                No matching SEP-24 events found.
              </div>
            )}

            {filteredItems.map((tx) => {
              const isSelected = tx.id === activeTx?.id;

              return (
                <button
                  key={tx.id}
                  type="button"
                  data-testid={`tx-select-btn-${tx.id}`}
                  onClick={() => setSelectedId(tx.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 ${
                    isSelected
                      ? "border-cyan-500/60 bg-neutral-900/90 shadow-md ring-1 ring-cyan-500/20"
                      : "border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <OperationBadge operation={tx.operation} />
                      <span className="text-xs font-semibold text-neutral-200 truncate">
                        {tx.anchor.name}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-300 font-medium">
                      <span>
                        {tx.amountIn} {tx.assetIn}
                      </span>
                      <span className="text-neutral-500 mx-1.5">→</span>
                      <span className="text-neutral-100 font-semibold">
                        {tx.amountOut} {tx.assetOut}
                      </span>
                    </div>

                    <time
                      dateTime={tx.startedAt}
                      className="text-[11px] text-neutral-500 block"
                    >
                      {formatTimelineTimestamp(tx.startedAt)}
                    </time>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <OverallStatusBadge status={tx.status} />
                    <ChevronRight
                      size={14}
                      className={isSelected ? "text-cyan-400" : "text-neutral-600"}
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right Column: Selected Transaction Step-by-Step Timeline ─── */}
        <div className="lg:col-span-7 bg-neutral-900/50 rounded-xl border border-neutral-800/90 p-5 sm:p-6">
          {activeTx ? (
            <div>
              {/* Selected Transaction Metadata Bar */}
              <div className="pb-5 mb-5 border-b border-neutral-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <OperationBadge operation={activeTx.operation} />
                      <span className="text-xs font-mono text-neutral-500">
                        ID: {activeTx.id}
                      </span>
                    </div>

                    <div className="text-lg font-bold text-neutral-100 flex items-center gap-2 pt-1">
                      <span>
                        {activeTx.amountIn} {activeTx.assetIn}
                      </span>
                      <span className="text-neutral-500 font-normal">→</span>
                      <span className="text-cyan-400">
                        {activeTx.amountOut} {activeTx.assetOut}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5">
                    <OverallStatusBadge status={activeTx.status} />
                    {activeTx.fee && (
                      <span className="text-xs text-neutral-400">
                        Fee: {activeTx.fee} {activeTx.feeAsset || activeTx.assetIn}
                      </span>
                    )}
                  </div>
                </div>

                {/* Anchor Partner attribution badge */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <AnchorPartnerBadge anchor={activeTx.anchor} />

                  {/* Direct Link to Anchor Receipt Portal (Issue Requirement) */}
                  {activeTx.status === "completed" && activeTx.moreInfoUrl && (
                    <a
                      href={activeTx.moreInfoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="anchor-receipt-portal-link"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Receipt size={13} aria-hidden="true" />
                      <span>View Anchor Receipt</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>

              {/* Step Logs Header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
                  Itemized Processing Step Logs ({activeTx.stepLogs.length})
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  Started: {formatTimelineTimestamp(activeTx.startedAt)}
                </span>
              </div>

              {/* Vertical Step Timeline */}
              <ol
                data-testid="sep24-step-logs-list"
                aria-label="SEP-24 Processing Timeline"
                className="mt-2"
              >
                {activeTx.stepLogs.map((step, idx) => (
                  <StepLogNode
                    key={step.id || step.stepKey}
                    step={step}
                    stepNumber={idx + 1}
                    isLast={idx === activeTx.stepLogs.length - 1}
                  />
                ))}
              </ol>

              {/* Final Summary Card for Completed Transfers */}
              {activeTx.status === "completed" && (
                <div
                  data-testid="completed-summary-banner"
                  className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={22} className="text-emerald-400 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-200">
                        Settlement reported complete
                      </p>
                      <p className="text-[11px] text-emerald-400/80">
                        Settled at {formatTimelineTimestamp(activeTx.completedAt || activeTx.updatedAt)}.
                      </p>
                    </div>
                  </div>

                  {activeTx.moreInfoUrl && (
                    <a
                      href={activeTx.moreInfoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-300 underline font-semibold hover:text-emerald-200"
                    >
                      Receipt Portal
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-neutral-500 text-xs">
              Select a transaction to inspect processing logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SEP24TransactionTimeline;
