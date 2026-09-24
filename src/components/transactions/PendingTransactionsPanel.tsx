"use client";

import React, { useState } from "react";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  NETWORK_CONFIGS,
  useOptionalNetwork,
} from "@/app/components/providers/NetworkProvider";
import { usePendingTransactionsFeed } from "@/hooks/usePendingTransactionsFeed";
import { usePendingTransaction } from "@/hooks/usePendingTransaction";
import { STUCK_THRESHOLD_MS, type NetworkContext } from "@/lib/txSpeedUpOps";
import { TxSpeedUpModal } from "@/components/transactions/TxSpeedUpModal";
import type { DemoPendingTransfer } from "@/lib/demoPendingTransactions";

interface PendingRowProps {
  transfer: DemoPendingTransfer;
  network: NetworkContext;
  onManage: (transfer: DemoPendingTransfer) => void;
}

function PendingRow({ transfer, network, onManage }: PendingRowProps) {
  const { elapsedMs, isStuck } = usePendingTransaction({
    hash: transfer.pending.hash,
    submittedAt: transfer.pending.submittedAt,
    horizonUrl: network.horizonUrl,
    enabled: true,
  });

  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <li className="flex items-center justify-between gap-4 border-b border-gray-800/60 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-200">{transfer.description}</p>
        <p className="mt-0.5 font-mono text-[11px] text-gray-600">
          {transfer.pending.hash.slice(0, 10)}…{transfer.pending.hash.slice(-6)}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isStuck
              ? "border-amber-500/40 bg-amber-950/20 text-amber-400"
              : "border-gray-700/60 bg-gray-900/40 text-gray-500"
          }`}
        >
          <Icon id={isStuck ? ICON_IDS.alertTriangle : ICON_IDS.clock} size={11} />
          Pending {seconds}s
        </span>

        <button
          type="button"
          onClick={() => onManage(transfer)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-blue-500/60 hover:text-blue-300"
        >
          <Icon id={ICON_IDS.zap} size={12} />
          Speed Up / Cancel
        </button>
      </div>
    </li>
  );
}

/**
 * Surfaces submissions that have sat unconfirmed for more than
 * {@link STUCK_THRESHOLD_MS} and offers the fee-bump / cancel rescue flow
 * from {@link TxSpeedUpModal}.
 */
export function PendingTransactionsPanel() {
  const networkContext = useOptionalNetwork();
  const network: NetworkContext =
    networkContext?.config ?? NETWORK_CONFIGS.testnet;

  const { transfers, isLoading, error } = usePendingTransactionsFeed(network);
  const [active, setActive] = useState<DemoPendingTransfer | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4 text-sm text-gray-500">
        Checking for pending submissions…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-4 text-sm text-rose-300"
      >
        {error}
      </div>
    );
  }

  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] text-gray-100">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Icon id={ICON_IDS.clock} size={15} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-gray-100">
          Pending Transactions
        </h2>
        <span className="ml-auto text-[11px] text-gray-600">
          Rescue options unlock after {STUCK_THRESHOLD_MS / 1000}s unconfirmed
        </span>
      </div>

      <ul>
        {transfers.map((transfer) => (
          <PendingRow
            key={transfer.id}
            transfer={transfer}
            network={network}
            onManage={setActive}
          />
        ))}
      </ul>

      {active && (
        <TxSpeedUpModal
          isOpen
          onClose={() => setActive(null)}
          pending={active.pending}
          description={active.description}
          network={network}
          onReplaced={() => setActive(null)}
        />
      )}
    </div>
  );
}

export default PendingTransactionsPanel;
