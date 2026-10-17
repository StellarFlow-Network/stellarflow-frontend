/*
 * src/app/hooks/useSep24TransactionPolling.ts
 *
 * Polls a SEP-24 transaction until it reaches a terminal state.
 * Triggered automatically when the anchor webview signals completion.
 */
import { useCallback, useEffect, useRef } from "react";

export type SEP24TransactionStatus =
  | "pending_anchor"
  | "pending_stellar"
  | "pending_user"
  | "completed"
  | "error"
  | "refunded"
  | "expired"
  | string;

export interface SEP24Transaction {
  id: string;
  status: SEP24TransactionStatus;
  [key: string]: unknown;
}

export interface UseSep24TransactionPollingOptions {
  /** Returns the current transaction record from the anchor API. */
  fetchTransaction: (id: string) => Promise<SEP24Transaction>;
  /** Polling interval in milliseconds. Defaults to 5000. */
  intervalMs?: number;
  /** Maximum number of poll attempts before giving up. Defaults to 60. */
  maxAttempts?: number;
  /** Invoked on every successful fetch. */
  onUpdate?: (transaction: SEP24Transaction) => void;
  /** Invoked when the transaction reaches a final state. */
  onComplete?: (transaction: SEP24Transaction) => void;
  /** Invoked when polling fails or times out. */
  onError?: (error: Error) => void;
}

const TERMINAL_STATUSES = new Set<string>([
  "completed",
  "error",
  "refunded",
  "expired",
]);

export function isTerminalSep24Status(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toLowerCase());
}

/**
 * Polls a SEP-24 transaction until it reaches a final state.
 *
 * Usage:
 *   const { startPolling, stopPolling } = useSep24TransactionPolling({
 *     fetchTransaction,
 *     onComplete: (tx) => refreshBalance(),
 *   });
 *   // triggered from the SEP24WebviewModal onComplete handler:
 *   startPolling(transactionId);
 */
export function useSep24TransactionPolling(options: UseSep24TransactionPollingOptions) {
  const {
    fetchTransaction,
    intervalMs = 5000,
    maxAttempts = 60,
    onUpdate,
    onComplete,
    onError,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);
  const cancelledRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    cancelledRef.current = true;
    activeIdRef.current = null;
    clearTimer();
  }, [clearTimer]);

  const scheduleNext = useCallback(
    (id: string, run: () => Promise<void>) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (cancelledRef.current || activeIdRef.current !== id) return;
        void run();
      }, intervalMs);
    },
    [clearTimer, intervalMs],
  );

  const runPoll = useCallback(
    async (id: string): Promise<void> => {
      if (cancelledRef.current || activeIdRef.current !== id) return;

      attemptsRef.current += 1;

      try {
        const tx = await fetchTransaction(id);

        if (cancelledRef.current || activeIdRef.current !== id) return;

        onUpdate?.(tx);

        if (isTerminalSep24Status(tx.status)) {
          activeIdRef.current = null;
          clearTimer();
          onComplete?.(tx);
          return;
        }

        if (attemptsRef.current >= maxAttempts) {
          activeIdRef.current = null;
          clearTimer();
          onError?.(
            new Error(
              `Stopped polling transaction ${id} after ${maxAttempts} attempts without reaching a final state.`,
            ),
          );
          return;
        }

        scheduleNext(id, () => runPoll(id));
      } catch (cause) {
        if (cancelledRef.current || activeIdRef.current !== id) return;

        // Transient network errors are retried until the attempt budget is exhausted.
        if (attemptsRef.current >= maxAttempts) {
          activeIdRef.current = null;
          clearTimer();
          onError?.(cause instanceof Error ? cause : new Error(String(cause)));
          return;
        }

        scheduleNext(id, () => runPoll(id));
      }
    },
    [fetchTransaction, onUpdate, onComplete, onError, maxAttempts, clearTimer, scheduleNext, runPoll],
  );

  const startPolling = useCallback(
    (id: string) => {
      if (!id) return;
      clearTimer();
      cancelledRef.current = false;
      attemptsRef.current = 0;
      activeIdRef.current = id;
      void runPoll(id);
    },
    [clearTimer, runPoll],
  );

  /** Cancel any in-flight polling when the component unmounts. */
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      activeIdRef.current = null;
      clearTimer();
    };
  }, [clearTimer]);

  return { startPolling, stopPolling };
}

export default useSep24TransactionPolling;
