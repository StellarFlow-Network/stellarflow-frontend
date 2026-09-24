/**
 * Client-side CSV statement export for remittance payouts — formatted for
 * local business accounting, so it carries the fields a bank or bookkeeper
 * expects: transaction reference, exchange rate applied, and which anchor
 * processed the off-ramp, alongside sender/recipient names and amounts.
 */
import type { RemittancePayoutRecord } from "@/types/remittancePayout";

export const REMITTANCE_CSV_HEADERS = [
  "Date",
  "Transaction Reference",
  "Anchor",
  "Sender",
  "Recipient",
  "Amount Sent",
  "Sent Currency",
  "Amount Received",
  "Received Currency",
  "Exchange Rate",
  "Fee",
  "Status",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function remittancePayoutToCsvRow(payout: RemittancePayoutRecord): string {
  return [
    payout.date,
    payout.anchorReference,
    payout.anchorName,
    payout.senderName,
    payout.recipientName,
    payout.amountSent.toString(),
    payout.sentCurrency,
    payout.amountReceived.toString(),
    payout.receivedCurrency,
    payout.exchangeRate,
    `${payout.fee} ${payout.feeCurrency}`,
    payout.status,
  ]
    .map(escapeCsvField)
    .join(",");
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export interface ExportRemittanceCsvOptions {
  filename?: string;
}

/**
 * Builds and downloads a CSV accounting statement for the given remittance
 * payouts. Remittance statements are small enough (a receiver's own payout
 * history) that this builds the file synchronously, unlike the chunked
 * streaming exporter used for full account transaction history.
 */
export async function exportRemittancePayoutsToCsv(
  payouts: readonly RemittancePayoutRecord[],
  options: ExportRemittanceCsvOptions = {},
): Promise<void> {
  const rows = payouts.map(remittancePayoutToCsvRow);
  const csv = [REMITTANCE_CSV_HEADERS.join(","), ...rows].join("\n");
  const filename =
    options.filename ??
    `stellarflow_remittance_statement_${new Date().toISOString().split("T")[0]}.csv`;

  triggerBlobDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}
