import { ILCalculator } from "@/components/pools/ILCalculator";

export const metadata = {
  title: "Impermanent Loss Calculator | StellarFlow",
  description: "Estimate constant-product AMM impermanent loss and fee mitigation.",
};

export default function ImpermanentLossCalculatorPage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-12 text-white">
      <div className="mx-auto mb-8 max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">DeFi tools</p>
        <h1 className="mt-2 text-3xl font-bold">AMM Pool Calculator</h1>
      </div>
      <ILCalculator />
    </main>
  );
}
