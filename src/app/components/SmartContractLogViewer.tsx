"use client";

import React, { useState, useCallback } from "react";
import { Copy, Check, Activity, Clock, Hash, User, FileCode, Zap } from "lucide-react";
import type { StellarTransactionEvent, TransactionStatus } from "@/types";

interface SmartContractLogViewerProps {
  events: StellarTransactionEvent[];
  isLoading?: boolean;
}

const statusConfig: Record<TransactionStatus, { label: string; bg: string; text: string; border: string }> = {
  success: {
    label: "Success",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  failed: {
    label: "Failed",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
};

function truncateHash(hash: string, startChars = 6, endChars = 4): string {
  if (hash.length <= startChars + endChars + 3) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyableHash({ hash, label }: { hash: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard API is unavailable
    }
  }, [hash]);

  return (
    <div className="flex items-center gap-2 group">
      {label && <span className="text-xs text-slate-500">{label}</span>}
      <code className="text-xs font-mono text-[#D9F99D]/90 bg-[#D9F99D]/5 px-2 py-1 rounded">
        {truncateHash(hash)}
      </code>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-white/10"
        aria-label={`Copy ${hash}`}
        title="Copy full hash"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3 text-slate-400 hover:text-[#D9F99D]" />
        )}
      </button>
    </div>
  );
}

function EventRow({ event }: { event: StellarTransactionEvent }) {
  const status = statusConfig[event.status];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
      {/* Header: Hash + Status */}
      <div className="flex items-center justify-between gap-4">
        <CopyableHash hash={event.hash} />
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}
        >
          {status.label}
        </span>
      </div>

      {/* Function & Contract */}
      <div className="flex items-center gap-2">
        <FileCode className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-white">{event.functionName}</span>
        <span className="text-slate-500">•</span>
        <span className="text-sm text-slate-400">Contract</span>
        <CopyableHash hash={event.contractAddress} />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">Ledger</span>
          <span className="text-xs font-medium text-white">#{event.ledger.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">{formatTimestamp(event.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">Gas</span>
          <span className="text-xs font-medium text-white">{event.gasUsed.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <User className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-xs text-slate-400 truncate">From</span>
          <code className="text-xs font-mono text-slate-300 truncate">
            {truncateHash(event.sourceAccount, 4, 4)}
          </code>
        </div>
      </div>

      {/* Memo if present */}
      {event.memo && (
        <div className="text-xs text-slate-500 bg-white/[0.02] px-3 py-2 rounded-lg">
          Memo: {event.memo}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-[#D9F99D]/10 flex items-center justify-center mb-4">
        <Activity className="h-6 w-6 text-[#D9F99D]/60" />
      </div>
      <p className="text-slate-400 text-sm">No transaction events found</p>
      <p className="text-slate-500 text-xs mt-1">Events will appear here when smart contracts are invoked</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 w-32 bg-white/10 rounded" />
            <div className="h-6 w-16 bg-white/10 rounded-full" />
          </div>
          <div className="h-4 w-48 bg-white/10 rounded mb-3" />
          <div className="grid grid-cols-4 gap-3 pt-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-4 w-20 bg-white/10 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SmartContractLogViewer({ events, isLoading = false }: SmartContractLogViewerProps) {
  return (
    <div className="rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/85">
            Smart Contract Events
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">
            Transaction Log
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#D9F99D]" />
          <span className="text-sm text-slate-400">{events.length} events</span>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <LoadingState />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
