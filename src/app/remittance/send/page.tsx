"use client";

import React from "react";
import RemittanceSendWizard from "@/components/remittance/RemittanceSendWizard";

/**
 * Remittance send route (#1078) — hosts the four-step cross-border transfer
 * wizard (corridor + amount, SEP-38 quote selection, beneficiary details,
 * review and submit) and hands off to the delivery tracking page.
 */
export default function RemittanceSendPage() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6 font-sans text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Send Money</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Transfer on-ledger assets into local fiat through licensed anchor
            corridors. Quotes lock for 60 seconds once issued.
          </p>
        </header>
        <RemittanceSendWizard />
      </div>
    </div>
  );
}
