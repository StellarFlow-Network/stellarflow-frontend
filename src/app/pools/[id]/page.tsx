import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolById, listPoolIds } from "@/lib/pools";

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      <Link
        href="/"
        className="text-xs font-mono text-neutral-400 hover:text-lime-400 transition-colors"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="mt-4 mb-8 border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{pool.pair}</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Automated market maker pool &middot; {pool.feePercent}% swap fee
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            TOTAL VALUE LOCKED
          </span>
          <span className="text-2xl font-bold font-mono text-lime-400">
            ${pool.totalValueLocked.toLocaleString()}
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            APR
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {pool.apr}%
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            24H VOLUME
          </span>
          <span className="text-2xl font-bold font-mono">
            ${pool.volume24h.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-neutral-200">
          Pool Reserves
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex justify-between text-sm font-mono py-2 px-3 rounded-lg bg-neutral-950/50">
            <span className="text-neutral-400">{pool.assetA}</span>
            <span className="text-neutral-200">
              {pool.reserveA.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm font-mono py-2 px-3 rounded-lg bg-neutral-950/50">
            <span className="text-neutral-400">{pool.assetB}</span>
            <span className="text-neutral-200">
              {pool.reserveB.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
