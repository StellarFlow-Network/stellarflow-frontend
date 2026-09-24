"use client";

import { BridgeRefundDashboard } from "@/components/bridge/BridgeRefundDashboard";

export default function BridgeRefundsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mb-8 border-b border-neutral-800 pb-6">
        <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Bridge Refunds
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Recover funds from cross-chain transfers that timed out or missed
          validator threshold verification.
        </p>
      </div>

      <BridgeRefundDashboard />
    </div>
  );
}
