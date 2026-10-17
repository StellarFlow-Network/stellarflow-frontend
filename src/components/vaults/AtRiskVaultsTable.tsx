"use client";

import { useEffect, useState } from "react";
import LiquidationConfirmationDrawer from "./LiquidationConfirmationDrawer";

import { sortAtRiskVaults, formatRiskUsd, type RiskVault, type VaultSortKey, type SortDirection } from "./vaultRisk";

interface Props {
  vaults: readonly RiskVault[];
  onConfirmLiquidation?: (vaultId: string) => Promise<void>;
}

export default function AtRiskVaultsTable({ vaults, onConfirmLiquidation }: Props) {
  const [sort, setSort] = useState<{ key: VaultSortKey; direction: SortDirection }>({
    key: "healthFactor", direction: "ascending",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = sortAtRiskVaults(vaults, sort.key, sort.direction);
  // Resolve the latest row instead of retaining a stale snapshot in the drawer.
  const selected = rows.find((vault) => vault.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId !== null && selected === null) setSelectedId(null);
  }, [selectedId, selected]);
  const columns: { key: VaultSortKey; label: string }[] = [
    { key: "healthFactor", label: "Health factor" },
    { key: "debtUsd", label: "Debt amount (USD)" },
    { key: "collateralUsd", label: "Collateral (USD)" },
  ];

  function changeSort(key: VaultSortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm text-slate-100">
          <caption className="p-4 text-left text-slate-300">
            At-risk vaults · Health factor at or below 1.5. Liquidation requires H &lt; 1.0.
          </caption>
          <thead className="bg-slate-900 text-slate-200">
            <tr>
              <th scope="col" className="p-4">Vault ID</th>
              {columns.map(({ key, label }) => (
                <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction : "none"} className="p-4">
                  <button type="button" onClick={() => changeSort(key)} className="rounded py-1 text-left focus-visible:outline-2 focus-visible:outline-emerald-400">
                    {label} <span aria-hidden="true">{sort.key === key ? (sort.direction === "ascending" ? "↑" : "↓") : "↕"}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((vault) => (
              <tr key={vault.id} className="border-t border-slate-800">
                <th scope="row" className="p-4 font-mono font-medium">{vault.id}</th>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-1 ${vault.healthFactor < 1 ? "bg-red-950 text-red-200" : "bg-amber-950 text-amber-200"}`}>
                    {vault.healthFactor} · {vault.healthFactor < 1 ? "Liquidatable" : "At risk"}
                  </span>
                </td>
                <td className="p-4 tabular-nums">{formatRiskUsd(vault.debtUsd)}</td>
                <td className="p-4 tabular-nums">{formatRiskUsd(vault.collateralUsd)} <span className="text-slate-400">{vault.collateralSymbol}</span></td>
                <td className="p-4">
                  <button type="button" disabled={vault.healthFactor >= 1} aria-label={`Liquidate vault ${vault.id}`}
                    onClick={() => setSelectedId(vault.id)}
                    className="rounded-lg bg-red-700 px-3 py-2 font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400">
                    Liquidate
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No at-risk vaults.</td></tr>}
          </tbody>
        </table>
      </div>
      <LiquidationConfirmationDrawer key={selectedId ?? "closed"} vault={selected} onClose={() => setSelectedId(null)} onConfirm={onConfirmLiquidation} />
    </>
  );
}
