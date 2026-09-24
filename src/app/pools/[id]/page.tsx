import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolById, listPoolIds } from "@/lib/pools";
import { PoolDetailClient } from "./PoolDetailClient";

interface PoolPageProps {
  params: Promise<{ id: string }>;
}

// Pre-render known pools at build time; new pools still resolve on-demand
// via ISR since `dynamicParams` defaults to true.
export async function generateStaticParams() {
  const ids = await listPoolIds();
  return ids.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PoolPageProps): Promise<Metadata> {
  const { id } = await params;
  const pool = await getPoolById(id);

  if (!pool) {
    return { title: "Pool Not Found | StellarFlow" };
  }

  return {
    title: `${pool.pair} Pool | StellarFlow`,
    description: `Liquidity pool stats for ${pool.pair}: TVL, APR, and 24h volume.`,
  };
}

export default async function PoolDetailPage({ params }: PoolPageProps) {
  const { id } = await params;
  const pool = await getPoolById(id);

  if (!pool) {
    notFound();
  }

  return (
    <PoolDetailClient
      poolId={pool.id}
      pair={pool.pair}
      feePercent={pool.feePercent}
      totalValueLocked={pool.totalValueLocked}
      apr={pool.apr}
      volume24h={pool.volume24h}
      assetA={pool.assetA}
      assetB={pool.assetB}
      reserveA={pool.reserveA}
      reserveB={pool.reserveB}
    />
  );
}
