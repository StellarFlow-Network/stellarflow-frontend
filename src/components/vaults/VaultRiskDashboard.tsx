"use client";

import AtRiskVaultsTable from "./AtRiskVaultsTable";
import type { RiskVault } from "./vaultRisk";
import RecentLiquidations, { type LiquidationEvent } from "./RecentLiquidations";

const demoVaults: RiskVault[] = [
  { id: "vault-104", healthFactor: 1.24, debtUsd: 1200, collateralUsd: 1860, collateralSymbol: "XLM" },
  { id: "vault-102", healthFactor: 0.87, debtUsd: 5000, collateralUsd: 5437.5, collateralSymbol: "XLM" },
  { id: "vault-103", healthFactor: 1, debtUsd: 2000, collateralUsd: 2500, collateralSymbol: "USDC" },
  { id: "vault-101", healthFactor: 0.96, debtUsd: 750, collateralUsd: 900, collateralSymbol: "XLM" },
];

const demoEvents: LiquidationEvent[] = [
  { id: "event-1", vaultId: "vault-098", debtRepaidUsd: 640, occurredAt: "2026-10-16T10:30:00Z", network: "testnet", transactionHash: "a".repeat(64) },
  { id: "event-2", vaultId: "vault-099", debtRepaidUsd: 1250, occurredAt: "2026-10-16T11:15:00Z", network: "testnet", transactionHash: "b".repeat(64) },
];

export default function VaultRiskDashboard() {
  return (
    <section aria-labelledby="vault-risk-title" className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-6">
      <h2 id="vault-risk-title" className="text-2xl font-semibold">Vault risk dashboard</h2>
      <p className="mb-6 mt-2 text-sm text-amber-200">Demo data — vaults and transaction hashes are illustrative, not live protocol activity.</p>
      <AtRiskVaultsTable vaults={demoVaults} />
      <RecentLiquidations events={demoEvents} />
    </section>
  );
}
