"use client";

/**
 * MultisigNotificationBadge (#962)
 *
 * Top-bar counter for multisig envelopes blocked on the connected co-signer.
 * Renders nothing at zero so the header stays clean, and links straight into
 * the multisig queue pre-filtered to the requests awaiting this wallet.
 */

import React from "react";
import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  buildMultisigApprovalDeepLink,
  type MultisigSignatureRequest,
} from "@/services/multisigNotifications";
import { useOptionalMultisigNotifications } from "./MultisigNotificationProvider";

export interface MultisigNotificationBadgeProps {
  className?: string;
}

function buildTooltip(pending: MultisigSignatureRequest[]): string {
  const preview = pending
    .slice(0, 3)
    .map((request) => `${request.id} — ${request.title}`)
    .join("\n");
  const remaining = pending.length - 3;
  return [
    `${pending.length} pending multisig transaction${
      pending.length === 1 ? "" : "s"
    } awaiting your signature`,
    preview,
    remaining > 0 ? `+${remaining} more` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function MultisigNotificationBadge({
  className,
}: MultisigNotificationBadgeProps) {
  const notifications = useOptionalMultisigNotifications();

  const pendingCount = notifications?.pendingCount ?? 0;
  const pendingRequests = notifications?.pendingRequests ?? [];

  if (pendingCount === 0) {
    // Keep the live region mounted so screen readers hear the counter go to
    // zero once the last request is signed.
    return (
      <span className="sr-only" role="status" aria-live="polite">
        {""}
      </span>
    );
  }

  const label = `${pendingCount} pending multisig transaction${
    pendingCount === 1 ? "" : "s"
  } awaiting your signature`;

  return (
    <Link
      href={buildMultisigApprovalDeepLink()}
      data-testid="multisig-notification-badge"
      className={[
        "group relative inline-flex items-center gap-1.5 rounded-full border border-[#f5c842]/40 bg-[#f5c842]/10 px-2.5 py-1 text-[11px] font-semibold text-[#f5c842] transition-colors hover:border-[#f5c842]/70 hover:bg-[#f5c842]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c842]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={buildTooltip(pendingRequests)}
      aria-label={`Open multisig approval drawer — ${label}`}
    >
      <Icon id={ICON_IDS.shieldCheck} size={13} aria-hidden="true" />
      <span className="hidden sm:inline">Awaiting signature</span>
      <span
        aria-hidden="true"
        data-testid="multisig-notification-count"
        className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#f5c842] px-1 font-mono text-[10px] font-bold text-[#071016]"
      >
        {pendingCount > 99 ? "99+" : pendingCount}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
    </Link>
  );
}

export default MultisigNotificationBadge;
