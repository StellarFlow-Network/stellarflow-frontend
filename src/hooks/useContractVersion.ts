"use client";

/**
 * useContractVersion.ts
 *
 * React hook that reads a Soroban contract's version metadata from the
 * network and exposes it as a stateful `ContractVersionResult` suitable for
 * rendering a <ContractVersionBadge />.
 *
 * The hook is resilient:
 *   • Returns `loading` while the RPC read is in-flight.
 *   • Returns `success` with the metadata when the wasm hash resolves.
 *   • Returns `error` when the contract/rpc cannot be reached, so the UI can
 *     hide or annotate the badge rather than crashing.
 */

import { useEffect, useState } from "react";
import type { ContractVersionInfo, ContractVersionResult } from "@/types/contractVersion";
import { getContractVersionInfo, getCachedContractVersion } from "@/services/contractVersionService";

export interface UseContractVersionOptions {
  /** Soroban RPC / Horizon URL override. Defaults to the active RPC node. */
  rpcUrl?: string;
  /** Known wasm hash used as an offline/instant fallback (skips network). */
  fallbackWasmHash?: string;
  /** Skip fetching entirely (e.g. when a fixed tag should be shown). */
  enabled?: boolean;
}

export function useContractVersion(
  contractId?: string,
  options: UseContractVersionOptions = {},
): ContractVersionResult {
  const { rpcUrl, fallbackWasmHash, enabled = true } = options;
  const [result, setResult] = useState<ContractVersionResult>({ status: "loading" });

  useEffect(() => {
    let isActive = true;

    // Offline fast-path: derive purely from a known wasm hash.
    if (fallbackWasmHash) {
      const info = getCachedContractVersion(fallbackWasmHash);
      if (isActive) {
        setResult(
          info
            ? { status: "success", data: info }
            : { status: "error", message: "No cached version for supplied wasm hash." },
        );
      }
      return;
    }

    if (!enabled || !contractId) {
      if (isActive) {
        setResult({ status: "success", data: emptyInfo(contractId) });
      }
      return;
    }

    let cancelled = false;
    setResult({ status: "loading" });

    getContractVersionInfo(contractId, rpcUrl)
      .then((info: ContractVersionInfo | null) => {
        if (cancelled || !isActive) return;
        setResult(
          info
            ? { status: "success", data: info }
            : { status: "error", message: "Unable to read contract version from network." },
        );
      })
      .catch((error: unknown) => {
        if (cancelled || !isActive) return;
        setResult({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown contract version.",
        });
      });

    return () => {
      cancelled = true;
      isActive = false;
    };
  }, [contractId, rpcUrl, fallbackWasmHash, enabled]);

  return result;
}

function emptyInfo(contractId?: string): ContractVersionInfo {
  const id = (contractId ?? "unknown").trim();
  return {
    wasmHash: id,
    wasmHashShort: id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id,
    version: "unknown",
    kind: "unknown",
    isLatest: false,
  };
}
