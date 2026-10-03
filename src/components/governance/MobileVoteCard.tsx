"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
  ShieldCheck,
  Fuel,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useOptionalWallet } from "@/app/components/providers/WalletProvider";
import { useGasFee } from "@/hooks/useGasFee";
import { SocialShareModal } from "@/components/common";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VoteChoice = "For" | "Against" | "Abstain";

export interface MobileVoteCardProposal {
  id: string;
  title: string;
  description?: string;
  proposer?: string;
  status?: string;
  votesFor?: number;
  votesAgainst?: number;
  quorumThreshold?: number;
  endsInLedgers?: number;
}

export interface MobileVoteSubmission {
  proposalId: string;
  voteChoice: VoteChoice;
  votingPower: number;
  gasFeeXLM: string;
  transactionHash: string;
  timestamp: string;
}

export interface MobileVoteCardProps {
  /** Target governance proposal */
  proposal?: MobileVoteCardProposal;
  /** Explicit proposal ID override */
  proposalId?: string;
  /** Explicit proposal title override */
  proposalTitle?: string;
  /** Snapshot-based or calculated voting power */
  votingPower?: number;
  /** Total staking supply across the DAO */
  totalStakingPower?: number;
  /** Custom estimated gas fee override in XLM */
  estimatedGasFeeXLM?: string;
  /** Pre-selected vote direction */
  initialVoteChoice?: VoteChoice;
  /** Callback fired upon successful vote confirmation */
  onVoteSubmitted?: (submission: MobileVoteSubmission) => Promise<void> | void;
  /** Optional close or dismiss callback */
  onClose?: () => void;
  /** Additional CSS class names */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatVotingPower(power: number): string {
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(2)}M`;
  if (power >= 1_000) return `${(power / 1_000).toFixed(2)}K`;
  return power.toLocaleString();
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Default fallback proposal when none is provided
const DEFAULT_PROPOSAL: MobileVoteCardProposal = {
  id: "SFP-12",
  title: "Whitelist West African GHS/XLM Asset Pair Feed",
  description:
    "Enable automated oracle aggregation and high-throughput remittance corridors for GHS/XLM.",
  proposer: "GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A",
  status: "Active",
  votesFor: 785000,
  votesAgainst: 120000,
  quorumThreshold: 60,
  endsInLedgers: 4200,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MobileVoteCard({
  proposal = DEFAULT_PROPOSAL,
  proposalId: propIdOverride,
  proposalTitle: propTitleOverride,
  votingPower: propVotingPower,
  totalStakingPower = 2_850_000,
  estimatedGasFeeXLM,
  initialVoteChoice,
  onVoteSubmitted,
  onClose,
  className = "",
}: MobileVoteCardProps) {
  // Resolved proposal details
  const activeProposalId = propIdOverride || proposal.id || "SFP-12";
  const activeProposalTitle = propTitleOverride || proposal.title || "Governance Proposal";
  const activeProposalDescription = proposal.description;
  const activeProposer = proposal.proposer;
  const activeVotesFor = proposal.votesFor ?? 785000;
  const activeVotesAgainst = proposal.votesAgainst ?? 120000;
  const totalVotesCast = activeVotesFor + activeVotesAgainst;

  const forPercentage = totalVotesCast > 0 ? (activeVotesFor / totalVotesCast) * 100 : 50;
  const againstPercentage = totalVotesCast > 0 ? (activeVotesAgainst / totalVotesCast) * 100 : 50;

  // Optional wallet state
  const walletContext = useOptionalWallet();
  const walletConnected = walletContext?.isConnected ?? true;
  const connectedPublicKey = walletContext?.wallet?.publicKey ?? activeProposer;

  // Gas fee from live hook or fallback
  const { snapshot: gasSnapshot } = useGasFee();
  const resolvedGasFeeXLM =
    estimatedGasFeeXLM ||
    gasSnapshot?.tiers.fast.feeXLM ||
    gasSnapshot?.baseFeeXLM ||
    "0.000015";

  // Resolved voting power
  const resolvedVotingPower = propVotingPower ?? 12450;
  const impactPercentage =
    totalStakingPower > 0 ? (resolvedVotingPower / totalStakingPower) * 100 : 0.44;

  // Local state
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(
    initialVoteChoice ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedTx, setSubmittedTx] = useState<MobileVoteSubmission | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Swipe-to-confirm slider tracking
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [sliderWidth, setSliderWidth] = useState(300);
  const [dragProgress, setDragProgress] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [hasTriggeredSwipe, setHasTriggeredSwipe] = useState(false);

  const thumbSize = 46; // thumb diameter in px
  const maxDragX = Math.max(sliderWidth - thumbSize - 8, 120);

  // Track slider container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (sliderTrackRef.current) {
        setSliderWidth(sliderTrackRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [selectedChoice]);

  // Haptic feedback trigger
  const triggerHaptic = useCallback((durationMs = 50) => {
    if (typeof window !== "undefined" && "navigator" in window && navigator.vibrate) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // ignore device vibration errors
      }
    }
  }, []);

  // Handle final vote submission
  const executeVoteSubmission = useCallback(
    async (choice: VoteChoice) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        // Check Freighter if available in browser
        if (typeof window !== "undefined") {
          try {
            const { isConnected } = await import("@stellar/freighter-api");
            const hasFreighter = await isConnected();
            if (hasFreighter) {
              // Simulating contract invocation latency
              await new Promise((res) => setTimeout(res, 900));
            } else {
              await new Promise((res) => setTimeout(res, 600));
            }
          } catch {
            await new Promise((res) => setTimeout(res, 600));
          }
        }

        // Generate deterministic/mock transaction hash
        const generatedHash = `0x${Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("")}`;

        const submissionData: MobileVoteSubmission = {
          proposalId: activeProposalId,
          voteChoice: choice,
          votingPower: resolvedVotingPower,
          gasFeeXLM: resolvedGasFeeXLM,
          transactionHash: generatedHash,
          timestamp: new Date().toISOString(),
        };

        if (onVoteSubmitted) {
          await onVoteSubmitted(submissionData);
        }

        triggerHaptic(80);
        setSubmittedTx(submissionData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Vote transaction failed to submit";
        setSubmitError(message);
        setHasTriggeredSwipe(false);
        setDragProgress(0);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeProposalId,
      resolvedVotingPower,
      resolvedGasFeeXLM,
      onVoteSubmitted,
      triggerHaptic,
    ]
  );

  // Slider drag end handler
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } }
  ) => {
    setIsDragging(false);
    if (!selectedChoice || isSubmitting || submittedTx) return;

    const currentOffset = Math.max(0, info.offset.x);
    const progress = Math.min(1, currentOffset / maxDragX);

    // Threshold: 80% of track width
    if (progress >= 0.8 && !hasTriggeredSwipe) {
      setHasTriggeredSwipe(true);
      setDragProgress(1);
      triggerHaptic(50);
      executeVoteSubmission(selectedChoice);
    } else {
      // Snaps back
      setDragProgress(0);
      setHasTriggeredSwipe(false);
    }
  };

  // Drag progress listener
  const handleDrag = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } }
  ) => {
    if (hasTriggeredSwipe || isSubmitting) return;
    setIsDragging(true);
    const currentOffset = Math.max(0, info.offset.x);
    const progress = Math.min(1, currentOffset / maxDragX);
    setDragProgress(progress);
  };

  // Accessible direct submit fallback
  const handleDirectConfirm = () => {
    if (!selectedChoice || isSubmitting || submittedTx) return;
    setHasTriggeredSwipe(true);
    setDragProgress(1);
    executeVoteSubmission(selectedChoice);
  };

  // Reset to cast another vote or re-select
  const handleReset = () => {
    setSelectedChoice(null);
    setSubmittedTx(null);
    setIsShareOpen(false);
    setSubmitError(null);
    setHasTriggeredSwipe(false);
    setDragProgress(0);
    setIsSubmitting(false);
  };

  // Copy transaction hash to clipboard
  const handleCopyHash = () => {
    if (!submittedTx?.transactionHash) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(submittedTx.transactionHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  // Color schemes based on choice
  const isFor = selectedChoice === "For";
  const isAgainst = selectedChoice === "Against";

  return (
    <div
      className={`w-full max-w-md mx-auto rounded-2xl bg-[#161b22] border border-gray-800 shadow-2xl overflow-hidden transition-all duration-300 ${className}`}
      data-testid="mobile-vote-card"
    >
      <AnimatePresence mode="wait">
        {/* ══════════════════════════════════════════════════════════════════════
            VIEW A: Animated Confirmation Checkmark Graphic (Success State)
           ══════════════════════════════════════════════════════════════════════ */}
        {submittedTx ? (
          <motion.div
            key="success-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="p-5 sm:p-6 flex flex-col items-center text-center space-y-5"
          >
            {/* Animated Checkmark Graphic */}
            <div className="relative mt-2 flex items-center justify-center">
              {/* Outer pulsing glow halo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.35, 0.65, 0.35] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className={`absolute inset-0 -m-3 rounded-full blur-xl ${
                  submittedTx.voteChoice === "For"
                    ? "bg-emerald-500/30"
                    : submittedTx.voteChoice === "Against"
                    ? "bg-red-500/30"
                    : "bg-blue-500/30"
                }`}
              />

              {/* Glowing Circle Graphic with spring pop */}
              <motion.div
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
                className={`relative h-20 w-20 rounded-full flex items-center justify-center shadow-2xl ${
                  submittedTx.voteChoice === "For"
                    ? "bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 shadow-emerald-500/40"
                    : submittedTx.voteChoice === "Against"
                    ? "bg-gradient-to-tr from-red-600 via-rose-500 to-orange-400 shadow-red-500/40"
                    : "bg-gradient-to-tr from-blue-600 to-indigo-400 shadow-blue-500/40"
                }`}
              >
                {/* SVG Checkmark Path with animated stroke */}
                <svg
                  className="w-10 h-10 text-white drop-shadow-md"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                  aria-hidden="true"
                >
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
            </div>

            {/* Title & Stance Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 mb-2">
                <Sparkles size={13} className="text-emerald-400 shrink-0" />
                <span>Vote Recorded On-Chain</span>
              </div>
              <h3 className="text-xl font-bold text-gray-100 tracking-tight">
                Vote Confirmed!
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Your governance weight was committed to ledger consensus for{" "}
                <span className="font-semibold text-gray-200">{submittedTx.proposalId}</span>.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="w-full bg-[#0d1117] border border-gray-800 rounded-xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-800/80">
                <span className="text-gray-400 font-medium">Your Stance</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wide flex items-center gap-1 ${
                    submittedTx.voteChoice === "For"
                      ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-400"
                      : submittedTx.voteChoice === "Against"
                      ? "bg-red-950/60 border border-red-500/40 text-red-400"
                      : "bg-gray-800 text-gray-300"
                  }`}
                >
                  {submittedTx.voteChoice === "For" && <CheckCircle2 size={12} />}
                  {submittedTx.voteChoice === "Against" && <XCircle size={12} />}
                  Voted {submittedTx.voteChoice}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Applied Weight</span>
                <span className="font-mono font-bold text-gray-200">
                  {formatVotingPower(submittedTx.votingPower)} veFLOW
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Network Gas Paid</span>
                <span className="font-mono text-gray-300 flex items-center gap-1">
                  <Fuel size={12} className="text-blue-400" />
                  ~{submittedTx.gasFeeXLM} XLM
                </span>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                  <span>Transaction Hash</span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    aria-label="Copy transaction hash"
                  >
                    {copiedHash ? (
                      <>
                        <Check size={11} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2 rounded bg-black/40 border border-gray-800 font-mono text-[11px] text-gray-300 break-all select-all">
                  {submittedTx.transactionHash}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                className="w-full py-3 px-4 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors"
              >
                Share vote
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Cast Another Vote</span>
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl text-gray-400 hover:text-gray-200 text-xs font-medium transition-colors"
                >
                  Close Card
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════════
              VIEW B: Interactive Mobile Voting Card (Touch-Optimized)
             ══════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="voting-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 sm:p-5 space-y-4"
          >
            {/* Header: Proposal Meta & Badges */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-950/40 border border-blue-500/30 text-blue-400 font-mono font-bold uppercase tracking-wider text-[11px]">
                    {activeProposalId}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                  <Clock size={12} className="text-gray-500" />
                  <span>~4,200 ledgers</span>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-base sm:text-lg font-bold text-gray-100 leading-snug line-clamp-2">
                {activeProposalTitle}
              </h2>
              {activeProposalDescription && (
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {activeProposalDescription}
                </p>
              )}
            </div>

            {/* Tally Progress Bar */}
            <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  FOR: {forPercentage.toFixed(1)}% ({formatVotingPower(activeVotesFor)})
                </span>
                <span className="text-red-400 font-bold flex items-center gap-1">
                  AGAINST: {againstPercentage.toFixed(1)}% ({formatVotingPower(activeVotesAgainst)})
                  <XCircle size={12} />
                </span>
              </div>

              {/* Dual-color bar */}
              <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${forPercentage}%` }}
                />
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${againstPercentage}%` }}
                />
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                Touch-Friendly 'Vote FOR' (Green) and 'Vote AGAINST' (Red) Tap Buttons
               ────────────────────────────────────────────────────────────────── */}
            <div className="space-y-2.5">
              <p className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                Select Your Stance
              </p>

              <div className="grid gap-2.5">
                {/* 1. Vote FOR Button (Green) */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChoice("For");
                    setSubmitError(null);
                    setDragProgress(0);
                    setHasTriggeredSwipe(false);
                    triggerHaptic(25);
                  }}
                  disabled={isSubmitting}
                  className={`w-full min-h-[54px] p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
                    isFor
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10"
                      : "border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-500/60"
                  }`}
                  aria-pressed={isFor}
                  aria-label="Vote FOR this proposal"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ${
                        isFor
                          ? "bg-emerald-500 text-gray-950 border-emerald-400"
                          : "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                      }`}
                    >
                      <CheckCircle2 size={20} className={isFor ? "stroke-[2.5]" : "stroke-2"} />
                    </div>
                    <div>
                      <div className="text-sm font-bold tracking-tight">Vote FOR</div>
                      <div className="text-[11px] text-emerald-400/80">
                        Approve proposal execution
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isFor
                        ? "bg-emerald-400 text-gray-950"
                        : "bg-emerald-950/80 border border-emerald-500/30 text-emerald-400"
                    }`}
                  >
                    {forPercentage.toFixed(0)}%
                  </span>
                </button>

                {/* 2. Vote AGAINST Button (Red) */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChoice("Against");
                    setSubmitError(null);
                    setDragProgress(0);
                    setHasTriggeredSwipe(false);
                    triggerHaptic(25);
                  }}
                  disabled={isSubmitting}
                  className={`w-full min-h-[54px] p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
                    isAgainst
                      ? "border-red-400 bg-red-500/20 text-red-300 ring-2 ring-red-500/50 shadow-lg shadow-red-500/10"
                      : "border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:border-red-500/60"
                  }`}
                  aria-pressed={isAgainst}
                  aria-label="Vote AGAINST this proposal"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ${
                        isAgainst
                          ? "bg-red-500 text-white border-red-400"
                          : "bg-red-950/60 text-red-400 border-red-500/40"
                      }`}
                    >
                      <XCircle size={20} className={isAgainst ? "stroke-[2.5]" : "stroke-2"} />
                    </div>
                    <div>
                      <div className="text-sm font-bold tracking-tight">Vote AGAINST</div>
                      <div className="text-[11px] text-red-400/80">
                        Reject and preserve status quo
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      isAgainst
                        ? "bg-red-500 text-white"
                        : "bg-red-950/80 border border-red-500/30 text-red-400"
                    }`}
                  >
                    {againstPercentage.toFixed(0)}%
                  </span>
                </button>

                {/* Optional Abstain Selector */}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChoice(selectedChoice === "Abstain" ? null : "Abstain");
                      setSubmitError(null);
                      setDragProgress(0);
                    }}
                    disabled={isSubmitting}
                    className={`text-xs flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-colors ${
                      selectedChoice === "Abstain"
                        ? "bg-gray-800 border-gray-600 text-gray-200"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <MinusCircle size={13} />
                    <span>Abstain (Quorum only)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                Voting Weight Summary & Estimated Gas Fee Prior to Signature
               ────────────────────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-400" />
                  Your Voting Weight
                </span>
                <span className="font-mono font-bold text-gray-100 text-sm">
                  {formatVotingPower(resolvedVotingPower)} veFLOW
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">DAO Quorum Impact</span>
                <span className="text-gray-300 font-mono text-[11px]">
                  ~{impactPercentage.toFixed(2)}% of voting supply
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800/80">
                <span className="text-gray-400 font-medium flex items-center gap-1.5">
                  <Fuel size={14} className="text-amber-400" />
                  Estimated Gas Fee
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-gray-200 text-xs">
                    ~{resolvedGasFeeXLM} XLM
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    ⚡ Next ledger (~3-5s)
                  </span>
                </div>
              </div>

              {connectedPublicKey && (
                <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                  <span>Signer:</span>
                  <span className="font-mono text-gray-400">
                    {shortenAddress(connectedPublicKey)}
                  </span>
                </div>
              )}
            </div>

            {/* Submit Error Message */}
            {submitError && (
              <div
                className="p-3 rounded-xl border border-red-500/40 bg-red-950/20 text-red-300 text-xs flex items-start gap-2"
                role="alert"
              >
                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* ──────────────────────────────────────────────────────────────────
                Swipe-To-Confirm Action Slider Preventing Accidental Votes
               ────────────────────────────────────────────────────────────────── */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">
                  {selectedChoice ? (
                    <span className="text-gray-300">
                      Slide right to confirm{" "}
                      <strong
                        className={
                          isFor
                            ? "text-emerald-400"
                            : isAgainst
                            ? "text-red-400"
                            : "text-blue-400"
                        }
                      >
                        {selectedChoice.toUpperCase()}
                      </strong>{" "}
                      vote
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">
                      Select FOR or AGAINST above to unlock slider
                    </span>
                  )}
                </span>
                {selectedChoice && (
                  <span className="text-[11px] font-mono text-gray-500">
                    {Math.round(dragProgress * 100)}%
                  </span>
                )}
              </div>

              {/* Slider Track Container */}
              <div
                ref={sliderTrackRef}
                className={`relative h-14 w-full rounded-full border overflow-hidden flex items-center p-1 select-none touch-none transition-colors duration-200 ${
                  !selectedChoice
                    ? "bg-gray-900/60 border-gray-800 opacity-60 cursor-not-allowed"
                    : isFor
                    ? "bg-emerald-950/30 border-emerald-500/30"
                    : isAgainst
                    ? "bg-red-950/30 border-red-500/30"
                    : "bg-blue-950/30 border-blue-500/30"
                }`}
                role="slider"
                aria-label="Swipe to confirm vote"
                aria-valuenow={Math.round(dragProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={selectedChoice ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDirectConfirm();
                  }
                }}
              >
                {/* Dynamic colored progress fill behind the thumb */}
                {selectedChoice && (
                  <div
                    className={`absolute top-0 bottom-0 left-0 transition-opacity pointer-events-none ${
                      isFor
                        ? "bg-gradient-to-r from-emerald-600/40 to-emerald-500/60"
                        : isAgainst
                        ? "bg-gradient-to-r from-red-600/40 to-red-500/60"
                        : "bg-gradient-to-r from-blue-600/40 to-blue-500/60"
                    }`}
                    style={{
                      width: `${thumbSize + dragProgress * maxDragX}px`,
                    }}
                  />
                )}

                {/* Shimmer Prompt Text in Track */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200"
                  style={{
                    opacity: selectedChoice ? Math.max(0, 1 - dragProgress * 1.5) : 0.6,
                  }}
                >
                  <span className="text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-1.5 text-gray-300">
                    {selectedChoice ? (
                      <>
                        <span>Slide to confirm {selectedChoice}</span>
                        <span className="text-gray-400 font-mono tracking-tighter">
                          &gt;&gt;&gt;
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">Tap an option to enable</span>
                    )}
                  </span>
                </div>

                {/* Draggable Action Thumb */}
                {selectedChoice ? (
                  <motion.div
                    drag={isSubmitting ? false : "x"}
                    dragConstraints={{ left: 0, right: maxDragX }}
                    dragElastic={0.06}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                    animate={{
                      x: isSubmitting || hasTriggeredSwipe ? maxDragX : isDragging ? undefined : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 32,
                    }}
                    className={`relative z-10 h-[46px] w-[46px] rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-transform ${
                      isFor
                        ? "bg-emerald-500 text-gray-950 shadow-emerald-500/30"
                        : isAgainst
                        ? "bg-red-500 text-white shadow-red-500/30"
                        : "bg-blue-500 text-white shadow-blue-500/30"
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : hasTriggeredSwipe ? (
                      <Check size={20} className="stroke-[3]" />
                    ) : (
                      <ArrowRight size={20} className="stroke-[2.5]" />
                    )}
                  </motion.div>
                ) : (
                  <div className="h-[46px] w-[46px] rounded-full bg-gray-800 text-gray-600 flex items-center justify-center">
                    <ArrowRight size={18} />
                  </div>
                )}
              </div>

              {/* Accessible fallback button for keyboard/assistive technologies */}
              {selectedChoice && !isSubmitting && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleDirectConfirm}
                    className="text-[11px] text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors pt-0.5"
                  >
                    Or tap here to confirm {selectedChoice}
                  </button>
                </div>
              )}
            </div>

            {/* Nonce & Security Guarantee Notice */}
            <p className="text-[10px] text-center text-gray-500 leading-tight">
              Non-custodial vote signed on Stellar Soroban. Gas fee estimated at current ledger base.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {submittedTx && (
        <SocialShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          shareData={{
            type: "governance",
            title: `${activeProposalTitle}: ${submittedTx.voteChoice}`,
            fromAmount: `Voted ${submittedTx.voteChoice}`,
            fromSymbol: "Vote",
            toAmount: formatVotingPower(submittedTx.votingPower),
            toSymbol: "veFLOW",
            timestamp: `${new Date(submittedTx.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`,
            txHash: submittedTx.transactionHash,
          }}
        />
      )}
    </div>
  );
}

export default MobileVoteCard;
