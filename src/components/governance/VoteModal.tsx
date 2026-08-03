"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  WalletProvider,
  useWallet,
  useWalletStatus,
} from "@/app/components/providers/WalletProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoteOption = "For" | "Against" | "Abstain";

export interface VoteSubmission {
  proposalId: string;
  voteType: VoteOption;
  votingPower: number;
  transactionHash: string;
}

export interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Proposal being voted on */
  proposalId: string;
  proposalTitle: string;
  /** Snapshot-based voting power for the connected wallet */
  votingPower?: number;
  /** Total staking power for the proposal (used for impact preview) */
  totalStakingPower?: number;
  onVoteSuccess?: (submission: VoteSubmission) => void;
  onVoteError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the caller's voting power from snapshot token balances.
 * In production this would query a snapshot oracle / Merkle distributor
 * or the governance contract's `votingPower(account)` method.
 */
async function fetchVotingPower(publicKey: string): Promise<number> {
  // Lazy-load Stellar SDK to keep the initial bundle lean
  const { Horizon } = await import("@stellar/stellar-sdk");
  void Horizon; // tree-shake guard — real snapshot query goes here

  // Placeholder: simulate network latency for snapshot balance lookup
  await new Promise<void>((resolve) => setTimeout(resolve, 800));

  // Mock: derive a deterministic voting power from the public key
  const hash = publicKey.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 1000 + (hash % 9001); // range 1,000 – 10,000
}

/**
 * Format a voting power value for display.
 */
function formatVotingPower(power: number): string {
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(2)}M`;
  if (power >= 1_000) return `${(power / 1_000).toFixed(2)}K`;
  return power.toLocaleString();
}

// ---------------------------------------------------------------------------
// Vote option configuration
// ---------------------------------------------------------------------------

interface VoteOptionConfig {
  value: VoteOption;
  label: string;
  description: string;
  iconId: IconId;
  activeColor: string;
  bgColor: string;
  borderColor: string;
}

const VOTE_OPTIONS: VoteOptionConfig[] = [
  {
    value: "For",
    label: "For",
    description: "You support this proposal and vote in favour of its execution.",
    iconId: ICON_IDS.checkCircle,
    activeColor: "text-emerald-400",
    bgColor: "bg-emerald-950/20",
    borderColor: "border-emerald-500/40",
  },
  {
    value: "Against",
    label: "Against",
    description: "You oppose this proposal and vote against its execution.",
    iconId: ICON_IDS.xCircle,
    activeColor: "text-red-400",
    bgColor: "bg-red-950/20",
    borderColor: "border-red-500/40",
  },
  {
    value: "Abstain",
    label: "Abstain",
    description:
      "You refrain from taking a stance while still participating in quorum.",
    iconId: ICON_IDS.minus,
    activeColor: "text-gray-400",
    bgColor: "bg-gray-800/40",
    borderColor: "border-gray-600/40",
  },
];

// ---------------------------------------------------------------------------
// Inner modal implementation (requires WalletProvider in the tree)
// ---------------------------------------------------------------------------

function VoteModalContent({
  isOpen,
  onClose,
  proposalId,
  proposalTitle,
  votingPower: initialVotingPower,
  totalStakingPower = 2_850_000,
  onVoteSuccess,
  onVoteError,
}: VoteModalProps) {
  // ── Local state ─────────────────────────────────────────────────────────
  const [selectedVote, setSelectedVote] = useState<VoteOption | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // ── Voting power state (fetched from snapshot on open) ──────────────────
  const [votingPower, setVotingPower] = useState<number | null>(
    initialVotingPower ?? null,
  );
  const [isLoadingPower, setIsLoadingPower] = useState(false);
  const [powerError, setPowerError] = useState<string | null>(null);

  // ── Wallet context ──────────────────────────────────────────────────────
  const { wallet } = useWallet();
  const { isChecking } = useWalletStatus();

  // ── Derived values ──────────────────────────────────────────────────────
  const publicKey = wallet?.publicKey ?? null;
  const walletConnected = wallet?.connected ?? false;

  const impactPercent =
    votingPower !== null && totalStakingPower > 0
      ? (votingPower / totalStakingPower) * 100
      : null;

  const canSubmit =
    walletConnected &&
    selectedVote !== null &&
    confirmed &&
    !isSubmitting &&
    txHash === null &&
    votingPower !== null;

  // ── Fetch voting power when modal opens ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (initialVotingPower !== undefined) {
      setVotingPower(initialVotingPower);
      return;
    }

    if (!publicKey) return;

    let cancelled = false;
    setIsLoadingPower(true);
    setPowerError(null);

    fetchVotingPower(publicKey)
      .then((power) => {
        if (!cancelled) setVotingPower(power);
      })
      .catch((err) => {
        if (!cancelled) {
          setPowerError(
            err instanceof Error ? err.message : "Failed to fetch voting power.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPower(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, publicKey, initialVotingPower]);

  // ── Reset state on close ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSelectedVote(null);
      setConfirmed(false);
      setSubmitError(null);
      setTxHash(null);
      setIsSubmitting(false);
      setVotingPower(initialVotingPower ?? null);
      setPowerError(null);
      setIsLoadingPower(false);
    }
  }, [isOpen, initialVotingPower]);

  // ── Handle close (with reset) ───────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSelectedVote(null);
    setConfirmed(false);
    setSubmitError(null);
    setTxHash(null);
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  // ── Vote submission ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!walletConnected || !selectedVote || !publicKey || votingPower === null) {
      setSubmitError(
        "Connect your wallet and select a voting option before submitting.",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Simulate signing a governance contract transaction via Freighter
      const { isConnected } = await import("@stellar/freighter-api");
      const connected = await isConnected();

      if (!connected) {
        throw new Error(
          "Freighter extension is not available. Please install it.",
        );
      }

      // In production: build a governance contract `vote(proposalId, voteType)`
      // Soroban invocation, sign with Freighter, and submit.
      await new Promise<void>((resolve) => setTimeout(resolve, 1200));

      const simulatedHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("")}`;

      setTxHash(simulatedHash);

      const submission: VoteSubmission = {
        proposalId,
        voteType: selectedVote,
        votingPower,
        transactionHash: simulatedHash,
      };

      onVoteSuccess?.(submission);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Vote transaction failed.");
      setSubmitError(error.message);
      onVoteError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Cast Your Vote"
      size="lg"
    >
      <div className="space-y-5">
        {/* ── Proposal summary ──────────────────────────────────────────── */}
        <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-4">
          <p className="text-xs uppercase font-bold text-gray-500 mb-1">
            Proposal
          </p>
          <p className="text-sm font-semibold text-gray-100 break-words">
            {proposalId}
          </p>
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">
            {proposalTitle}
          </p>
        </div>

        {/* ── Voting power display ──────────────────────────────────────── */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                id={ICON_IDS.shield}
                size={16}
                className="text-blue-400 shrink-0"
              />
              <p className="text-xs uppercase font-bold tracking-wider text-blue-400">
                Your Voting Power
              </p>
            </div>
            {!walletConnected && (
              <span className="text-[10px] uppercase font-bold text-yellow-500 bg-yellow-950/20 px-2 py-0.5 rounded">
                Wallet Required
              </span>
            )}
          </div>

          {isLoadingPower ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span
                className="h-4 w-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0"
                aria-hidden="true"
              />
              Resolving snapshot balance…
            </div>
          ) : powerError ? (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <Icon
                id={ICON_IDS.alertTriangle}
                size={14}
                className="text-red-400 shrink-0"
              />
              {powerError}
            </div>
          ) : votingPower !== null ? (
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-300">
                {formatVotingPower(votingPower)} SF
              </p>
              {impactPercent !== null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {impactPercent < 0.01
                    ? "< 0.01%"
                    : `${impactPercent.toFixed(2)}%`}{" "}
                  of total staking power
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {isChecking
                ? "Checking wallet connection…"
                : "Connect your wallet to see your voting power."}
            </p>
          )}
        </div>

        {/* ── Vote option radio selectors ───────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs uppercase font-bold text-gray-500">
            Your Vote
          </p>
          <div className="grid gap-3">
            {VOTE_OPTIONS.map((option) => {
              const isSelected = selectedVote === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSelectedVote(option.value);
                    setSubmitError(null);
                  }}
                  disabled={!walletConnected || isSubmitting || txHash !== null}
                  className={`relative flex items-start gap-4 rounded-lg border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? `${option.borderColor} ${option.bgColor}`
                      : "border-gray-700 bg-[#0d1117] hover:border-gray-600"
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Vote ${option.label}`}
                >
                  {/* Custom radio indicator */}
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected
                        ? `${option.borderColor} ${option.bgColor}`
                        : "border-gray-600"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          option.value === "For"
                            ? "bg-emerald-400"
                            : option.value === "Against"
                              ? "bg-red-400"
                              : "bg-gray-400"
                        }`}
                      />
                    )}
                  </span>

                  {/* Option content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon
                        id={option.iconId}
                        size={16}
                        className={
                          isSelected
                            ? option.activeColor
                            : "text-gray-500 shrink-0"
                        }
                      />
                      <span
                        className={`text-sm font-semibold ${
                          isSelected
                            ? option.activeColor
                            : "text-gray-300"
                        }`}
                      >
                        {option.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Confirmation checkbox ─────────────────────────────────────── */}
        {selectedVote !== null && (
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                setSubmitError(null);
              }}
              disabled={isSubmitting || txHash !== null}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-600 bg-[#0d1117] text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed accent-blue-600"
            />
            <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
              I understand that my vote is based on my snapshot token balance
              and will be recorded on-chain. This action cannot be undone.
            </span>
          </label>
        )}

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {submitError && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {submitError}
          </div>
        )}

        {/* ── Success banner ────────────────────────────────────────────── */}
        {txHash && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            Your vote has been submitted on-chain. Transaction:{" "}
            <span className="font-mono break-all">{txHash}</span>
          </div>
        )}

        {/* ── Action row ────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {txHash ? "Close" : "Cancel"}
          </button>
          {!txHash && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Submitting Vote…"
                : `Confirm ${selectedVote ?? ""} Vote`}
            </button>
          )}
        </div>
      </div>
    </OptimizedDialog>
  );
}

// ---------------------------------------------------------------------------
// Public export — self-contained with its own WalletProvider boundary
// ---------------------------------------------------------------------------

/**
 * VoteModal
 *
 * Multi-option voting confirmation modal for governance proposals.
 * Connected wallet holders can cast a weighted vote (For / Against / Abstain)
 * based on their snapshot token balance.
 *
 * Features:
 * - Fetches caller voting power from snapshot token balances on open
 * - Radio selectors for For, Against, and Abstain options
 * - Displays voting power impact percentage against total staking power
 * - Confirmation checkbox to acknowledge on-chain finality
 * - Simulates a signed governance contract transaction via Freighter
 * - Lazy-loads Stellar SDK and Freighter API to keep the initial bundle small
 *
 * @example
 * ```tsx
 * <VoteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   proposalId="SFP-12"
 *   proposalTitle="Whitelist West African GHS/XLM Asset Pair Feed"
 *   onVoteSuccess={(sub) => console.log("Vote cast:", sub)}
 * />
 * ```
 */
export function VoteModal(props: VoteModalProps) {
  return (
    <WalletProvider>
      <VoteModalContent {...props} />
    </WalletProvider>
  );
}

export default VoteModal;
