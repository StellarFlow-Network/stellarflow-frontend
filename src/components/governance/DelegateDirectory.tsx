"use client";

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import Fuse from "fuse.js";
import DOMPurify from "isomorphic-dompurify";
import { useDebounce } from "@/app/hooks/useDebounce";
import { useIsHydrated } from "@/app/hooks/useIsHydrated";
import {
  useWallet,
  useWalletActions,
  WalletProvider,
} from "@/app/hooks/useWalletState";
import { useToast } from "@/components/ui/ToastQueue";
import { withShortenedAddressField } from "@/utils/addressUtils";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type {
  Delegate,
  DelegateVoteRecord,
  DelegateDirectoryFilter,
} from "@/types/delegation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegateDirectoryProps {
  delegates: Delegate[];
  /** Pre-fetched delegates to render. */
  isLoading?: boolean;
}

type DelegateWithShortAddress = Delegate & { shortenedAddress: string };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_TABS: { key: DelegateDirectoryFilter; label: string }[] = [
  { key: "all", label: "All Delegates" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "community", label: "Community" },
  { key: "security", label: "Security" },
  { key: "governance", label: "Governance" },
];

const TAG_COLOR_MAP: Record<string, string> = {
  infrastructure: "bg-blue-900/40 text-blue-300 border-blue-800/60",
  community: "bg-green-900/40 text-green-300 border-green-800/60",
  security: "bg-red-900/40 text-red-300 border-red-800/60",
  governance: "bg-purple-900/40 text-purple-300 border-purple-800/60",
  africa: "bg-yellow-900/40 text-yellow-300 border-yellow-800/60",
  oracle: "bg-cyan-900/40 text-cyan-300 border-cyan-800/60",
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuse.js search options
// ─────────────────────────────────────────────────────────────────────────────

const FUSE_OPTIONS: Fuse.IFuseOptions<Delegate> = {
  keys: [
    { name: "name", weight: 0.4 },
    { name: "address", weight: 0.25 },
    { name: "platformStatement", weight: 0.2 },
    { name: "tags", weight: 0.15 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** A single tag badge */
const TagBadge = React.memo(function TagBadge({
  tag,
}: {
  tag: string;
}) {
  const colorClass =
    TAG_COLOR_MAP[tag.toLowerCase()] ??
    "bg-gray-800 text-gray-300 border-gray-700";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${colorClass}`}
      style={{ contain: "layout" }}
    >
      {tag}
    </span>
  );
});
TagBadge.displayName = "TagBadge";

/** Voting history row for a single vote record */
const VoteHistoryRow = React.memo(function VoteHistoryRow({
  vote,
}: {
  vote: DelegateVoteRecord;
}) {
  const voteColor =
    vote.voteType === "For"
      ? "text-emerald-400"
      : vote.voteType === "Against"
        ? "text-red-400"
        : "text-gray-400";

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-[#0d1117] rounded-md text-xs">
      <span className="font-mono text-gray-500 w-14 shrink-0">
        {vote.proposalId}
      </span>
      <span className="text-gray-400 truncate flex-1 min-w-0">
        {vote.proposalTitle}
      </span>
      <span className={`font-semibold ${voteColor} w-16 text-right shrink-0`}>
        {vote.voteType}
      </span>
      <span className="text-gray-500 font-mono w-20 text-right shrink-0">
        {vote.votingPower.toLocaleString()} VP
      </span>
    </div>
  );
});
VoteHistoryRow.displayName = "VoteHistoryRow";

/** Delegate card — isolated memoization boundary */
interface DelegateCardProps {
  delegate: DelegateWithShortAddress;
  onDelegate: (delegate: DelegateWithShortAddress) => void;
  isDelegating: boolean;
  walletConnected: boolean;
}

const DelegateCard = React.memo(function DelegateCard({
  delegate,
  onDelegate,
  isDelegating,
  walletConnected,
}: DelegateCardProps) {
  const [showHistory, setShowHistory] = useState(false);

  const sanitizedStatement = useMemo(
    () => DOMPurify.sanitize(delegate.platformStatement),
    [delegate.platformStatement],
  );

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  return (
    <div
      className="bg-[#161b22] border border-gray-800 rounded-xl p-6 group relative overflow-hidden"
      style={{ transition: "border-color 150ms ease", contain: "layout" }}
    >
      {/* Hover overlay */}
      <span className="absolute inset-0 bg-gray-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Header: name, address, tags */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors duration-150">
                {delegate.name}
              </h3>
              {delegate.tags.slice(0, 3).map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
            <p className="text-xs font-mono text-gray-500">
              {delegate.shortenedAddress}
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-lg font-bold text-gray-100 tabular-nums">
                {delegate.totalDelegatedPower.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Delegated XLM
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-100 tabular-nums">
                {delegate.delegatorCount}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Delegators
              </p>
            </div>
          </div>
        </div>

        {/* Platform Statement */}
        <div className="border-l-2 border-gray-700 pl-3">
          <p
            className="text-sm text-gray-400 leading-relaxed line-clamp-3"
            dangerouslySetInnerHTML={{ __html: sanitizedStatement }}
          />
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={toggleHistory}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors duration-150"
          >
            <Icon
              id={ICON_IDS.history}
              size={14}
              className={showHistory ? "text-blue-400" : ""}
            />
            {showHistory
              ? "Hide voting history"
              : `Voting history (${delegate.votingHistory.length})`}
          </button>

          <button
            onClick={() => onDelegate(delegate)}
            disabled={isDelegating || !walletConnected}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              transition: "transform 150ms ease, box-shadow 150ms ease",
            }}
          >
            <span className="absolute inset-0 bg-blue-700 opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
            <span className="relative z-10 flex items-center gap-2">
              <Icon id={ICON_IDS.key} size={14} />
              {isDelegating ? "Delegating..." : "Delegate"}
            </span>
          </button>
        </div>

        {/* Expandable voting history */}
        {showHistory && (
          <div
            className="space-y-1.5 pt-2 border-t border-gray-800"
            style={{ animation: "delegate-slide-down 200ms ease" }}
          >
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
              Recent voting history
            </p>
            {delegate.votingHistory.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-2">
                No voting history yet.
              </p>
            ) : (
              delegate.votingHistory.slice(0, 8).map((vote, idx) => (
                <VoteHistoryRow key={`${vote.proposalId}-${idx}`} vote={vote} />
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
},
(prev, next) =>
  prev.delegate.id === next.delegate.id &&
  prev.isDelegating === next.isDelegating &&
  prev.walletConnected === next.walletConnected,
);
DelegateCard.displayName = "DelegateCard";

// ─────────────────────────────────────────────────────────────────────────────
// Delegation modal for specifying amount
// ─────────────────────────────────────────────────────────────────────────────

interface DelegateModalProps {
  delegate: DelegateWithShortAddress;
  onClose: () => void;
  onConfirm: (amount: string) => void;
  isSubmitting: boolean;
}

function DelegateModal({
  delegate,
  onClose,
  onConfirm,
  isSubmitting,
}: DelegateModalProps) {
  const [amount, setAmount] = useState("100");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount || parseFloat(amount) <= 0) return;
      onConfirm(amount);
    },
    [amount, onConfirm],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-[#161b22] border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modal-slide-up 200ms ease" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            Delegate Voting Weight
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <Icon id={ICON_IDS.xCircle} size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          You are delegating to{" "}
          <span className="text-blue-400 font-semibold">{delegate.name}</span>{" "}
          (
          <span className="font-mono text-xs text-gray-500">
            {delegate.shortenedAddress}
          </span>
          ).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="delegate-amount"
              className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide"
            >
              Voting Weight (XLM)
            </label>
            <input
              id="delegate-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter amount..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-[#0d1117] border border-gray-700 text-gray-400 px-4 py-2.5 rounded-lg text-sm font-medium hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Confirming..." : "Confirm Delegation"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS styles injected once (matches pattern in WalletContext.tsx)
// ─────────────────────────────────────────────────────────────────────────────

const DELEGATE_STYLE_ID = "sf-delegate-styles";

const DELEGATE_CSS = `
@keyframes delegate-slide-down {
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 600px; }
}
@keyframes modal-slide-up {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;

function ensureDelegateStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(DELEGATE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DELEGATE_STYLE_ID;
  style.textContent = DELEGATE_CSS;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
      <Icon id={ICON_IDS.users} size={32} className="opacity-30" />
      <p className="text-sm">
        {hasSearch
          ? "No delegates match your search."
          : "No registered delegates found."}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

function DelegateCardSkeleton() {
  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 animate-pulse space-y-4">
      <div className="flex justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 rounded bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-700/60" />
        </div>
        <div className="flex gap-4">
          <div className="h-10 w-20 rounded bg-gray-700/60" />
          <div className="h-10 w-20 rounded bg-gray-700/60" />
        </div>
      </div>
      <div className="h-10 rounded bg-gray-700/60" />
      <div className="flex justify-between">
        <div className="h-4 w-28 rounded bg-gray-700/60" />
        <div className="h-9 w-24 rounded bg-gray-700/60" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner Content (must be inside WalletProvider)
// ─────────────────────────────────────────────────────────────────────────────

function DelegateDirectoryContent({
  delegates,
  isLoading,
}: DelegateDirectoryProps) {
  const isHydrated = useIsHydrated();
  const { wallet } = useWallet();
  const { addToast, updateToast } = useToast();
  const { refreshWalletState } = useWalletActions();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<DelegateDirectoryFilter>("all");
  const [selectedDelegate, setSelectedDelegate] =
    useState<DelegateWithShortAddress | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const debouncedSearch = useDebounce(searchTerm, 200);

  // Pre-compute shortened addresses
  const enrichedDelegates = useMemo(
    () => withShortenedAddressField(delegates, "address"),
    [delegates],
  );

  // Setup Fuse.js search index
  const fuse = useMemo(
    () => new Fuse(enrichedDelegates, FUSE_OPTIONS),
    [enrichedDelegates],
  );

  // Filter + search
  const visibleDelegates = useMemo(() => {
    let result = enrichedDelegates;

    // Apply tag filter
    if (activeFilter !== "all") {
      result = result.filter((d) =>
        d.tags.some((tag) => tag.toLowerCase() === activeFilter),
      );
    }

    // Apply Fuse.js fuzzy search
    if (debouncedSearch.trim()) {
      const fuseResults = fuse.search(debouncedSearch.trim());
      // Maintain filter ordering by intersecting
      const matchedIds = new Set(fuseResults.map((r) => r.item.id));
      result = result.filter((d) => matchedIds.has(d.id));
    }

    return result;
  }, [enrichedDelegates, activeFilter, debouncedSearch, fuse]);

  // Cleanup timers on unmount
  useEffect(() => {
    // Inject delegate styles once (idempotent)
    ensureDelegateStyles();

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
    };
  }, []);

  // ── One-click delegation handler ───────────────────────────────────────
  const handleDelegateClick = useCallback(
    (delegate: DelegateWithShortAddress) => {
      setSelectedDelegate(delegate);
    },
    [],
  );

  const handleConfirmDelegation = useCallback(
    async (amount: string) => {
      if (!selectedDelegate) return;
      setIsDelegating(true);

      const toastId = addToast({
        title: "Delegation submitted",
        description: `Delegating ${amount} XLM voting weight to ${selectedDelegate.name}.`,
        status: "submitted",
      });

      try {
        const { submitDelegation } = await import("@/lib/delegationOps");
        updateToast(toastId, {
          status: "processing",
          title: "Transaction processing",
          description: "Awaiting Freighter signature...",
        });

        const txHash = await submitDelegation(
          selectedDelegate.address,
          amount,
        );

        updateToast(toastId, {
          status: "confirmed",
          title: "Delegation confirmed",
          description: `Successfully delegated ${amount} XLM to ${selectedDelegate.name}.`,
          txHash,
        });

        // Refresh wallet state to reflect changes
        await refreshWalletState();
        setSelectedDelegate(null);

        const timer = setTimeout(() => {
          timeoutsRef.current.delete(timer);
        }, 2000);
        timeoutsRef.current.add(timer);
      } catch (err) {
        updateToast(toastId, {
          status: "failed",
          title: "Delegation failed",
          description:
            err instanceof Error ? err.message : "Transaction could not be completed.",
        });
      } finally {
        setIsDelegating(false);
      }
    },
    [selectedDelegate, addToast, updateToast, refreshWalletState],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isHydrated) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 mb-6">
          <div className="h-10 w-64 rounded bg-[#161b22] animate-pulse" />
          <div className="flex gap-2">
            {FILTER_TABS.map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 rounded bg-[#161b22] animate-pulse"
              />
            ))}
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <DelegateCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Icon
            id={ICON_IDS.search}
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search delegates by name, address, or platform..."
            aria-label="Search delegates by name, address, or platform"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                activeFilter === key
                  ? "bg-blue-600 text-white"
                  : "bg-[#161b22] text-gray-400 border border-gray-800 hover:text-gray-200 hover:border-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet status notice */}
      {!wallet?.connected && !isLoading && (
        <div className="flex items-center gap-2 p-3 bg-yellow-950/20 border border-yellow-900/30 rounded-lg text-xs text-yellow-500">
          <Icon id={ICON_IDS.alertTriangle} size={14} />
          Connect your Freighter wallet to delegate voting weight.
        </div>
      )}

      {/* Delegate Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <DelegateCardSkeleton key={i} />
          ))}
        </div>
      ) : visibleDelegates.length === 0 ? (
        <EmptyState hasSearch={debouncedSearch.trim().length > 0} />
      ) : (
        <div className="space-y-4">
          {visibleDelegates.map((delegate) => (
            <DelegateCard
              key={delegate.id}
              delegate={delegate}
              onDelegate={handleDelegateClick}
              isDelegating={isDelegating && selectedDelegate?.id === delegate.id}
              walletConnected={wallet?.connected ?? false}
            />
          ))}
        </div>
      )}

      {/* Delegation Modal */}
      {selectedDelegate && (
        <DelegateModal
          delegate={selectedDelegate}
          onClose={() => setSelectedDelegate(null)}
          onConfirm={handleConfirmDelegation}
          isSubmitting={isDelegating}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export (wraps content in WalletProvider + ToastProvider boundary)
// ─────────────────────────────────────────────────────────────────────────────

export function DelegateDirectory(props: DelegateDirectoryProps) {
  return (
    <WalletProvider>
      <DelegateDirectoryContent {...props} />
    </WalletProvider>
  );
}

export default DelegateDirectory;
