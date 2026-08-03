"use client";

/**
 * RemittanceStatusPage  —  /remittance/[txId]
 *
 * Renders the StatusStepper for a single remittance transaction.
 * All real-time logic lives in the `useRemittanceStatus` hook; this page
 * is purely presentational integration wiring.
 *
 * Usage:
 *   Navigate to /remittance/<transaction-id>
 *   e.g. /remittance/abc123ef
 *
 * In development / demo mode (no live backend), the page boots with a
 * mock status object so the stepper is always visible and interactive.
 */

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusStepper } from "@/components/remittance/StatusStepper";
import {
  useRemittanceStatus,
  RemittanceStatus,
  REMITTANCE_STEPS,
} from "@/hooks/useRemittanceStatus";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";

// ---------------------------------------------------------------------------
// Demo / development helpers
// ---------------------------------------------------------------------------

/**
 * Returns a synthetic mock status for development / UI review.
 * Cycles through steps every 3 seconds so designers can see all states
 * without a live backend. Remove / disable when connecting to a real API.
 */
function useMockStatus(txId: string): RemittanceStatus {
  const [stepIdx, setStepIdx] = useState(1); // start at "swap_completed" for interest

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIdx((prev) =>
        prev < REMITTANCE_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 3_000);
    return () => window.clearInterval(id);
  }, []);

  const currentStep = REMITTANCE_STEPS[stepIdx];

  return {
    txId,
    currentStep,
    phase: stepIdx === REMITTANCE_STEPS.length - 1 ? "completed" : "active",
    stepMeta: {
      deposited: {
        step: "deposited",
        completedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
        txHash:
          "3b6a9f4e7d2c1e0f8a5b4c9d3e7f2a1b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f",
      },
      swap_completed:
        stepIdx >= 1
          ? {
              step: "swap_completed",
              completedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
              txHash:
                "9d1a2b3c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
            }
          : undefined,
      anchor_processing:
        stepIdx >= 2
          ? {
              step: "anchor_processing",
              completedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
            }
          : undefined,
      offramp_dispatched:
        stepIdx >= 3
          ? {
              step: "offramp_dispatched",
              completedAt: new Date(Date.now() - 30_000).toISOString(),
            }
          : undefined,
      delivered:
        stepIdx >= 4
          ? {
              step: "delivered",
              completedAt: new Date().toISOString(),
            }
          : undefined,
    },
    estimatedDeliveryMs: stepIdx < 4 ? Date.now() + 4 * 60_000 : undefined,
  };
}

// ---------------------------------------------------------------------------
// Decide whether we are in demo mode (no real backend configured).
// ---------------------------------------------------------------------------
const IS_DEMO_MODE =
  typeof process !== "undefined" &&
  !process.env.NEXT_PUBLIC_API_URL;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface RemittanceStatusPageProps {
  params: Promise<{ txId: string }>;
}

export default function RemittanceStatusPage({
  params,
}: RemittanceStatusPageProps) {
  const { txId } = use(params);

  // Reject obviously invalid IDs early (< 4 chars or > 128 chars)
  if (!txId || txId.length < 4 || txId.length > 128) {
    notFound();
  }

  return IS_DEMO_MODE ? (
    <DemoPage txId={txId} />
  ) : (
    <LivePage txId={txId} />
  );
}

// ---------------------------------------------------------------------------
// LivePage — wired to the real useRemittanceStatus hook
// ---------------------------------------------------------------------------

function LivePage({ txId }: { txId: string }) {
  const { status, isConnected, isPolling, error, refetch } =
    useRemittanceStatus(txId, {
      pollIntervalMs: 5_000,
      stopOnDelivered: true,
    });

  return (
    <PageShell txId={txId}>
      <StatusStepper
        status={status}
        isConnected={isConnected}
        isPolling={isPolling}
        error={error}
        onRefetch={refetch}
        network={
          process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet"
            ? "testnet"
            : "mainnet"
        }
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// DemoPage — mock status that auto-advances through all five steps
// ---------------------------------------------------------------------------

function DemoPage({ txId }: { txId: string }) {
  const mockStatus = useMockStatus(txId);

  return (
    <PageShell txId={txId}>
      {/* Demo notice banner */}
      <div
        role="note"
        className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-700/40 bg-yellow-950/20 px-3 py-2.5 text-xs text-yellow-400"
      >
        <Icon
          id={ICON_IDS.alertTriangle}
          size={13}
          className="mt-0.5 flex-shrink-0"
        />
        <span>
          <strong>Demo mode</strong> — NEXT_PUBLIC_API_URL is not set. Status
          auto-advances every 3 s using mock data. Steps cycle through all five
          states for UI preview.
        </span>
      </div>

      <StatusStepper
        status={mockStatus}
        isConnected={false}
        isPolling={false}
        network="testnet"
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Shared page shell
// ---------------------------------------------------------------------------

function PageShell({
  txId,
  children,
}: {
  txId: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#080d12] px-4 py-8 md:px-8 lg:px-12">
      {/* Breadcrumb nav */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-xs text-gray-600"
      >
        <Link
          href="/"
          className="transition-colors hover:text-gray-400"
        >
          Home
        </Link>
        <Icon
          id={ICON_IDS.chevronRight}
          size={12}
          className="text-gray-700"
        />
        <span className="text-gray-500">Remittance</span>
        <Icon
          id={ICON_IDS.chevronRight}
          size={12}
          className="text-gray-700"
        />
        <span
          className="font-mono text-gray-400 truncate max-w-[12rem]"
          title={txId}
        >
          {txId}
        </span>
      </nav>

      {/* Page heading */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-100">
          <Icon
            id={ICON_IDS.activity}
            size={20}
            className="text-blue-400"
          />
          Remittance Tracker
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Real-time progress across five stages from deposit to delivery.
        </p>
      </div>

      {/* Stepper card — constrained width for readability */}
      <div className="mx-auto max-w-lg">{children}</div>

      {/* Footer links */}
      <div className="mx-auto mt-8 max-w-lg">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-700">
          <a
            href="https://stellar.expert/explorer/public"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-gray-400"
          >
            <Icon id={ICON_IDS.externalLink} size={11} />
            Stellar Expert Explorer
          </a>
          <span aria-hidden>·</span>
          <Link href="/" className="transition-colors hover:text-gray-400">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
