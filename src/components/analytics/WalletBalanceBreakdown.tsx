"use client";

/**
 * WalletBalanceBreakdown — #762
 *
 * Renders a table of protocol-lock categories (Available, Limit Orders,
 * Vaults, Liquidity Pools) with the aggregate USD value held in each, plus
 * a quick-action button per row so the user can navigate directly to the
 * relevant management page.
 *
 * Props
 * ─────
 * breakdownByAsset   — per-asset breakdown array from PortfolioSummaryData
 * onManageAvailable  — called when the user clicks "Manage" on Available
 * onManageLimitOrders — called when the user clicks "Manage" on Limit Orders
 * onManageVaults      — called when the user clicks "Manage" on Vaults
 * onManagePools       — called when the user clicks "Manage" on Liquidity Pools
 *
 * All four `onManage*` props are optional; if omitted the button still renders
 * but the click is a no-op (useful in tests / storybook).
 */

import React, { useMemo } from "react";
import {
  Wallet,
  ClipboardList,
  Vault,
  Droplets,
  ChevronRight,
} from "lucide-react";
import type {
  AssetProtocolCategory,
  PerAssetBreakdown,
} from "@/types/portfolio";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletBalanceBreakdownProps {
  breakdownByAsset: PerAssetBreakdown[];
  onManageAvailable?: () => void;
  onManageLimitOrders?: () => void;
  onManageVaults?: () => void;
  onManagePools?: () => void;
}

interface CategoryRow {
  category: AssetProtocolCategory;
  label: string;
  description: string;
  /** Tailwind colour class for the accent dot */
  dotColor: string;
  /** Tailwind colour class for the action button text */
  buttonColor: string;
  icon: React.ReactNode;
  totalUsd: number;
  onManage?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sumCategory(
  assets: PerAssetBreakdown[],
  key: keyof PerAssetBreakdown["breakdown"],
): number {
  return assets.reduce((acc, a) => acc + a.breakdown[key], 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WalletBalanceBreakdown({
  breakdownByAsset,
  onManageAvailable,
  onManageLimitOrders,
  onManageVaults,
  onManagePools,
}: WalletBalanceBreakdownProps) {
  const rows: CategoryRow[] = useMemo(
    () => [
      {
        category: "available",
        label: "Available",
        description: "Freely transferable balance in wallet",
        dotColor: "bg-emerald-400",
        buttonColor: "text-emerald-400 hover:text-emerald-300",
        icon: <Wallet size={16} aria-hidden="true" />,
        totalUsd: sumCategory(breakdownByAsset, "availableUsd"),
        onManage: onManageAvailable,
      },
      {
        category: "limitOrders",
        label: "Locked in Limit Orders",
        description: "Amounts reserved inside open limit-order contracts",
        dotColor: "bg-amber-400",
        buttonColor: "text-amber-400 hover:text-amber-300",
        icon: <ClipboardList size={16} aria-hidden="true" />,
        totalUsd: sumCategory(breakdownByAsset, "limitOrdersUsd"),
        onManage: onManageLimitOrders,
      },
      {
        category: "vaults",
        label: "Staked in Vaults",
        description: "Deposits earning yield inside protocol vaults",
        dotColor: "bg-purple-400",
        buttonColor: "text-purple-400 hover:text-purple-300",
        icon: <Vault size={16} aria-hidden="true" />,
        totalUsd: sumCategory(breakdownByAsset, "vaultsUsd"),
        onManage: onManageVaults,
      },
      {
        category: "liquidityPools",
        label: "Held in Liquidity Pools",
        description: "Amounts committed as AMM liquidity",
        dotColor: "bg-cyan-400",
        buttonColor: "text-cyan-400 hover:text-cyan-300",
        icon: <Droplets size={16} aria-hidden="true" />,
        totalUsd: sumCategory(breakdownByAsset, "liquidityPoolsUsd"),
        onManage: onManagePools,
      },
    ],
    [
      breakdownByAsset,
      onManageAvailable,
      onManageLimitOrders,
      onManageVaults,
      onManagePools,
    ],
  );

  const grandTotal = useMemo(
    () => rows.reduce((acc, r) => acc + r.totalUsd, 0),
    [rows],
  );

  return (
    <section
      aria-label="Wallet balance breakdown by protocol lock"
      className="rounded-xl border border-neutral-800 bg-neutral-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Balance Breakdown
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Itemised by protocol-lock category
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-neutral-200">
          {formatUsd(grandTotal)}
        </span>
      </div>

      {/* Category rows */}
      <ul role="list" className="divide-y divide-neutral-800/60">
        {rows.map((row) => {
          const pct = grandTotal > 0 ? (row.totalUsd / grandTotal) * 100 : 0;

          return (
            <li
              key={row.category}
              data-testid={`breakdown-row-${row.category}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-neutral-800/30"
            >
              {/* Icon + accent dot */}
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                {row.icon}
                <span
                  className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 ${row.dotColor}`}
                  aria-hidden="true"
                />
              </div>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-200">
                  {row.label}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {row.description}
                </p>
                {/* Inline progress bar */}
                <div
                  className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full rounded-full ${row.dotColor}`}
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
              </div>

              {/* Amount + percentage */}
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold text-neutral-100">
                  {formatUsd(row.totalUsd)}
                </p>
                <p className="font-mono text-xs text-neutral-500">
                  {pct.toFixed(1)}%
                </p>
              </div>

              {/* Quick-action button */}
              <button
                type="button"
                aria-label={`Manage ${row.label}`}
                data-testid={`manage-btn-${row.category}`}
                onClick={row.onManage}
                className={`flex shrink-0 items-center gap-0.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${row.buttonColor}`}
              >
                Manage
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Per-asset mini summary */}
      {breakdownByAsset.length > 0 && (
        <div className="border-t border-neutral-800/60 px-5 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Assets ({breakdownByAsset.length})
          </p>
          <ul className="flex flex-wrap gap-2">
            {breakdownByAsset.map((asset) => (
              <li
                key={asset.symbol}
                className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-950/60 px-2.5 py-0.5 text-xs text-neutral-400"
              >
                <span className="font-semibold text-neutral-200">
                  {asset.symbol}
                </span>
                <span>{formatUsd(asset.totalUsd)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
