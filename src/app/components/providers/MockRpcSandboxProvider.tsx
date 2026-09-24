"use client";

/**
 * MockRpcSandboxProvider — Issue #726
 *
 * Development-only Soroban RPC sandbox. Simulates the handful of RPC calls
 * the app relies on (account lookup, transaction simulation, transaction
 * submission, latest ledger) without ever touching a live testnet endpoint.
 *
 * Pairs with `MockWalletProvider` (mock connected wallet + balances) to give
 * Storybook stories and local development a fully offline, deterministic
 * environment: `MockWalletProvider` answers "who is connected and what do
 * they hold", `MockRpcSandboxProvider` answers "what does the network say
 * when I ask it something".
 *
 * Configurable controls (surfaced as Storybook args, see
 * `MockRpcSandboxProvider.stories.tsx`):
 *  - `latencyMs`      — simulated round-trip latency per call.
 *  - `failureRate`    — probability (0–1) any given call rejects.
 *  - `accountBalances`— pre-funded balances returned by `getAccount`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MockRpcSandboxConfig {
  /** Simulated network latency, in milliseconds, applied to every call. */
  latencyMs: number;
  /** Probability (0–1) that any given call simulates a network/tx failure. */
  failureRate: number;
  /** Pre-funded balances keyed by asset code, returned by `getAccount`. */
  accountBalances: Record<string, string>;
  /** Ledger sequence the sandbox starts counting up from. */
  startingLedgerSequence: number;
}

export const DEFAULT_MOCK_RPC_CONFIG: MockRpcSandboxConfig = {
  latencyMs: 400,
  failureRate: 0,
  accountBalances: { XLM: "10000.0000000", USDC: "500.0000000" },
  startingLedgerSequence: 1_000_000,
};

export interface MockAccountResult {
  accountId: string;
  sequence: string;
  balances: { asset: string; amount: string }[];
}

export interface MockSimulateResult {
  status: "SUCCESS" | "ERROR";
  minResourceFee: string;
  latencyMs: number;
  error?: string;
}

export interface MockSendResult {
  status: "PENDING" | "SUCCESS" | "FAILED";
  hash: string;
  latencyMs: number;
  error?: string;
}

export interface MockLedgerResult {
  sequence: number;
  protocolVersion: number;
  closeTime: string;
}

interface MockRpcSandboxContextType {
  config: MockRpcSandboxConfig;
  /** Merge a partial config into the sandbox — lets a dev panel or story
   *  controls adjust latency/failure/balances at runtime. */
  updateConfig: (partial: Partial<MockRpcSandboxConfig>) => void;
  /** Count of simulated calls made so far, for debug displays. */
  callCount: number;
  getAccount: (publicKey: string) => Promise<MockAccountResult>;
  simulateTransaction: () => Promise<MockSimulateResult>;
  sendTransaction: () => Promise<MockSendResult>;
  getLatestLedger: () => Promise<MockLedgerResult>;
}

const MockRpcSandboxContext = createContext<MockRpcSandboxContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function randomHash(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export interface MockRpcSandboxProviderProps {
  children: React.ReactNode;
  /** Initial (and, when it changes identity, live-updated) sandbox config. */
  config?: Partial<MockRpcSandboxConfig>;
}

export function MockRpcSandboxProvider({ children, config }: MockRpcSandboxProviderProps) {
  // `override` holds only ad-hoc runtime changes made via `updateConfig`
  // (e.g. a debug panel toggling failure rate). The externally-controlled
  // `config` prop — which is what lets Storybook argTypes drive the sandbox
  // live as the user adjusts controls — is merged in at render time below,
  // so a new prop value is picked up immediately without needing an effect
  // to copy it into state.
  const [override, setOverride] = useState<Partial<MockRpcSandboxConfig>>({});
  const callCountRef = useRef(0);
  const [callCount, setCallCount] = useState(0);

  const state = useMemo<MockRpcSandboxConfig>(
    () => ({ ...DEFAULT_MOCK_RPC_CONFIG, ...config, ...override }),
    [config, override],
  );

  const ledgerRef = useRef(state.startingLedgerSequence);

  const updateConfig = useCallback((partial: Partial<MockRpcSandboxConfig>) => {
    setOverride((prev) => ({ ...prev, ...partial }));
  }, []);

  const recordCall = useCallback(() => {
    callCountRef.current += 1;
    setCallCount(callCountRef.current);
  }, []);

  const maybeFail = useCallback(
    (context: string) => {
      if (state.failureRate > 0 && Math.random() < state.failureRate) {
        throw new Error(`Mock RPC sandbox: simulated ${context} failure`);
      }
    },
    [state.failureRate],
  );

  const getAccount = useCallback(
    async (publicKey: string): Promise<MockAccountResult> => {
      recordCall();
      await delay(state.latencyMs);
      maybeFail("getAccount");
      return {
        accountId: publicKey,
        sequence: String(Date.now()),
        balances: Object.entries(state.accountBalances).map(([asset, amount]) => ({ asset, amount })),
      };
    },
    [state.latencyMs, state.accountBalances, maybeFail, recordCall],
  );

  const simulateTransaction = useCallback(async (): Promise<MockSimulateResult> => {
    recordCall();
    await delay(state.latencyMs);
    try {
      maybeFail("simulateTransaction");
      return { status: "SUCCESS", minResourceFee: "100000", latencyMs: state.latencyMs };
    } catch (err) {
      return {
        status: "ERROR",
        minResourceFee: "0",
        latencyMs: state.latencyMs,
        error: err instanceof Error ? err.message : "Simulation failed",
      };
    }
  }, [state.latencyMs, maybeFail, recordCall]);

  const sendTransaction = useCallback(async (): Promise<MockSendResult> => {
    recordCall();
    await delay(state.latencyMs);
    const hash = randomHash();
    try {
      maybeFail("sendTransaction");
      return { status: "SUCCESS", hash, latencyMs: state.latencyMs };
    } catch (err) {
      return {
        status: "FAILED",
        hash,
        latencyMs: state.latencyMs,
        error: err instanceof Error ? err.message : "Transaction failed",
      };
    }
  }, [state.latencyMs, maybeFail, recordCall]);

  const getLatestLedger = useCallback(async (): Promise<MockLedgerResult> => {
    recordCall();
    await delay(state.latencyMs);
    maybeFail("getLatestLedger");
    ledgerRef.current += 1;
    return {
      sequence: ledgerRef.current,
      protocolVersion: 21,
      closeTime: new Date().toISOString(),
    };
  }, [state.latencyMs, maybeFail, recordCall]);

  const value = useMemo<MockRpcSandboxContextType>(
    () => ({
      config: state,
      updateConfig,
      callCount,
      getAccount,
      simulateTransaction,
      sendTransaction,
      getLatestLedger,
    }),
    [state, updateConfig, callCount, getAccount, simulateTransaction, sendTransaction, getLatestLedger],
  );

  return <MockRpcSandboxContext.Provider value={value}>{children}</MockRpcSandboxContext.Provider>;
}

export function useMockRpcSandbox(): MockRpcSandboxContextType {
  const ctx = useContext(MockRpcSandboxContext);
  if (!ctx) {
    throw new Error("useMockRpcSandbox must be used within a MockRpcSandboxProvider");
  }
  return ctx;
}
