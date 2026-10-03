"use client";

import PoolTable from "@/components/pools/PoolTable";

export default function PoolExplorerPage() {
  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
    <header className="space-y-2"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-400">Explore</p><h1 className="text-3xl font-bold text-white sm:text-4xl">Liquidity pool explorer</h1><p className="max-w-2xl text-slate-400">Discover pools by asset type and compare liquidity, trading volume, and yield.</p></header>
    <PoolTable />
  </main>;
}
