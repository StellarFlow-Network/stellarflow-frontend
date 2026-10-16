"use client";

import React from "react";

export interface QuorumProgressInput {
  /** Votes cast so far, counting every option that counts toward quorum. */
  totalVotes: number;
  /** Votes needed for the proposal to reach quorum. */
  quorumRequired: number;
  /**
   * Total voting power that could vote. When given, the bar is drawn against
   * it and the quorum marker sits at `quorumRequired / eligibleVotes`. When
   * omitted the bar is drawn against 125% of the quorum (or the vote total if
   * that is larger) so the marker always has room on both sides.
   */
  eligibleVotes?: number;
}

export interface QuorumProgress {
  /** Participation relative to quorum, V_total / Q_required, as a percentage. Not capped. */
  participationPct: number;
  /** Width of the filled part of the bar, 0 to 100. */
  fillPct: number;
  /** Position of the quorum marker along the bar, 0 to 100. */
  markerPct: number;
  /** Whether the vote total has reached the quorum. */
  reached: boolean;
  /** Votes still needed to reach quorum (0 once reached). */
  remaining: number;
}

const DEFAULT_HEADROOM = 1.25;

function finiteNonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Pure quorum maths, kept separate from rendering so it can be tested directly. */
export function computeQuorumProgress({
  totalVotes,
  quorumRequired,
  eligibleVotes,
}: QuorumProgressInput): QuorumProgress {
  const votes = finiteNonNegative(totalVotes);
  const quorum = finiteNonNegative(quorumRequired);

  // A zero quorum is trivially met.
  if (quorum === 0) {
    return { participationPct: 100, fillPct: 100, markerPct: 0, reached: true, remaining: 0 };
  }

  const eligible = finiteNonNegative(eligibleVotes);
  const scale = eligible > 0 ? Math.max(eligible, quorum) : Math.max(quorum * DEFAULT_HEADROOM, votes);

  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  return {
    participationPct: (votes / quorum) * 100,
    fillPct: clamp((votes / scale) * 100),
    markerPct: clamp((quorum / scale) * 100),
    reached: votes >= quorum,
    remaining: Math.max(0, quorum - votes),
  };
}

export interface QuorumProgressBarProps extends QuorumProgressInput {
  /** Optional label shown above the bar. */
  label?: string;
  /** Formats vote counts. Defaults to `toLocaleString`. */
  formatVotes?: (votes: number) => string;
  className?: string;
}

/**
 * Progress toward quorum for a DAO proposal (#1203).
 *
 * The fill animates as votes come in and turns green once the quorum is met.
 * A vertical marker shows where the quorum threshold sits on the bar.
 */
export function QuorumProgressBar({
  totalVotes,
  quorumRequired,
  eligibleVotes,
  label = "Quorum",
  formatVotes = (n) => Math.round(n).toLocaleString("en-US"),
  className = "",
}: QuorumProgressBarProps) {
  const progress = computeQuorumProgress({ totalVotes, quorumRequired, eligibleVotes });
  const { participationPct, fillPct, markerPct, reached, remaining } = progress;
  const shownPct = Math.min(participationPct, 999).toFixed(1);

  return (
    <div className={`w-full space-y-1.5 ${className}`} data-testid="quorum-progress">
      <div className="flex items-baseline justify-between text-xs font-mono">
        <span className="text-gray-300 font-semibold">{label}</span>
        <span
          className={reached ? "text-emerald-400 font-bold" : "text-gray-300"}
          data-testid="quorum-percent"
        >
          {shownPct}% of quorum
        </span>
      </div>

      <div
        className="relative h-2.5 w-full rounded-full border border-gray-800 bg-gray-900"
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(participationPct, 100))}
        aria-valuetext={
          reached
            ? `Quorum reached: ${formatVotes(totalVotes)} of ${formatVotes(quorumRequired)} votes`
            : `${shownPct}% of quorum: ${formatVotes(totalVotes)} of ${formatVotes(quorumRequired)} votes`
        }
      >
        <div
          data-testid="quorum-fill"
          data-reached={reached ? "true" : "false"}
          className={`h-full rounded-full transition-[width,background-color] duration-700 ease-out motion-reduce:transition-none ${
            reached ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${fillPct}%` }}
        />
        <div
          data-testid="quorum-marker"
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-amber-300"
          style={{ left: `${markerPct}%` }}
          title="Quorum threshold"
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-gray-500">
        <span>
          {formatVotes(totalVotes)} / {formatVotes(quorumRequired)} votes
        </span>
        <span>{reached ? "Quorum reached" : `${formatVotes(remaining)} more needed`}</span>
      </div>
    </div>
  );
}

export default QuorumProgressBar;
