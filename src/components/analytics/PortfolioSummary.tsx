"use client";

import { PieChart, Wallet, Droplets, Vault } from "lucide-react";
import { usePortfolioWithFallback } from "@/app/hooks/usePortfolio";
import PortfolioAllocationChart from "./PortfolioAllocationChart";
import PortfolioHistoryChart from "./PortfolioHistoryChart";

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function PortfolioSummary() {
  const { data, isLoading, isFetching } = usePortfolioWithFallback();
  const { totalNetWorthUsd, changePercent24h, balances, allocation, history } = data;
  const isPositive24h = changePercent24h >= 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              Total Net Worth
            </span>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-4xl font-bold text-neutral-100">
                {isLoading ? "—" : formatUsd(totalNetWorthUsd)}
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
            <h2 className="text-lg font-semibold text-neutral-200">Allocation</h2>
          </div>
          <PortfolioAllocationChart allocation={allocation} />
        </div>
      </div>
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
