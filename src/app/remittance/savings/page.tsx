import { Metadata } from "next";
import { FeeSavingsWidget } from "@/components/remittance";

export const metadata: Metadata = {
  title: "Fee Savings Calculator | StellarFlow",
  description:
    "Calculate your savings with StellarFlow vs traditional remittance providers. Compare fees, exchange rates, and see how much you save on international money transfers.",
};

export default function RemittanceSavingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            See Your Savings in Real-Time
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-neutral-300">
            Compare StellarFlow's transparent, blockchain-powered fees against
            traditional money transfer operators. Move your slider, see your savings.
          </p>
        </div>

        {/* Main Widget */}
        <FeeSavingsWidget className="mb-12" />

        {/* Benefits Grid */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
              <svg
                className="h-6 w-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-neutral-100">
              Lightning Fast
            </h3>
            <p className="text-sm text-neutral-400">
              Settlements in seconds, not days. Your recipient gets their money when
              they need it, powered by the Stellar blockchain.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <svg
                className="h-6 w-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-neutral-100">
              Transparent Fees
            </h3>
            <p className="text-sm text-neutral-400">
              What you see is what you pay. No hidden charges, no surprise
              deductions. Just honest, upfront pricing on every transfer.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <svg
                className="h-6 w-6 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-neutral-100">
              Real Savings
            </h3>
            <p className="text-sm text-neutral-400">
              Save up to 90% on transfer fees compared to traditional operators. More
              money in your recipient's pocket where it belongs.
            </p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-16 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8">
          <h2 className="mb-6 text-center text-2xl font-bold text-neutral-100">
            How StellarFlow Saves You Money
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-lg font-semibold text-emerald-400">
                Traditional MTOs
              </h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-red-400">×</span>
                  <span>High flat fees ($3-$5 per transfer)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-red-400">×</span>
                  <span>Additional percentage fees (1-2%)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-red-400">×</span>
                  <span>Hidden exchange rate markups (2-3%)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-red-400">×</span>
                  <span>Slow settlement (minutes to days)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-red-400">×</span>
                  <span>Complex fee structures</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-semibold text-emerald-400">
                StellarFlow
              </h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">✓</span>
                  <span>Minimal flat fee ($0.50)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">✓</span>
                  <span>Tiny percentage fee (0.1%)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">✓</span>
                  <span>Near mid-market exchange rates (0.1% margin)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">✓</span>
                  <span>Lightning-fast settlement (seconds)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-emerald-400">✓</span>
                  <span>100% transparent pricing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <a
            href="/remittance"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
          >
            Start Saving Today
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
          <p className="mt-4 text-sm text-neutral-500">
            No signup required • Try it now
          </p>
        </div>
      </div>
    </div>
  );
}
