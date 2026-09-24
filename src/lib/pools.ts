import { unstable_cache } from "next/cache";
import { REVALIDATE_INTERVALS } from "@/config/cacheConfig";

export interface LiquidityPool {
  id: string;
  pair: string;
  assetA: string;
  assetB: string;
  reserveA: number;
  reserveB: number;
  totalValueLocked: number;
  apr: number;
  volume24h: number;
  feePercent: number;
}

function getMockPools(): LiquidityPool[] {
  return [
    {
      id: "xlm-usdc",
      pair: "XLM / USDC",
      assetA: "XLM",
      assetB: "USDC",
      reserveA: 42_500_000,
      reserveB: 5_100_000,
      totalValueLocked: 10_200_000,
      apr: 8.4,
      volume24h: 1_850_000,
      feePercent: 0.3,
    },
    {
      id: "xlm-ngnc",
      pair: "XLM / NGNC",
      assetA: "XLM",
      assetB: "NGNC",
      reserveA: 18_200_000,
      reserveB: 27_050_000_000,
      totalValueLocked: 4_350_000,
      apr: 12.1,
      volume24h: 920_000,
      feePercent: 0.3,
    },
    {
      id: "usdc-ngnc",
      pair: "USDC / NGNC",
      assetA: "USDC",
      assetB: "NGNC",
      reserveA: 2_600_000,
      reserveB: 3_900_000_000,
      totalValueLocked: 5_200_000,
      apr: 6.7,
      volume24h: 640_000,
      feePercent: 0.3,
    },
  ];
}

/**
 * Fetches the liquidity pool registry, cached and revalidated on the same
 * cadence as other medium-frequency market data (see `cacheProfiles`). Wrapped
 * with `unstable_cache` so repeated Server Component renders across requests
 * within the revalidation window reuse the same in-memory result instead of
 * recomputing it per-request.
 */
const getCachedPools = unstable_cache(
  async () => getMockPools(),
  ["liquidity-pools"],
  { revalidate: REVALIDATE_INTERVALS.MEDIUM_INTERVAL, tags: ["pools"] },
);

export async function listPools(): Promise<LiquidityPool[]> {
  return getCachedPools();
}

export async function listPoolIds(): Promise<string[]> {
  const pools = await getCachedPools();
  return pools.map((pool) => pool.id);
}

export async function getPoolById(id: string): Promise<LiquidityPool | null> {
  const pools = await getCachedPools();
  return pools.find((pool) => pool.id === id) ?? null;
}
