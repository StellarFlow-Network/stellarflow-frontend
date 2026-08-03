/**
 * Client-side CSV export for the user's swap, liquidity, and remittance
 * settlement history — formatted to match standard crypto tax software
 * column conventions (Date, Type, Sent Amount, Sent Currency, Received
 * Amount, Received Currency, Fee, TxHash).
 *
 * Rows are produced through a `ReadableStream` in fixed-size chunks with a
 * macrotask yield between each one, so building a CSV for a large account
 * history doesn't block the main thread the way a single synchronous
 * `array.join("\n")` would.
 */
import type { TransactionRecord, TransactionType } from "@/types/transactions";

export const TAX_CSV_HEADERS = [
  "Date",
  "Type",
  "Sent Amount",
  "Sent Currency",
  "Received Amount",
  "Received Currency",
  "Fee",
  "TxHash",
] as const;

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  swap: "Swap",
  liquidity: "Liquidity",
  remittance: "Remittance",
};

const DEFAULT_CHUNK_SIZE = 500;

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionToCsvRow(transaction: TransactionRecord): string {
  return [
    transaction.date,
    TRANSACTION_TYPE_LABELS[transaction.type],
    transaction.sentAmount.toString(),
    transaction.sentCurrency,
    transaction.receivedAmount.toString(),
    transaction.receivedCurrency,
    `${transaction.fee} ${transaction.feeCurrency}`,
    transaction.txHash,
  ]
    .map((field) => escapeCsvField(field))
    .join(",");
}

export interface CreateTransactionCsvStreamOptions {
  /** Rows encoded per pull before yielding back to the event loop. */
  chunkSize?: number;
  /** Invoked after each chunk with the count of rows written so far. */
  onProgress?: (rowsWritten: number, totalRows: number) => void;
}

/**
 * Builds a `ReadableStream<Uint8Array>` that yields the CSV header
 * immediately, then encodes transactions in chunks — awaiting a `setTimeout`
 * between pulls so a multi-thousand-row export stays responsive.
 */
export function createTransactionCsvStream(
  transactions: readonly TransactionRecord[],
  options: CreateTransactionCsvStreamOptions = {},
): ReadableStream<Uint8Array> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, onProgress } = options;
  const encoder = new TextEncoder();
  const totalRows = transactions.length;
  let cursor = 0;
  let headerSent = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerSent) {
        headerSent = true;
        controller.enqueue(encoder.encode(`${TAX_CSV_HEADERS.join(",")}\n`));
      }

      if (cursor >= totalRows) {
        controller.close();
        return;
      }

      const chunk = transactions.slice(cursor, cursor + chunkSize);
      cursor += chunk.length;

      const rows = chunk.map(transactionToCsvRow).join("\n");
      controller.enqueue(encoder.encode(`${rows}\n`));
      onProgress?.(cursor, totalRows);

      // Yield to the main thread between chunks so large exports don't
      // block rendering or input handling.
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export interface ExportTransactionsToCsvOptions
  extends CreateTransactionCsvStreamOptions {
  filename?: string;
}

/**
 * Streams the given transactions into a CSV file and triggers a browser
 * download. Safe to call with large histories — see
 * {@link createTransactionCsvStream}.
 */
export async function exportTransactionsToCsv(
  transactions: readonly TransactionRecord[],
  options: ExportTransactionsToCsvOptions = {},
): Promise<void> {
  const { filename, ...streamOptions } = options;
  const stream = createTransactionCsvStream(transactions, streamOptions);
  const blob = await new Response(stream).blob();
  const resolvedFilename =
    filename ?? `stellarflow_transactions_${new Date().toISOString().split("T")[0]}.csv`;

  triggerBlobDownload(new Blob([blob], { type: "text/csv;charset=utf-8" }), resolvedFilename);
}
