import type { Metadata } from "next";
import VaultsPageClient from "./VaultsPageClient";

export const metadata: Metadata = {
  title: "Vault Yield Harvest Strategy | StellarFlow",
  description:
    "Multi-asset vault yield harvest strategy visualizer — flowchart, allocations, and harvest logs.",
};

export default function VaultsPage() {
  return <VaultsPageClient />;
}
