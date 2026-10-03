"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Shield,
  UserCheck,
  XCircle,
  Key,
  RotateCcw,
  PenTool,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

export type SignerStatus = "approved" | "pending" | "revoked";

export interface CoSigner {
  publicKey: string;
  name?: string;
  role?: string;
  weight: number;
  status: SignerStatus;
  signedAt?: string;
  signatureHex?: string;
}

export interface SignatureStatusCardProps {
  signer: CoSigner;
  isCurrentUser?: boolean;
  canSign?: boolean;
  canRevoke?: boolean;
  isSubmitting?: boolean;
  onApprove?: (publicKey: string) => void;
  onRevoke?: (publicKey: string) => void;
}

export function SignatureStatusCard({
  signer,
  isCurrentUser = false,
  canSign = false,
  canRevoke = false,
  isSubmitting = false,
  onApprove,
  onRevoke,
}: SignatureStatusCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(signer.publicKey);
      setCopied(true);
      triggerHaptic("tap");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncatedKey =
    signer.publicKey.length > 16
      ? `${signer.publicKey.slice(0, 8)}...${signer.publicKey.slice(-8)}`
      : signer.publicKey;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        signer.status === "approved"
          ? "border-emerald-500/30 bg-emerald-950/15"
          : signer.status === "revoked"
          ? "border-rose-500/30 bg-rose-950/15"
          : "border-white/10 bg-[#0d1a21]/80"
      } ${isCurrentUser ? "ring-1 ring-cyan-500/50" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Signer Identity */}
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
              signer.status === "approved"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : signer.status === "revoked"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                : "border-white/10 bg-white/5 text-slate-400"
            }`}
          >
            {signer.status === "approved" ? (
              <UserCheck size={18} />
            ) : signer.status === "revoked" ? (
              <XCircle size={18} />
            ) : (
              <Key size={18} />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-white">
                {signer.name || "Co-Signer"}
              </span>
              {isCurrentUser && (
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/40">
                  YOU
                </span>
              )}
              {signer.role && (
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  {signer.role}
                </span>
              )}
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                Weight: {signer.weight}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 font-mono text-xs text-slate-400 hover:text-cyan-300 transition"
                title="Click to copy full public key"
              >
                <span>{truncatedKey}</span>
                {copied ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          {signer.status === "approved" && (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                <CheckCircle2 size={13} /> Approved
              </span>
              {signer.signedAt && (
                <span className="mt-0.5 font-mono text-[10px] text-slate-400">
                  {new Date(signer.signedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}

          {signer.status === "pending" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
              <Clock size={13} className="animate-spin" /> Pending Approval
            </span>
          )}

          {signer.status === "revoked" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300">
              <XCircle size={13} /> Signature Revoked
            </span>
          )}

          {/* Quick Sign / Revoke Action Buttons if eligible */}
          {isCurrentUser && signer.status === "pending" && canSign && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onApprove?.(signer.publicKey)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#071016] transition hover:bg-emerald-400 disabled:opacity-50 shadow-md shadow-emerald-500/20"
            >
              <PenTool size={13} />
              <span>{isSubmitting ? "Signing..." : "Sign Now"}</span>
            </button>
          )}

          {isCurrentUser && signer.status === "approved" && canRevoke && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onRevoke?.(signer.publicKey)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
              title="Revoke your approval signature before transaction execution"
            >
              <RotateCcw size={12} />
              <span>Revoke</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SignatureStatusCard;
