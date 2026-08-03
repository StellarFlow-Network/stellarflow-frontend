"use client";

/**
 * usePendingTransaction — watches a submitted transaction that has not yet been
 * ingested by Horizon and reports when it has been queued long enough to count
 * as stuck.
 *
 * Two independent clocks run while the transaction is unresolved:
 *  • a 1s tick (shared RAF loop, so it pauses with tab visibility) that advances
 *    the displayed pending duration;
 *  • a slower Horizon poll that resolves the transaction to confirmed/failed and
 *    stops both clocks.
 *
 * Both the resolved status and the last polling error are stored keyed by the
 * hash they describe, so switching to a different transaction resets them by
 * derivation rather than by writing state from an effect.
 */

import { useCallback, useEffect, useState } from "react";
import { useRAFInterval } from "@/app/hooks/useRAFInterval";
import {
  STUCK_THRESHOLD_MS,
  fetchLedgerTxStatus,
  type LedgerTxStatus,
} from "@/lib/txSpeedUpOps";

export type PendingTxStatus = "idle" | LedgerTxStatus;

export interface UsePendingTransactionOptions {
  /** Hash of the submitted transaction; `null` while nothing is in flight */
  hash?: string | null;
  /** Epoch ms the transaction was handed to the network */
  submittedAt?: number | null;
  /** Horizon REST base URL for the active network */
  horizonUrl: string;
  /** Set false to suspend both the tick and the poll (e.g. modal closed) */
  enabled?: boolean;
  /** How often to ask Horizon whether the hash has landed */
  pollIntervalMs?: number;
  /** Pending duration after which the transaction is reported as stuck */
  stuckThresholdMs?: number;
}

export interface PendingTransactionState {
  status: PendingTxStatus;
  /** How long the transaction has been unconfirmed, in ms */
  elapsedMs: number;
  /** True once a still-pending transaction passes the stuck threshold */
  isStuck: boolean;
  /** Countdown to the stuck threshold, in ms; 0 once crossed */
  msUntilStuck: number;
  /** Last polling error, if Horizon was unreachable */
  error: string | null;
  /** Forces an immediate Horizon status check */
  refresh: () => void;
}

/** A poll outcome tagged with the hash it belongs to. */
interface TaggedOutcome<T> {
  hash: string;
  value: T;
}

export function usePendingTransaction({
  hash,
  submittedAt,
  horizonUrl,
  enabled = true,
  pollIntervalMs = 5_000,
  stuckThresholdMs = STUCK_THRESHOLD_MS,
}: UsePendingTransactionOptions): PendingTransactionState {
  const isTracking = Boolean(enabled && hash && submittedAt);

  const [resolution, setResolution] = useState<
    TaggedOutcome<LedgerTxStatus> | null
  >(null);
  const [pollError, setPollError] = useState<TaggedOutcome<string> | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pollNonce, setPollNonce] = useState(0);

  // Outcomes carry the hash they describe, so a result belonging to a previously
  // watched transaction is ignored rather than having to be cleared.
  const resolvedStatus =
    hash && resolution?.hash === hash ? resolution.value : null;

  const status: PendingTxStatus = !isTracking
    ? "idle"
    : (resolvedStatus ?? "pending");

  const isUnresolved = isTracking && status === "pending";

  const elapsedMs = submittedAt ? Math.max(0, now - submittedAt) : 0;

  const tick = useCallback(() => setNow(Date.now()), []);
  useRAFInterval(tick, 1_000, isUnresolved);

  // Poll Horizon until the transaction resolves one way or the other.
  useEffect(() => {
    if (!isUnresolved || !hash) return;

    let cancelled = false;

    const check = async () => {
      try {
        const next = await fetchLedgerTxStatus(horizonUrl, hash);
        if (cancelled) return;
        setPollError(null);
        if (next !== "pending") {
          setResolution({ hash, value: next });
        }
      } catch (err) {
        if (cancelled) return;
        setPollError({
          hash,
          value:
            err instanceof Error
              ? err.message
              : "Unable to reach Horizon for transaction status.",
        });
      }
    };

    void check();
    const timer = window.setInterval(check, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isUnresolved, hash, horizonUrl, pollIntervalMs, pollNonce]);

  const refresh = useCallback(() => setPollNonce((n) => n + 1), []);

  return {
    status,
    elapsedMs: isTracking ? elapsedMs : 0,
    isStuck: isUnresolved && elapsedMs >= stuckThresholdMs,
    msUntilStuck: isUnresolved ? Math.max(0, stuckThresholdMs - elapsedMs) : 0,
    error: hash && pollError?.hash === hash ? pollError.value : null,
    refresh,
  };
}

export default usePendingTransaction;
