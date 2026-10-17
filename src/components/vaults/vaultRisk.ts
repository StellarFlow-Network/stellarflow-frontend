export interface RiskVault {
  id: string;
  healthFactor: number;
  debtUsd: number;
  collateralUsd: number;
  collateralSymbol: string;
}

export type VaultSortKey = "healthFactor" | "debtUsd" | "collateralUsd";
export type SortDirection = "ascending" | "descending";

export function sortAtRiskVaults(
  vaults: readonly RiskVault[],
  key: VaultSortKey = "healthFactor",
  direction: SortDirection = "ascending",
): RiskVault[] {
  return vaults.filter((vault) =>
    Number.isFinite(vault.healthFactor) && vault.healthFactor >= 0 && vault.healthFactor <= 1.5,
  ).sort((a, b) => {
    const difference = a[key] - b[key];
    return (direction === "ascending" ? difference : -difference) || a.id.localeCompare(b.id);
  });
}

export const formatRiskUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

