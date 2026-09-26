"use client";

/**
 * SEP31SettlementReceiptPage — final settlement confirmation screen for a
 * cross-border merchant payment executed over a SEP-31 remittance corridor.
 *
 * Direct transaction-reference link:
 *
 *   /remittance/<txReference>/settlement
 *
 * The settlement payload comes from the backend remittance indexer through
 * `useRemittancePayoutsWithFallback` — the same `RemittancePayoutRecord`
 * source the remittance history modal and the jsPDF receipt use — and is
 * matched on payout id, on-chain transaction hash, or anchor reference.
 *
 * Explicit loading / error / not-found / settled states are rendered, and the
 * receipt card doubles as the print layout: the `@media print` rule below is
 * scoped to `.sep31-receipt-print-area`, so "Print" opens a formatted preview
 * with the site header, navigation and actions removed.
 */
import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Printer,
  RefreshCw,
  Share2,
} from "lucide-react";

import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { SuccessConfetti } from "@/components/ui/MotionPrimitives";
import { useRemittancePayoutsWithFallback } from "@/app/hooks/useRemittancePayouts";
import type { RemittancePayoutRecord } from "@/types/remittancePayout";
import { downloadRemittanceReceiptPdf } from "@/lib/remittanceReceiptPdf";
import type { ReceiptData } from "@/components/remittance/ReceiptModal";

/** Query key owned by `useRemittancePayouts` — used only to retry on error. */
const PAYOUTS_QUERY_KEY = ["remittance-payouts"] as const;

const PRINT_AREA = "sep31-receipt-print-area";

/** Matches a payout against the reference taken from the URL. */
function matchesSettlementReference(
  payout: RemittancePayoutRecord,
  reference: string,
): boolean {
  const needle = reference.trim().toLowerCase();
  if (!needle) return false;
  if (
    payout.id.toLowerCase() === needle ||
    payout.anchorReference.toLowerCase() === needle
  ) {
    return true;
  }
  const hash = payout.transactionHash.toLowerCase();
  return hash === needle || hash.startsWith(needle);
}

function formatFiat(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toReceiptData(payout: RemittancePayoutRecord): ReceiptData {
  return {
    transactionHash: payout.transactionHash,
    anchorReference: payout.anchorReference,
    anchorName: payout.anchorName,
    amountSent: `${payout.amountSent.toLocaleString()} ${payout.sentCurrency}`,
    amountReceived: `${payout.amountReceived.toLocaleString()} ${payout.receivedCurrency}`,
    exchangeRate: payout.exchangeRate,
    fees: `${payout.fee} ${payout.feeCurrency}`,
    timestamp: payout.date,
    senderName: payout.senderName,
    recipientName: payout.recipientName,
    recipientAddress: payout.recipientAddress,
  };
}

const STATUS_COPY: Record<
  RemittancePayoutRecord["status"],
  { title: string; detail: string }
> = {
  completed: {
    title: "Settlement Confirmed",
    detail: "The recipient merchant has been paid in local currency.",
  },
  pending: {
    title: "Settlement Pending",
    detail: "The anchor is still settling this payout — check back shortly.",
  },
  failed: {
    title: "Settlement Failed",
    detail: "The off-ramp partner rejected this payout.",
  },
};

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}

function DetailRow({ label, children, mono = false }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-800/60 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs uppercase tracking-wider text-gray-500">{label}</dt>
      <dd
        className={`text-sm text-gray-100 sm:text-right ${mono ? "font-mono text-xs break-all" : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

export interface SEP31SettlementReceiptPageProps {
  /** Transaction reference from the URL: payout id, tx hash, or anchor reference. */
  txRef: string;
}

export default function SEP31SettlementReceiptPage({
  txRef,
}: SEP31SettlementReceiptPageProps) {
  const { data: payouts, isLoading, error } = useRemittancePayoutsWithFallback();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [isDownloading, setIsDownloading] = useState(false);

  const payout = useMemo(
    () =>
      payouts.find((candidate) => matchesSettlementReference(candidate, txRef)) ??
      null,
    [payouts, txRef],
  );

  const isResolving = isLoading && !payout;

  const handleRetry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: PAYOUTS_QUERY_KEY });
  }, [queryClient]);

  const handleDownload = useCallback(async () => {
    if (!payout || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadRemittanceReceiptPdf(toReceiptData(payout));
    } finally {
      setIsDownloading(false);
    }
  }, [payout, isDownloading]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleShare = useCallback(async () => {
    if (!payout) return;
    const url = window.location.href;
    const text = `${formatFiat(payout.amountReceived, payout.receivedCurrency)} settled to ${payout.recipientName} via ${payout.anchorName} on StellarFlow.`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: "SEP-31 settlement receipt", text, url });
        return;
      }
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      // The user dismissed the native share sheet — nothing to do.
    }
  }, [payout]);

  return (
    <main className="min-h-screen bg-[#080d12] px-4 py-8 md:px-8 lg:px-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .${PRINT_AREA}, .${PRINT_AREA} * { visibility: visible; }
          .${PRINT_AREA} {
            position: absolute;
            inset: 0;
            width: 100%;
            max-width: none;
            border: none !important;
            box-shadow: none !important;
          }
          .sep31-no-print { display: none !important; }
        }
      `}</style>

      <nav
        aria-label="Breadcrumb"
        className="sep31-no-print mb-6 flex items-center gap-2 text-xs text-gray-600"
      >
        <Link href="/" className="transition-colors hover:text-gray-400">
          Home
        </Link>
        <Icon id={ICON_IDS.chevronRight} size={12} className="text-gray-700" />
        <Link href="/remittance" className="transition-colors hover:text-gray-400">
          Remittance
        </Link>
        <Icon id={ICON_IDS.chevronRight} size={12} className="text-gray-700" />
        <Link
          href={`/remittance/${encodeURIComponent(txRef)}`}
          className="transition-colors hover:text-gray-400"
        >
          Tracker
        </Link>
        <Icon id={ICON_IDS.chevronRight} size={12} className="text-gray-700" />
        <span className="truncate font-mono text-gray-400">Settlement</span>
      </nav>

      <div className="mx-auto w-full max-w-2xl">
        {isResolving && <LoadingReceipt />}

        {!isResolving && !payout && error && (
          <ErrorReceipt message={error.message} onRetry={handleRetry} />
        )}

        {!isResolving && !payout && !error && <NotFoundReceipt txRef={txRef} />}

        {payout && (
          <SettlementReceipt
            payout={payout}
            txRef={txRef}
            reduceMotion={Boolean(reduceMotion)}
            isDownloading={isDownloading}
            onDownload={handleDownload}
            onPrint={handlePrint}
            onShare={handleShare}
          />
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ *
 * Loading / error / not-found states
 * ------------------------------------------------------------------ */

function LoadingReceipt() {
  return (
    <div
      className="rounded-2xl border border-gray-800 bg-[#0d1117] p-6 shadow-xl"
      aria-busy
      aria-label="Loading settlement receipt"
    >
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 flex-shrink-0 animate-pulse rounded-full bg-gray-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-800" />
          <div className="h-3 w-56 animate-pulse rounded bg-gray-800/60" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-3.5 w-full animate-pulse rounded bg-gray-800/50"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorReceipt({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6 text-center"
    >
      <Icon
        id={ICON_IDS.alertTriangle}
        size={32}
        className="mx-auto text-red-400"
      />
      <h1 className="mt-3 text-lg font-semibold text-red-200">
        Unable to load settlement
      </h1>
      <p className="mt-1 text-sm text-red-300/80">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-2 text-sm text-red-200 transition-colors hover:bg-red-900/40"
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}

function NotFoundReceipt({ txRef }: { txRef: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0d1117] p-6 text-center">
      <Icon id={ICON_IDS.search} size={30} className="mx-auto text-gray-500" />
      <h1 className="mt-3 text-lg font-semibold text-gray-100">
        Settlement receipt not found
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        No completed settlement matches{" "}
        <span className="font-mono text-gray-400">{txRef}</span>.
      </p>
      <Link
        href="/remittance"
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800"
      >
        <ArrowLeft size={14} />
        Back to remittance
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Settled receipt
 * ------------------------------------------------------------------ */

interface SettlementReceiptProps {
  payout: RemittancePayoutRecord;
  txRef: string;
  reduceMotion: boolean;
  isDownloading: boolean;
  onDownload: () => void;
  onPrint: () => void;
  onShare: () => void;
}

function SettlementReceipt({
  payout,
  txRef,
  reduceMotion,
  isDownloading,
  onDownload,
  onPrint,
  onShare,
}: SettlementReceiptProps) {
  const isSettled = payout.status === "completed";
  const copy = STATUS_COPY[payout.status];

  return (
    <section
      aria-label="SEP-31 settlement receipt"
      className={`${PRINT_AREA} relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0d1117] p-6 shadow-xl`}
    >
      {isSettled && (
        <div className="sep31-no-print">
          <SuccessConfetti show />
        </div>
      )}

      {/* Status hero */}
      <header className="relative z-20 flex flex-col items-center text-center">
        <motion.span
          aria-hidden="true"
          initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 ${
            isSettled
              ? "border-emerald-500 bg-emerald-950/50 shadow-[0_0_18px_4px_rgba(52,211,153,0.25)]"
              : payout.status === "failed"
                ? "border-red-500 bg-red-950/40"
                : "border-yellow-500/60 bg-yellow-950/30"
          }`}
        >
          <Icon
            id={isSettled ? ICON_IDS.checkCircle : ICON_IDS.clock}
            size={34}
            className={
              isSettled
                ? "text-emerald-400"
                : payout.status === "failed"
                  ? "text-red-400"
                  : "text-yellow-400"
            }
          />
        </motion.span>

        <h1
          className={`mt-4 text-xl font-bold ${
            isSettled
              ? "text-emerald-300"
              : payout.status === "failed"
                ? "text-red-300"
                : "text-yellow-300"
          }`}
        >
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{copy.detail}</p>

        <p className="mt-5 text-3xl font-bold tracking-tight text-gray-50">
          {formatFiat(payout.amountReceived, payout.receivedCurrency)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          paid to {payout.recipientName} · {formatTimestamp(payout.date)}
        </p>
      </header>

      {/* Settlement detail */}
      <dl className="relative z-20 mt-6 rounded-xl border border-gray-800/80 bg-[#080d12] px-4 py-1">
        <DetailRow label="Sender">{payout.senderName}</DetailRow>
        <DetailRow label="Recipient merchant">{payout.recipientName}</DetailRow>
        <DetailRow label="Paid amount (fiat)">
          {formatFiat(payout.amountReceived, payout.receivedCurrency)}
        </DetailRow>
        <DetailRow label="Sent amount">
          {formatFiat(payout.amountSent, payout.sentCurrency)}
        </DetailRow>
        <DetailRow label="Exchange rate">{payout.exchangeRate}</DetailRow>
        <DetailRow label="Fee">
          {formatFiat(payout.fee, payout.feeCurrency)}
        </DetailRow>
        <DetailRow label="Anchor">
          {payout.anchorName} · {payout.anchorReference}
        </DetailRow>
        <DetailRow label="Transaction hash" mono>
          <a
            href={`https://stellar.expert/explorer/public/tx/${payout.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 transition-colors hover:text-blue-300"
          >
            {payout.transactionHash}
            <ExternalLink size={12} className="flex-shrink-0" />
          </a>
        </DetailRow>
        <DetailRow label="Reference" mono>
          {txRef}
        </DetailRow>
      </dl>

      {/* Actions — removed from the print layout */}
      <div className="sep31-no-print relative z-20 mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={15} />
          {isDownloading ? "Generating PDF…" : "Download receipt"}
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800"
        >
          <Printer size={15} />
          Print receipt
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800"
        >
          <Share2 size={15} />
          Share
        </button>
      </div>

      <p className="sep31-no-print relative z-20 mt-4 text-center text-xs text-gray-600">
        Verify this settlement on{" "}
        <a
          href={`https://stellar.expert/explorer/public/tx/${payout.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
        >
          stellar.expert
        </a>
      </p>
    </section>
  );
}
