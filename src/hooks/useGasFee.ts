"use client";

/**
 * useGasFee — Express gas fee preset hook.
 *
 * Polls the Horizon ledger endpoint every 10 seconds to fetch the latest
 * base fee (in stroops) and derives three express-fee presets:
 *
 *   Standard  — 1× base fee, ~1–2 ledgers inclusion (~5–10 s)
 *   Fast      — 1.5× base fee, next ledger inclusion (~3–5 s)
 *   Instant   — 3× base fee, immediate inclusion (~<3 s)
 *
 * The hook exposes the raw base fee, the derived tier data, the selected
 * tier, and a setter. The selected tier is persisted to localStorage so
 * the user's preference survives reloads.
 *
 * Design notes
 * ────────────
 *  • Pure `fetch` — no SDK import — to keep the bundle lean.
 *  • Network-target-aware: reads from `NetworkProvider` config.
 *  • SSR-safe: all window access guarded.
 *  • Cleans up the interval on unmount / network switch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NETWORK_CONFIGS,
  useOptionalNetwork,
  type NetworkTarget,
} from "@/app/components/providers/NetworkProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FeeTier = "standard" | "fast" | "instant";

export interface FeeTierPreset {
  /** Human-readable label */
  label: string;
  /** Fee multiplier applied to the current base fee */
  multiplier: number;
  /** Estimated block inclusion speed (human string) */
  estimatedSpeed: string;
  /** Estimated seconds until inclusion */
  estimatedSeconds: number;
  /** Computed fee for this tier in stroops */
  feeStroops: number;
  /** Computed fee for this tier in XLM */
  feeXLM: string;
}

export interface GasFeeSnapshot {
  /** Raw base fee from the latest ledger, in stroops */
  baseFeeStroops: number;
  /** Base fee expressed in XLM */
  baseFeeXLM: string;
  /** Ledger hash of the latest fetched ledger */
  ledgerHash: string;
  /** Sequence number of the latest fetched ledger */
  ledgerSequence: number;
  /** Timestamp when this snapshot was fetched */
  fetchedAt: number;
  /** The three tier presets derived from the current base fee */
  tiers: Record<FeeTier, FeeTierPreset>;
}

export interface UseGasFeeReturn {
  /** Latest gas fee snapshot (null before the first successful fetch) */
  snapshot: GasFeeSnapshot | null;
  /** Currently selected fee tier */
  selectedTier: FeeTier;
  /** Update the selected fee tier */
  setSelectedTier: (tier: FeeTier) => void;
  /** Whether the initial fetch is still in progress */
  isLoading: boolean;
  /** Error message from the last failed poll, or null */
  error: string | null;
  /** Force an immediate re-fetch outside of the poll interval */
  refresh: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** How often to poll Horizon for the latest ledger. */
const POLL_INTERVAL_MS = 10_000;

/** 1 XLM = 10 000 000 stroops */
const STROOPS_PER_XLM = 10_000_000;

/** localStorage key for persisting the selected tier. */
const STORAGE_KEY = "stellarflow.gasFee.tier";

/** The three express-fee presets. */
const TIER_DEFS: ReadonlyArray<{
  key: FeeTier;
  label: string;
  multiplier: number;
  estimatedSpeed: string;
  estimatedSeconds: number;
}> = [
  {
    key: "standard",
    label: "Standard",
    multiplier: 1,
    estimatedSpeed: "1–2 ledgers (~5–10 s)",
    estimatedSeconds: 7,
  },
  {
    key: "fast",
    label: "Fast",
    multiplier: 1.5,
    estimatedSpeed: "Next ledger (~3–5 s)",
    estimatedSeconds: 4,
  },
  {
    key: "instant",
    label: "Instant",
    multiplier: 3,
    estimatedSpeed: "Immediate (<3 s)",
    estimatedSeconds: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Persistence helpers (SSR-safe)
// ─────────────────────────────────────────────────────────────────────────────

function readPersistedTier(): FeeTier {
  if (typeof window === "undefined") return "standard";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "standard" || stored === "fast" || stored === "instant")
      return stored;
  } catch {
    // localStorage may be blocked
  }
  return "standard";
}

function persistTier(tier: FeeTier): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // best-effort
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizon fetcher
// ─────────────────────────────────────────────────────────────────────────────

interface HorizonLedgerResponse {
  _embedded?: {
    records?: Array<{
      base_fee: number;
      hash: string;
      sequence: number;
    }>;
  };
}

/**
 * Fetches the latest ledger from Horizon and extracts the base fee.
 * Uses plain `fetch` instead of the SDK to avoid bundle bloat.
 */
async function fetchLatestBaseFee(
  horizonUrl: string,
  timeoutMs: number = 8_000,
): Promise<{ baseFeeStroops: number; ledgerHash: string; ledgerSequence: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${horizonUrl}/ledgers?order=desc&limit=1`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Horizon responded with status ${res.status}`);
    }

    const data: HorizonLedgerResponse = await res.json();
    const record = data._embedded?.records?.[0];

    if (!record) {
      throw new Error("No ledger records returned from Horizon");
    }

    return {
      baseFeeStroops: record.base_fee,
      ledgerHash: record.hash,
      ledgerSequence: record.sequence,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useGasFee
 *
 * Polls Horizon every 10 seconds and exposes express-fee presets derived
 * from the current network base fee.
 *
 * @example
 * ```tsx
 * const { snapshot, selectedTier, setSelectedTier } = useGasFee();
 *
 * if (!snapshot) return <Spinner />;
 *
 * return (
 *   <div>
 *     <p>Base fee: {snapshot.baseFeeXLM} XLM</p>
 *     {Object.values(snapshot.tiers).map(tier => (
 *       <button key={tier.label} onClick={() => setSelectedTier(/* tier.key *\/)}>
 *         {tier.label} — {tier.feeXLM} XLM (~{tier.estimatedSpeed})
 *       </button>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useGasFee(
  networkOverride?: NetworkTarget,
): UseGasFeeReturn {
  const networkCtx = useOptionalNetwork();
  const activeNetwork = networkOverride ?? networkCtx?.network ?? "testnet";
  const horizonUrl = (networkCtx?.config ?? NETWORK_CONFIGS[activeNetwork]).horizonUrl;

  const [snapshot, setSnapshot] = useState<GasFeeSnapshot | null>(null);
  const [selectedTier, setSelectedTierState] = useState<FeeTier>(
    readPersistedTier,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Guard against state updates after unmount or network switch. */
  const generationRef = useRef(0);

  // Build tiers from a raw base fee
  const buildTiers = useCallback(
    (baseFeeStroops: number): Record<FeeTier, FeeTierPreset> => {
      const result = {} as Record<FeeTier, FeeTierPreset>;
      for (const def of TIER_DEFS) {
        const feeStroops = Math.ceil(baseFeeStroops * def.multiplier);
        result[def.key] = {
          label: def.label,
          multiplier: def.multiplier,
          estimatedSpeed: def.estimatedSpeed,
          estimatedSeconds: def.estimatedSeconds,
          feeStroops,
          feeXLM: (feeStroops / STROOPS_PER_XLM).toFixed(7).replace(/0+$/, "").replace(/\.$/, ""),
        };
      }
      return result;
    },
    [],
  );

  // Core fetch
  const fetchFee = useCallback(async () => {
    const gen = ++generationRef.current;

    try {
      const { baseFeeStroops, ledgerHash, ledgerSequence } =
        await fetchLatestBaseFee(horizonUrl);

      if (gen !== generationRef.current) return;

      setSnapshot({
        baseFeeStroops,
        baseFeeXLM: (baseFeeStroops / STROOPS_PER_XLM)
          .toFixed(7)
          .replace(/0+$/, "")
          .replace(/\.$/, ""),
        ledgerHash,
        ledgerSequence,
        fetchedAt: Date.now(),
        tiers: buildTiers(baseFeeStroops),
      });
      setError(null);
    } catch (err) {
      if (gen !== generationRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch network base fee",
      );
    } finally {
      if (gen === generationRef.current) {
        setIsLoading(false);
      }
    }
  }, [horizonUrl, buildTiers]);

  // Poll on mount and when network/horizonUrl changes
  useEffect(() => {
    generationRef.current++;
    setIsLoading(true);
    setSnapshot(null);
    setError(null);

    void fetchFee();
    const id = setInterval(() => void fetchFee(), POLL_INTERVAL_MS);

    return () => {
      generationRef.current++;
      clearInterval(id);
    };
  }, [fetchFee]);

  // Persist tier selection
  const setSelectedTier = useCallback((tier: FeeTier) => {
    setSelectedTierState(tier);
    persistTier(tier);
  }, []);

  return useMemo(
    () => ({
      snapshot,
      selectedTier,
      setSelectedTier,
      isLoading,
      error,
      refresh: () => void fetchFee(),
    }),
    [snapshot, selectedTier, setSelectedTier, isLoading, error, fetchFee],
  );
}
