"use client";

/**
 * ContractVersionBadge.tsx
 *
 * Visual badge indicator that surfaces a Soroban contract's version tag
 * (e.g. "v1.0", "v2.0-beta") alongside an action title so users immediately
 * know whether they are interacting with a legacy or current deployment.
 *
 * Colour convention:
 *   • current  — green  (latest / live deployment)
 *   • legacy   — amber  (older deployment that is still reachable)
 *   • beta     — violet (pre-release tag: beta / alpha / rc / preview)
 *   • unknown  — slate  (network metadata unavailable or un-annotated)
 *
 * Usage:
 *   <ContractVersionBadge contractId="C…" />
 *   <ContractVersionBadge version="v2.0-beta" kind="beta" />   // static
 *   <ContractVersionBadge contractId="C…" showHash />          // + wasm short
 */

import React, { useState } from "react";
import type {
  ContractVersionInfo,
  ContractVersionKind,
} from "@/types/contractVersion";
import { useContractVersion } from "@/hooks/useContractVersion";

type BadgeTone = {
  label: string;
  dot: string;
  badge: string;
  ring: string;
};

const TONE_BY_KIND: Record<ContractVersionKind, BadgeTone> = {
  current: {
    label: "Current",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    ring: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
  },
  legacy: {
    label: "Legacy",
    dot: "bg-amber-400",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    ring: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
  },
  beta: {
    label: "Beta",
    dot: "bg-violet-400",
    badge: "bg-violet-500/10 text-violet-300 border-violet-500/30",
    ring: "shadow-[0_0_12px_rgba(139,92,246,0.25)]",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    ring: "",
  },
};

export interface ContractVersionBadgeProps {
  /** Contract id (C…) used to read version metadata from the network. */
  contractId?: string;
  /** Pre-supplied version tag — skips network reads entirely. */
  version?: string;
  /** Pre-supplied classification when `version` is provided. */
  kind?: ContractVersionKind;
  /** Soroban RPC / Horizon URL override. */
  rpcUrl?: string;
  /** Known wasm hash fast-path (avoids a network round-trip). */
  fallbackWasmHash?: string;
  /** Also render the short wasm hash in a tooltip / side label. */
  showHash?: boolean;
  /** Show a subtle "Current/Legacy/Beta" classification label too. */
  showKind?: boolean;
  /** Hide the badge entirely when version metadata cannot be resolved. */
  hideOnError?: boolean;
  /** Additional CSS classes applied to the outer wrapper. */
  className?: string;
  /** Accessible label. Defaults to a sensible human-readable reading. */
  "aria-label"?: string;
}

export const ContractVersionBadge = React.memo(function ContractVersionBadge({
  contractId,
  version,
  kind,
  rpcUrl,
  fallbackWasmHash,
  showHash = false,
  showKind = false,
  hideOnError = false,
  className = "",
  "aria-label": ariaLabel,
}: ContractVersionBadgeProps) {
  const networkResult = useContractVersion(contractId, { rpcUrl, fallbackWasmHash });
  const [hovered, setHovered] = useState(false);

  // Precedence: explicitly-supplied props > network result > nothing.
  const info: Pick<ContractVersionInfo, "version" | "kind" | "wasmHashShort"> | null =
    version !== undefined
      ? {
          version,
          kind: kind ?? deriveKind(version),
          wasmHashShort: fallbackWasmHash
            ? shortenLocal(fallbackWasmHash)
            : "",
        }
      : networkResult.status === "success"
        ? networkResult.data
        : null;

  if (!info) {
    if (hideOnError) return null;
    // Fall back to a slate "unknown" badge when nothing could be resolved.
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-600/40 bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
        version ?
      </span>
    );
  }

  const tone = TONE_BY_KIND[info.kind] ?? TONE_BY_KIND.unknown;
  const label = ariaLabel ?? `${info.version}${showKind ? `, ${tone.label.toLowerCase()} deployment` : ""}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-shadow ${tone.badge} ${tone.ring} ${className}`}
      role="status"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      <span className="font-mono">{info.version}</span>
      {showKind && (
        <span className="text-[9px] uppercase tracking-wider text-current/70 opacity-70">
          {tone.label}
        </span>
      )}
      {showHash && info.wasmHashShort && (
        <span
          className="ml-0.5 hidden text-[9px] font-mono text-current/60 opacity-60 sm:inline"
          title={hovered ? undefined : "wasm hash"}
        >
          {info.wasmHashShort}
        </span>
      )}
    </span>
  );
});

function deriveKind(version: string): ContractVersionKind {
  if (/(^|[-.\s])(beta|alpha|rc|preview|dev)/i.test(version)) return "beta";
  return "unknown";
}

function shortenLocal(hash: string, head = 4, tail = 4): string {
  const clean = (hash || "").replace(/^0x/i, "").toLowerCase();
  if (clean.length <= head + tail) return clean || "";
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

ContractVersionBadge.displayName = "ContractVersionBadge";
