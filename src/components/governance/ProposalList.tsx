"use client";

import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { subscribe } from "@/workers/masterTimerWorker";
import { withShortenedAddressField } from "@/utils/addressUtils";
import { useIsHydrated } from "@/app/hooks/useIsHydrated";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  PROPOSAL_STATUS_BADGE_VARIANTS,
  PROPOSAL_STATUS_DOT_VARIANTS,
} from "@/lib/classNameVariants";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalStatus = "Active" | "Passed" | "Executed" | "Rejected";

export interface ProposalRecord {
  id: string;
  title: string;
  description?: string;
  proposer: string;
  /** Categorised status: Active, Passed, Executed, or Rejected */
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  /** Minimum percentage of total staking power required for quorum */
  quorumThreshold: number;
  /** Approximate Stellar ledgers remaining (only meaningful when Active) */
  endsInLedgers: number;
}

export interface ProposalListProps {
  proposals: ProposalRecord[];
  /** Filter applied externally (e.g. tab selection). Defaults to "all". */
  filter?: "all" | "active" | "archived";
  /** Called when the user clicks Vote on an active proposal. */
  onVote?: (proposal: ProposalRecord) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Approximate seconds per Stellar ledger */
const STELLAR_LEDGER_SECONDS = 5;

/** How many RAF ticks between ledger decrements (masterTimerWorker fires every frame ~60fps) */
const TICKS_PER_LEDGER_DECREMENT = 60 * STELLAR_LEDGER_SECONDS;

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge — isolated memoization boundary
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = React.memo(
  function StatusBadge({ status }: { status: ProposalStatus }) {
    return (
      <span
        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${PROPOSAL_STATUS_BADGE_VARIANTS[status]}`}
        style={{ contain: "layout" }}
      >
        {status}
      </span>
    );
  },
  (prev, next) => prev.status === next.status,
);
StatusBadge.displayName = "ProposalStatusBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Voting Progress Bar
// ─────────────────────────────────────────────────────────────────────────────

interface VotingBarProps {
  votesFor: number;
  votesAgainst: number;
  quorumThreshold: number;
}

const VotingBar = React.memo(function VotingBar({
  votesFor,
  votesAgainst,
  quorumThreshold,
}: VotingBarProps) {
  const total = votesFor + votesAgainst;
  const forPct = total > 0 ? (votesFor / total) * 100 : 0;
  const againstPct = 100 - forPct;

  return (
    <div className="w-full space-y-1.5 voting-ratio-indicator" style={{ contain: "layout" }}>
      <div className="flex justify-between text-xs font-mono">
        <span className="text-emerald-400 font-bold numeric-value">
          For: {forPct.toFixed(1)}%
        </span>
        <span className="text-red-400 font-bold numeric-value">
          Against: {againstPct.toFixed(1)}%
        </span>
      </div>

      {/* Dual-segment progress bar: emerald = For, red = Against */}
      <div
        className="w-full h-2 rounded-full overflow-hidden flex border border-gray-800"
        role="progressbar"
        aria-valuenow={Math.round(forPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`For ${forPct.toFixed(1)}%, Against ${againstPct.toFixed(1)}%`}
      >
        <div
          className="bg-emerald-500 h-full dynamic-scale-x"
          style={{
            width: "100%",
            transform: `scaleX(${forPct / 100})`,
            transformOrigin: "left",
            willChange: "transform",
          }}
        />
        <div
          className="bg-red-700/60 h-full flex-1"
          aria-hidden="true"
        />
      </div>

      <div className="text-[10px] text-gray-500 font-mono text-right numeric-value">
        Quorum Required: {quorumThreshold}%
      </div>
    </div>
  );
},
(prev, next) =>
  prev.votesFor === next.votesFor &&
  prev.votesAgainst === next.votesAgainst &&
  prev.quorumThreshold === next.quorumThreshold,
);
VotingBar.displayName = "ProposalVotingBar";

// ─────────────────────────────────────────────────────────────────────────────
// Countdown Timer — derived from live ledger decrement
// ─────────────────────────────────────────────────────────────────────────────

interface CountdownProps {
  ledgersRemaining: number;
  isHydrated: boolean;
}

const CountdownTimer = React.memo(function CountdownTimer({
  ledgersRemaining,
  isHydrated,
}: CountdownProps) {
  const totalSeconds = ledgersRemaining * STELLAR_LEDGER_SECONDS;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const formatted = hours > 0
    ? `${hours}h ${minutes}m remaining`
    : minutes > 0
    ? `${minutes}m ${secs}s remaining`
    : `${secs}s remaining`;

  if (!isHydrated) {
    return (
      <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
        <Icon id={ICON_IDS.clock} size={12} />
        ~{ledgersRemaining.toLocaleString()} ledgers
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
      <Icon id={ICON_IDS.clock} size={12} />
      {ledgersRemaining > 0 ? formatted : "Voting ended"}
    </span>
  );
},
(prev, next) =>
  prev.ledgersRemaining === next.ledgersRemaining &&
  prev.isHydrated === next.isHydrated,
);
CountdownTimer.displayName = "ProposalCountdownTimer";

// ─────────────────────────────────────────────────────────────────────────────
// Individual Proposal Row
// ─────────────────────────────────────────────────────────────────────────────

interface ProposalRowProps {
  proposal: ProposalRecord & { shortenedAddress: string };
  ledgersRemaining: number;
  isHydrated: boolean;
  onVote?: (proposal: ProposalRecord & { shortenedAddress: string }) => void;
}

function proposalRowAreEqual(prev: ProposalRowProps, next: ProposalRowProps): boolean {
  return (
    prev.proposal.id === next.proposal.id &&
    prev.proposal.status === next.proposal.status &&
    prev.proposal.votesFor === next.proposal.votesFor &&
    prev.proposal.votesAgainst === next.proposal.votesAgainst &&
    prev.ledgersRemaining === next.ledgersRemaining &&
    prev.isHydrated === next.isHydrated &&
    prev.onVote === next.onVote
  );
}

const ProposalRow = React.memo(function ProposalRow({
  proposal,
  ledgersRemaining,
  isHydrated,
  onVote,
}: ProposalRowProps) {
  return (
    <div
      className="bg-[#161b22] border border-gray-800 rounded-xl p-6 group relative overflow-hidden"
      style={{ transition: "border-color 150ms ease", contain: "layout" }}
    >
      {/* Hover overlay — pointer-events-none to stay out of hit testing */}
      <span className="absolute inset-0 bg-gray-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Proposal meta */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-tight">
              {proposal.id}
            </span>

            <StatusBadge status={proposal.status} />

            {proposal.status === "Active" && (
              <CountdownTimer
                ledgersRemaining={ledgersRemaining}
                isHydrated={isHydrated}
              />
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-100 group-hover:text-blue-400 relative z-10 transition-colors duration-150">
            {proposal.title}
          </h3>

          {proposal.description && (
            <p className="text-sm text-gray-400 line-clamp-2 relative z-10">
              {proposal.description}
            </p>
          )}

          <p className="text-xs text-gray-500 font-mono">
            Proposed by:{" "}
            <span className="text-gray-400">{proposal.shortenedAddress}</span>
          </p>
        </div>

        {/* Right: Voting bar + action */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 lg:min-w-[320px]">
          <VotingBar
            votesFor={proposal.votesFor}
            votesAgainst={proposal.votesAgainst}
            quorumThreshold={proposal.quorumThreshold}
          />

          {proposal.status === "Active" ? (
            <button
              type="button"
              onClick={() => onVote?.(proposal)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shrink-0 self-end md:self-auto relative overflow-hidden hover:bg-blue-700 transition-colors"
              aria-label={`Vote on proposal ${proposal.id}`}
            >
              <span className="absolute inset-0 bg-blue-700 opacity-0 transition-opacity duration-150 pointer-events-none" />
              <Icon id={ICON_IDS.gavel} size={16} className="relative z-10" />
              <span className="relative z-10">Vote</span>
            </button>
          ) : (
            <button
              className="p-2 bg-[#0d1117] border border-gray-700 text-gray-400 rounded-lg shrink-0 self-end md:self-auto relative overflow-hidden"
              aria-label={`View proposal ${proposal.id}`}
              style={{ transition: "border-color 150ms ease" }}
            >
              <span className="absolute inset-0 bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
              <Icon id={ICON_IDS.chevronRight} size={18} className="relative z-10" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, proposalRowAreEqual);
ProposalRow.displayName = "ProposalRow";

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: ProposalListProps["filter"] }) {
  const label =
    filter === "active"
      ? "active proposals"
      : filter === "archived"
      ? "archived proposals"
      : "proposals";
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
      <Icon id={ICON_IDS.vote} size={32} className="opacity-30" />
      <p className="text-sm">No {label} found</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProposalList — main export
// ─────────────────────────────────────────────────────────────────────────────

export function ProposalList({ proposals, filter = "all", onVote }: ProposalListProps) {
  const isHydrated = useIsHydrated();

  // Pre-compute shortened proposer addresses at ingestion time
  const enrichedProposals = useMemo(
    () => withShortenedAddressField(proposals, "proposer"),
    [proposals],
  );

  // Filter by tab selection
  const visibleProposals = useMemo(() => {
    if (filter === "active") return enrichedProposals.filter((p) => p.status === "Active");
    if (filter === "archived")
      return enrichedProposals.filter(
        (p) => p.status === "Passed" || p.status === "Executed" || p.status === "Rejected",
      );
    return enrichedProposals;
  }, [enrichedProposals, filter]);

  // Live ledger countdown — shared RAF ticker, throttled to one decrement per
  // ~STELLAR_LEDGER_SECONDS seconds rather than every frame.
  const [ledgerCounts, setLedgerCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(proposals.map((p) => [p.id, p.endsInLedgers])),
  );

  // Reset ledger state if proposal list identity changes (e.g. data refresh)
  useEffect(() => {
    setLedgerCounts(Object.fromEntries(proposals.map((p) => [p.id, p.endsInLedgers])));
  }, [proposals]);

  const tickRef = useRef(0);

  const onTick = useCallback(() => {
    tickRef.current += 1;
    if (tickRef.current < TICKS_PER_LEDGER_DECREMENT) return;
    tickRef.current = 0;

    setLedgerCounts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id in next) {
        if (next[id] > 0) {
          next[id] -= 1;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const unsub = subscribe(onTick);
    return unsub;
  }, [isHydrated, onTick]);

  if (visibleProposals.length === 0) {
    return <EmptyState filter={filter} />;
  }

  return (
    <div className="space-y-4">
      {visibleProposals.map((proposal) => (
        <ProposalRow
          key={proposal.id}
          proposal={proposal}
          ledgersRemaining={ledgerCounts[proposal.id] ?? proposal.endsInLedgers}
          isHydrated={isHydrated}
          onVote={onVote}
        />
      ))}
    </div>
  );
}

export default ProposalList;
