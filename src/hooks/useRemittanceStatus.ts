"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRAFInterval } from "@/app/hooks/useRAFInterval";
import { usePageVisibility } from "@/app/hooks/usePageVisibility";
import { useErrorTimeout } from "@/app/hooks/useErrorTimeout";

// ---------------------------------------------------------------------------
// Remittance status domain types
// ---------------------------------------------------------------------------

/**
 * The five ordered states a remittance travels through.
 * The numeric order is intentional — comparison helpers rely on it.
 */
export type RemittanceStep =
  | "deposited"
  | "swap_completed"
  | "anchor_processing"
  | "offramp_dispatched"
  | "delivered";

export const REMITTANCE_STEPS: RemittanceStep[] = [
  "deposited",
  "swap_completed",
  "anchor_processing",
  "offramp_dispatched",
  "delivered",
];

/**
 * Metadata returned for each completed or in-progress step.
 * `txHash` is present only for on-chain steps that have a verified transaction.
 */
export interface RemittanceStepMeta {
  step: RemittanceStep;
  completedAt?: string; // ISO 8601
  txHash?: string;      // Stellar transaction hash for block explorer link
}

export type RemittanceStatusPhase =
  | "idle"
  | "loading"
  | "active"
  | "completed"
  | "failed";

export interface RemittanceStatus {
  txId: string;
  currentStep: RemittanceStep | null;
  stepMeta: Partial<Record<RemittanceStep, RemittanceStepMeta>>;
  phase: RemittanceStatusPhase;
  estimatedDeliveryMs?: number; // Unix timestamp
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Hook options and return shape
// ---------------------------------------------------------------------------

export interface UseRemittanceStatusOptions {
  /** How often (ms) to poll when WebSocket is unavailable. Default: 5 000 ms */
  pollIntervalMs?: number;
  /** Maximum polling attempts before giving up. Default: 60 */
  maxPollAttempts?: number;
  /** Disable polling entirely and rely on WebSocket-only. Default: false */
  wsOnly?: boolean;
  /** Stop all activity once the remittance reaches the `delivered` state. */
  stopOnDelivered?: boolean;
}

export interface UseRemittanceStatusReturn {
  status: RemittanceStatus | null;
  isConnected: boolean;
  isPolling: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WS_MSG_TYPE = "remittance_status";

/**
 * Derive a sensible API base URL from the environment.
 * Falls back to a relative path so the hook works with Next.js API routes
 * during development even when NEXT_PUBLIC_API_URL is unset.
 */
function getApiBase(): string {
  if (typeof window === "undefined") return "";
  const envUrl =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL ?? "")
      : "";
  return envUrl || "";
}

/**
 * Build the polling URL for a given transaction ID.
 */
function buildPollUrl(txId: string): string {
  return `${getApiBase()}/api/remittance/${encodeURIComponent(txId)}/status`;
}

/**
 * Build the WebSocket URL for remittance status updates.
 */
function buildWsUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const envUrl =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL ?? "")
      : "";

  if (envUrl) {
    // Strip http(s):// prefix and add ws(s):// so it works for all origins.
    const stripped = envUrl.replace(/^https?:\/\//, "");
    return `${protocol}//${stripped}/ws/remittance`;
  }

  return `${protocol}//${window.location.host}/ws/remittance`;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * `useRemittanceStatus` — real-time remittance progress tracking.
 *
 * Strategy:
 * 1. Open a dedicated WebSocket channel `ws(s)://.../ws/remittance` and
 *    subscribe to updates for the given `txId`.
 * 2. On connect, send `{ type: "subscribe", txId }`.
 * 3. On any incoming message of type `remittance_status`, update state.
 * 4. If the WebSocket fails to connect or is unavailable (e.g., server-side
 *    render, non-WS environment), fall back to HTTP polling via
 *    `GET /api/remittance/:txId/status`.
 * 5. Polling stops once `delivered` is reached (when `stopOnDelivered` is true)
 *    or after `maxPollAttempts` attempts.
 * 6. All side effects are cleaned up on unmount — no leaks, no ghost timers.
 */
export function useRemittanceStatus(
  txId: string | null,
  options: UseRemittanceStatusOptions = {},
): UseRemittanceStatusReturn {
  const {
    pollIntervalMs = 5_000,
    maxPollAttempts = 60,
    wsOnly = false,
    stopOnDelivered = true,
  } = options;

  const [status, setStatus] = useState<RemittanceStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const { error, setError } = useErrorTimeout({ timeoutMs: 0 }); // manual clear

  // Track whether WS is functional so we can decide if polling is needed.
  const wsHealthyRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const isVisible = usePageVisibility();

  // Memoised flag: should we stop?
  const isTerminal =
    status?.phase === "completed" ||
    status?.phase === "failed" ||
    (stopOnDelivered && status?.currentStep === "delivered");

  // ------------------------------------------------------------------
  // applyUpdate — merge an incoming payload into state
  // ------------------------------------------------------------------
  const applyUpdate = useCallback((payload: RemittanceStatus) => {
    if (!isMountedRef.current) return;
    setStatus(payload);
    setError(null);
  }, [setError]);

  // ------------------------------------------------------------------
  // HTTP polling
  // ------------------------------------------------------------------
  const doPoll = useCallback(async () => {
    if (!txId || wsHealthyRef.current || isTerminal) return;
    if (pollCountRef.current >= maxPollAttempts) {
      setIsPolling(false);
      setError(`Status check timed out after ${maxPollAttempts} attempts.`);
      return;
    }

    try {
      pollCountRef.current += 1;
      const res = await fetch(buildPollUrl(txId), {
        headers: { Accept: "application/json" },
        // Use no-store to always get a fresh response from the server.
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as RemittanceStatus;
      applyUpdate(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch status";
      setError(msg);
    }
  }, [txId, isTerminal, maxPollAttempts, applyUpdate, setError]);

  // The RAF interval drives polling while visible and WS is unhealthy.
  const shouldPoll = Boolean(
    txId && !wsOnly && !wsHealthyRef.current && !isTerminal && isVisible,
  );

  // Expose polling state reactively.
  useEffect(() => {
    setIsPolling(shouldPoll);
  }, [shouldPoll]);

  useRAFInterval(doPoll, pollIntervalMs, shouldPoll);

  // ------------------------------------------------------------------
  // WebSocket subscription
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!txId || typeof window === "undefined") return;

    isMountedRef.current = true;
    pollCountRef.current = 0;

    // Trigger an immediate poll before WS is ready to show a status quickly.
    if (!wsOnly) {
      doPoll();
    }

    const wsUrl = buildWsUrl();
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      // WebSocket construction can throw in some environments — fall back to
      // polling gracefully.
      wsHealthyRef.current = false;
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      wsHealthyRef.current = true;
      setIsConnected(true);
      setError(null);

      // Subscribe to this specific transaction.
      ws.send(JSON.stringify({ type: "subscribe", txId }));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          txId?: string;
          data?: RemittanceStatus;
        };

        // Guard: only handle messages for our transaction.
        if (msg.type === WS_MSG_TYPE && msg.txId === txId && msg.data) {
          applyUpdate(msg.data);
        }
      } catch {
        // Silently discard malformed frames.
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      wsHealthyRef.current = false;
      setIsConnected(false);
      // If the connection closed before delivery, keep polling.
    };

    ws.onerror = () => {
      wsHealthyRef.current = false;
      setIsConnected(false);
    };

    return () => {
      isMountedRef.current = false;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [txId, wsOnly, doPoll, applyUpdate, setError]);

  // ------------------------------------------------------------------
  // Manual refetch — useful for a "retry" button in the UI.
  // ------------------------------------------------------------------
  const refetch = useCallback(async () => {
    setError(null);
    pollCountRef.current = 0;
    await doPoll();
  }, [doPoll, setError]);

  return { status, isConnected, isPolling, error, refetch };
}

// ---------------------------------------------------------------------------
// Utility helpers — exported for use in the component layer
// ---------------------------------------------------------------------------

/**
 * Returns the zero-based index of a step in REMITTANCE_STEPS.
 * Returns -1 if the step is not found.
 */
export function stepIndex(step: RemittanceStep | null | undefined): number {
  if (!step) return -1;
  return REMITTANCE_STEPS.indexOf(step);
}

/**
 * Returns true when the given step has been completed, given the current step.
 */
export function isStepCompleted(
  step: RemittanceStep,
  currentStep: RemittanceStep | null,
): boolean {
  if (!currentStep) return false;
  return stepIndex(step) < stepIndex(currentStep);
}

/**
 * Returns true when the given step is the currently active (in-progress) step.
 */
export function isStepActive(
  step: RemittanceStep,
  currentStep: RemittanceStep | null,
): boolean {
  return step === currentStep;
}

/**
 * Build a Stellar Expert block explorer URL for a given transaction hash.
 * Defaults to mainnet; pass `"testnet"` for the test network.
 */
export function stellarExpertTxUrl(
  txHash: string,
  network: "mainnet" | "testnet" = "mainnet",
): string {
  const base = "https://stellar.expert/explorer";
  const net = network === "testnet" ? "testnet" : "public";
  return `${base}/${net}/tx/${txHash}`;
}
