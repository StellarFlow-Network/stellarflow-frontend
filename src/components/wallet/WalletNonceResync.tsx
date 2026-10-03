"use client";

import React from "react";
import { useWalletNonceResync } from "./useWalletNonceResync";
import { useWallet } from "@/app/components/providers/WalletProvider";
import { useToast } from "@/components/ui/ToastQueue";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";

export function WalletNonceResync() {
  const { wallet } = useWallet();
  const { addToast, updateToast } = useToast();
  const { resyncNonce, isResyncing, lastResyncedAt, lastSequence } = useWalletNonceResync();

  const handleResync = async () => {
    if (!wallet?.publicKey) return;

    const toastId = addToast({
      title: "Resynchronizing nonce…",
      description: "Fetching latest sequence number from Horizon",
      status: "processing",
    });

    const result = await resyncNonce();

    if (result.success) {
      updateToast(toastId, {
        title: "Nonce resynchronized",
        description: `Sequence updated to ${result.sequence}`,
        status: "confirmed",
      });
    } else {
      updateToast(toastId, {
        title: "Resync failed",
        description: result.error ?? "Could not fetch sequence number",
        status: "failed",
      });
    }
  };

  if (!wallet?.connected || !wallet?.publicKey) {
    return (
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-600/20 flex items-center justify-center">
              <Icon id={ICON_IDS.refreshCcw} size={20} className="text-gray-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Nonce Resynchronization</h3>
              <p className="text-sm text-gray-500">Connect your wallet to resync the sequence number</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Icon id={ICON_IDS.refreshCcw} size={20} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">Nonce Resynchronization</h3>
            <p className="text-sm text-gray-500">
              Resolve sequence number mismatches that can cause transaction failures
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Wallet Address</p>
            <p className="font-mono text-sm text-gray-300 truncate">{wallet.publicKey}</p>
          </div>
          <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Sequence</p>
            <p className="font-mono text-sm text-gray-300">{lastSequence ?? "Unknown"}</p>
          </div>
        </div>

        <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Last Resynced</p>
              <p className="text-sm text-gray-300">{formatTimestamp(lastResyncedAt)}</p>
            </div>
            <button
              onClick={handleResync}
              disabled={isResyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Icon
                id={ICON_IDS.refreshCcw}
                size={16}
                className={isResyncing ? "animate-spin" : ""}
              />
              {isResyncing ? "Resyncing…" : "Resync Nonce"}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="font-medium text-yellow-400 mb-1">When to use this:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Transactions are failing with bad sequence errors</li>
            <li>Multiple transactions submitted rapidly from the same account</li>
            <li>After network congestion or failed transaction submissions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}