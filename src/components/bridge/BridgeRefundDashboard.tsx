"use client";

import React from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { useBridgeRefunds } from "@/hooks/useBridgeRefunds";
import { BridgeRefundCard } from "@/components/bridge/BridgeRefundCard";

/**
 * Automated recovery UI for cross-chain bridge transfers that timed out or
 * fell short of validator threshold verification: detects failed transfers
 * out of account activity, offers a one-click "Trigger Refund" claim, and
 * tracks unlock progress across the origin chain.
 */
export function BridgeRefundDashboard() {
  const { transfers, isLoading, error, progressById, triggerRefund, refetch } =
    useBridgeRefunds();

  const failedCount = transfers.filter((t) => t.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#161b22] p-4">
        <div className="flex items-center gap-2">
          <Icon id={ICON_IDS.network} size={16} className="text-blue-400" />
          <div>
            <h2 className="text-sm font-semibold text-gray-100">
              Bridge Transfer Recovery
            </h2>
            <p className="text-xs text-gray-500">
              {failedCount > 0
                ? `${failedCount} transfer${failedCount === 1 ? "" : "s"} need${
                    failedCount === 1 ? "s" : ""
                  } a refund claim.`
                : "No failed bridge transfers detected."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-800"
        >
          <Icon id={ICON_IDS.refreshCcw} size={12} />
          Rescan Activity
        </button>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-gray-800 bg-[#161b22] p-6 text-center text-sm text-gray-500">
          Scanning account activity for failed bridge transfers…
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-4 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      {!isLoading && !error && transfers.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-[#161b22] p-8 text-center text-sm text-gray-500">
          No bridge transfers found in your account activity.
        </div>
      )}

      {!isLoading &&
        transfers.map((transfer) => (
          <BridgeRefundCard
            key={transfer.id}
            transfer={transfer}
            progress={progressById[transfer.id]}
            onTriggerRefund={triggerRefund}
          />
        ))}
    </div>
  );
}

export default BridgeRefundDashboard;
