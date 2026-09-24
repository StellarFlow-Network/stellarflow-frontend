"use client";

/**
 * PortfolioSummary — Dashboard portfolio tracker section.
 *
 * Updated for #762: renders the granular wallet-balance breakdown panel and
 * the per-asset stacked bar chart below the existing net-worth cards.
 */

import { PieChart, Wallet, Droplets, Vault, BarChart2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { usePortfolioWithFallback } from "@/app/hooks/usePortfolio";
import PortfolioAllocationChart from "./PortfolioAllocationChart";
import PortfolioHistoryChart from "./PortfolioHistoryChart";
import WalletBalanceBreakdown from "./WalletBalanceBreakdown";
import AssetBreakdownStackedBar from "./AssetBreakdownStackedBar";
import { SkeletonCard } from "@/components/skeletons/SkeletonCard";
import { SkeletonChart } from "@/components/skeletons/SkeletonChart";

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function PortfolioSummary() {
  const { data, isLoading, isFetching } = usePortfolioWithFallback();
  const {
    totalNetWorthUsd,
    changePercent24h,
    balances,
    allocation,
    history,
    breakdownByAsset,
  } = data;
  const isPositive24h = changePercent24h >= 0;
  const router = useRouter();

  // Quick-action navigation callbacks
  const goToWallet = useCallback(() => router.push("/dashboard/portfolio"), [router]);
  const goToOrders = useCallback(() => router.push("/dashboard/transactions"), [router]);
  const goToVaults = useCallback(() => router.push("/staking"), [router]);
  const goToPools = useCallback(() => router.push("/pools"), [router]);

  // Show skeletons during initial load
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Net worth header skeleton */}
        <SkeletonCard variant="stats" count={1} />

        {/* History + Allocation skeletons */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SkeletonChart variant="portfolio" height={300} showTimeframes />
          </div>
          <div>
            <SkeletonChart variant="allocation" height={300} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Net worth header ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              Total Net Worth
            </span>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-4xl font-bold text-neutral-100">
                {formatUsd(totalNetWorthUsd)}
              </span>
              <span
                className={`font-mono text-sm font-semibold ${
                  isPositive24h ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isPositive24h ? "+" : ""}
                {changePercent24h.toFixed(2)}% (24h)
              </span>
            </div>
          </div>

          <span
            className={`h-2 w-2 rounded-full ${
              isFetching ? "animate-pulse bg-amber-500" : "bg-emerald-500"
            }`}
            aria-hidden
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BalanceCard
            icon={<Wallet size={16} className="text-blue-400" />}
            label="Wallet"
            valueUsd={balances.walletUsd}
          />
          <BalanceCard
            icon={<Droplets size={16} className="text-cyan-400" />}
            label="Liquidity Pools"
            valueUsd={balances.liquidityPoolsUsd}
          />
          <BalanceCard
            icon={<Vault size={16} className="text-purple-400" />}
            label="Vaults"
            valueUsd={balances.vaultsUsd}
          />
        </div>
      </div>

      {/* ── History + Allocation ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 xl:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-neutral-200">
            Net Worth History
          </h2>
          <PortfolioHistoryChart history={history} />
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-neutral-400" />
            <h2 className="text-lg font-semibold text-neutral-200">
              Allocation
            </h2>
          </div>
          <PortfolioAllocationChart allocation={allocation} />
        </div>
      </div>

      {/* ── Granular balance breakdown by protocol-lock category (#762) ───── */}
      {breakdownByAsset.length > 0 && (
        <>
          <WalletBalanceBreakdown
            breakdownByAsset={breakdownByAsset}
            onManageAvailable={goToWallet}
            onManageLimitOrders={goToOrders}
            onManageVaults={goToVaults}
            onManagePools={goToPools}
          />

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart2 size={16} className="text-neutral-400" />
              <h2 className="text-lg font-semibold text-neutral-200">
                Asset Distribution by Lock Type
              </h2>
              <p className="ml-auto text-xs text-neutral-500">USD value</p>
            </div>
            <AssetBreakdownStackedBar breakdownByAsset={breakdownByAsset} />
          </div>
        </>
      )}
    </div>
  );
}

function BalanceCard({
  icon,
  label,
  valueUsd,
}: {
  icon: React.ReactNode;
  label: string;
  valueUsd: number;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <span className="mt-1 block font-mono text-xl font-semibold text-neutral-100">
        {formatUsd(valueUsd)}
      </span>
    </div>
  );
}
