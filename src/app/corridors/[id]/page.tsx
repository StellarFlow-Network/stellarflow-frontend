import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCorridorById, listCorridorIds } from "@/lib/corridors";
import {
  CorridorAssetIcon,
  parseCorridorPairCodes,
} from "@/app/dashboard/corridors/CorridorAssetIcon";

interface CorridorPageProps {
  params: Promise<{ id: string }>;
}

// Pre-render known corridors at build time; new corridors still resolve
// on-demand via ISR since `dynamicParams` defaults to true.
export async function generateStaticParams() {
  const ids = await listCorridorIds();
  return ids.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: CorridorPageProps): Promise<Metadata> {
  const { id } = await params;
  const corridor = await getCorridorById(id);

  if (!corridor) {
    return { title: "Corridor Not Found | StellarFlow" };
  }

  return {
    title: `${corridor.pair} Corridor | StellarFlow`,
    description: corridor.description,
  };
}

const statusStyles: Record<string, string> = {
  optimal: "bg-emerald-950/50 text-emerald-400 border-emerald-500/30",
  degraded: "bg-amber-950/50 text-amber-400 border-amber-500/30",
  critical: "bg-red-950/50 text-red-400 border-red-500/30",
};

export default async function CorridorDetailPage({ params }: CorridorPageProps) {
  const { id } = await params;
  const corridor = await getCorridorById(id);

  if (!corridor) {
    notFound();
  }

  const pairCodes = parseCorridorPairCodes(corridor.pair);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      <Link
        href="/dashboard/corridors"
        className="text-xs font-mono text-neutral-400 hover:text-lime-400 transition-colors"
      >
        &larr; Back to Corridor Monitor
      </Link>

      <div className="mt-4 mb-8 border-b border-neutral-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {pairCodes && (
            <span className="flex items-center gap-1">
              <CorridorAssetIcon
                code={pairCodes[0]}
                size={28}
                className="text-lime-400"
              />
              <CorridorAssetIcon
                code={pairCodes[1]}
                size={28}
                className="text-neutral-400"
              />
            </span>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {corridor.pair}
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {corridor.description}
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-lg text-xs font-mono border ${
            statusStyles[corridor.status]
          }`}
        >
          {corridor.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            IMPLIED RATE
          </span>
          <span className="text-2xl font-bold font-mono text-lime-400">
            {corridor.rate.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            MARKET SPREAD
          </span>
          <span className="text-2xl font-bold font-mono text-amber-500">
            {corridor.spread}%
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            24H VOLUME
          </span>
          <span className="text-2xl font-bold font-mono">
            ${corridor.volume24h.toLocaleString()}
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            INGESTION LATENCY
          </span>
          <span className="text-2xl font-bold font-mono">
            {corridor.latencyMs}ms
          </span>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4 text-neutral-200">
          Order Book Depth
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase text-neutral-500 font-mono mb-2">
              Asks
            </p>
            <div className="space-y-1">
              {corridor.asks.map((ask, index) => (
                <div
                  key={`ask-${index}`}
                  className="flex justify-between text-xs font-mono py-1 px-2"
                >
                  <span className="text-red-400">{ask.price.toFixed(2)}</span>
                  <span className="text-neutral-300">{ask.amount}</span>
                  <span className="text-neutral-500">{ask.total}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500 font-mono mb-2">
              Bids
            </p>
            <div className="space-y-1">
              {corridor.bids.map((bid, index) => (
                <div
                  key={`bid-${index}`}
                  className="flex justify-between text-xs font-mono py-1 px-2"
                >
                  <span className="text-emerald-400">
                    {bid.price.toFixed(2)}
                  </span>
                  <span className="text-neutral-300">{bid.amount}</span>
                  <span className="text-neutral-500">{bid.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500 font-mono">
          Source: {corridor.source}
        </p>
      </div>
    </div>
  );
}
