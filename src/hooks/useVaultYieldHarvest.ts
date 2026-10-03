"use client";

import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YieldPathNode {
  id: string;
  label: string;
  sublabel?: string;
  value?: string;
  type: "source" | "router" | "vault" | "pool";
}

export interface YieldPathEdge {
  from: string;
  to: string;
  label: string;
  /** USD flow amount */
  amount: number;
}

export interface PoolAllocation {
  poolId: string;
  pair: string;
  allocationPercent: number;
  tvlUsd: number;
  feeApr: number;
  dailyFeesUsd: number;
}

export interface HarvestEvent {
  id: string;
  /** ISO-8601 */
  timestamp: string;
  txHash: string;
  totalHarvestedUsd: number;
  compoundedShares: number;
  /** Fee revenue harvested per underlying pool */
  poolBreakdown: {
    poolId: string;
    pair: string;
    harvestedUsd: number;
  }[];
  status: "confirmed" | "pending";
}

export interface VaultYieldData {
  vault: {
    id: string;
    name: string;
    totalValueLockedUsd: number;
    currentApyPercent: number;
    totalSharesMinted: number;
    sharePrice: number; // USD per share
    pendingHarvestUsd: number;
  };
  yieldPath: {
    nodes: YieldPathNode[];
    edges: YieldPathEdge[];
  };
  poolAllocations: PoolAllocation[];
  harvestEvents: HarvestEvent[];
}

// ---------------------------------------------------------------------------
// Mock data generator
// ---------------------------------------------------------------------------

function getMockVaultYieldData(): VaultYieldData {
  const now = Date.now();

  return {
    vault: {
      id: "blue-chip-vault",
      name: "Blue Chip Multi-Asset Vault",
      totalValueLockedUsd: 4_820_000,
      currentApyPercent: 14.7,
      totalSharesMinted: 4_651_234,
      sharePrice: 1.036,
      pendingHarvestUsd: 12_450,
    },

    yieldPath: {
      nodes: [
        {
          id: "n-swap-fees",
          label: "Swap Fees",
          sublabel: "AMM trading revenue",
          value: "$34,200 / day",
          type: "source",
        },
        {
          id: "n-xlm-usdc",
          label: "XLM / USDC",
          sublabel: "Pool fees",
          value: "$15,120 / day",
          type: "pool",
        },
        {
          id: "n-xlm-ngnc",
          label: "XLM / NGNC",
          sublabel: "Pool fees",
          value: "$11,340 / day",
          type: "pool",
        },
        {
          id: "n-usdc-ngnc",
          label: "USDC / NGNC",
          sublabel: "Pool fees",
          value: "$7,740 / day",
          type: "pool",
        },
        {
          id: "n-router",
          label: "Harvest Router",
          sublabel: "Soroban auto-compound contract",
          value: "Every 8h",
          type: "router",
        },
        {
          id: "n-vault",
          label: "Blue Chip Vault",
          sublabel: "Auto-compounded sfvShares",
          value: "$4.82M TVL",
          type: "vault",
        },
      ],
      edges: [
        { from: "n-swap-fees", to: "n-xlm-usdc", label: "44%", amount: 15120 },
        { from: "n-swap-fees", to: "n-xlm-ngnc", label: "33%", amount: 11340 },
        { from: "n-swap-fees", to: "n-usdc-ngnc", label: "23%", amount: 7740 },
        { from: "n-xlm-usdc", to: "n-router", label: "collected", amount: 15120 },
        { from: "n-xlm-ngnc", to: "n-router", label: "collected", amount: 11340 },
        { from: "n-usdc-ngnc", to: "n-router", label: "collected", amount: 7740 },
        { from: "n-router", to: "n-vault", label: "compound", amount: 34200 },
      ],
    },

    poolAllocations: [
      {
        poolId: "xlm-usdc",
        pair: "XLM / USDC",
        allocationPercent: 44.2,
        tvlUsd: 2_130_240,
        feeApr: 8.4,
        dailyFeesUsd: 15120,
      },
      {
        poolId: "xlm-ngnc",
        pair: "XLM / NGNC",
        allocationPercent: 33.1,
        tvlUsd: 1_595_420,
        feeApr: 12.1,
        dailyFeesUsd: 11340,
      },
      {
        poolId: "usdc-ngnc",
        pair: "USDC / NGNC",
        allocationPercent: 22.7,
        tvlUsd: 1_094_340,
        feeApr: 6.7,
        dailyFeesUsd: 7740,
      },
    ],

    harvestEvents: [
      {
        id: "h-001",
        timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
        txHash: "3a7f9c2e8b14d6a5f0c1e3b2d4a8c7f6e2b1d9a3c5e7f8b2d4a6c8e0f2b4d6",
        totalHarvestedUsd: 11_230,
        compoundedShares: 10_839,
        poolBreakdown: [
          { poolId: "xlm-usdc", pair: "XLM / USDC", harvestedUsd: 4_960 },
          { poolId: "xlm-ngnc", pair: "XLM / NGNC", harvestedUsd: 3_720 },
          { poolId: "usdc-ngnc", pair: "USDC / NGNC", harvestedUsd: 2_550 },
        ],
        status: "confirmed",
      },
      {
        id: "h-002",
        timestamp: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
        txHash: "b8e2f1c4d6a0e5b3c7f9d2a8b4e6c0f2a4d8b2e6f0c4a8d2b6e0f4c2a6d8b0",
        totalHarvestedUsd: 10_875,
        compoundedShares: 10_494,
        poolBreakdown: [
          { poolId: "xlm-usdc", pair: "XLM / USDC", harvestedUsd: 4_780 },
          { poolId: "xlm-ngnc", pair: "XLM / NGNC", harvestedUsd: 3_610 },
          { poolId: "usdc-ngnc", pair: "USDC / NGNC", harvestedUsd: 2_485 },
        ],
        status: "confirmed",
      },
      {
        id: "h-003",
        timestamp: new Date(now - 17 * 60 * 60 * 1000).toISOString(),
        txHash: "f0c4a2d6b8e2f4c6a0d8b2e4f6c8a0d2b4e6f8c0a2d4b6e8f0c2a4d6b8e0f2",
        totalHarvestedUsd: 11_140,
        compoundedShares: 10_753,
        poolBreakdown: [
          { poolId: "xlm-usdc", pair: "XLM / USDC", harvestedUsd: 4_900 },
          { poolId: "xlm-ngnc", pair: "XLM / NGNC", harvestedUsd: 3_690 },
          { poolId: "usdc-ngnc", pair: "USDC / NGNC", harvestedUsd: 2_550 },
        ],
        status: "confirmed",
      },
      {
        id: "h-004",
        timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
        txHash: "a4c8e2b6d0f4c8a2e6b0d4f8c2a6e0b4d8f2c6a0e4b8d2f6c0a4e8b2d6f0c4",
        totalHarvestedUsd: 10_640,
        compoundedShares: 10_270,
        poolBreakdown: [
          { poolId: "xlm-usdc", pair: "XLM / USDC", harvestedUsd: 4_690 },
          { poolId: "xlm-ngnc", pair: "XLM / NGNC", harvestedUsd: 3_510 },
          { poolId: "usdc-ngnc", pair: "USDC / NGNC", harvestedUsd: 2_440 },
        ],
        status: "confirmed",
      },
      {
        id: "h-005",
        timestamp: new Date(now - 33 * 60 * 60 * 1000).toISOString(),
        txHash: "d2f6b0e4c8a2f6b4d0e8c4a0f2d6b8e2c6a4f0d8b2e6c0a4f8d2b6e4c2a0f4",
        totalHarvestedUsd: 10_290,
        compoundedShares: 9_933,
        poolBreakdown: [
          { poolId: "xlm-usdc", pair: "XLM / USDC", harvestedUsd: 4_540 },
          { poolId: "xlm-ngnc", pair: "XLM / NGNC", harvestedUsd: 3_400 },
          { poolId: "usdc-ngnc", pair: "USDC / NGNC", harvestedUsd: 2_350 },
        ],
        status: "confirmed",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVaultYieldHarvest(vaultId: string = "blue-chip-vault") {
  return useQuery<VaultYieldData, Error>({
    queryKey: ["vault-yield-harvest", vaultId],
    queryFn: async () => {
      // In production: fetch(`/api/vaults/${vaultId}/yield-harvest`)
      await new Promise((r) => setTimeout(r, 600));
      return getMockVaultYieldData();
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    placeholderData: getMockVaultYieldData,
  });
}
