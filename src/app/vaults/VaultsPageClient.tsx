"use client";

import dynamic from "next/dynamic";
import LpVaultStrategyBacktester from "@/components/vaults/LpVaultStrategyBacktester";

// Lazy-load the heavy visualizer so vault charts stay out of the critical bundle.
// `ssr: false` requires a Client Component boundary, so this is split out of
// page.tsx (which needs to stay a Server Component to export `metadata`).
const VaultYieldHarvestVisualizer = dynamic(
  () =>
    import("@/components/vaults/VaultYieldHarvestVisualizer").then(
      (m) => m.VaultYieldHarvestVisualizer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Loading vault strategy…</p>
        </div>
      </div>
    ),
  },
);

export default function VaultsPageClient() {
  return (
    <>
      <LpVaultStrategyBacktester />
      <VaultYieldHarvestVisualizer />
    </>
  );
}
