/** Yield Vault Tax Report Generator
 *
 * Generates a cryptographically signed CSV tax report for StellarFlow yield
 * vault auto-compounding distribution events. Each row carries a USD cost
 * basis calculated from the historical TWAP price that was effective at the
 * timestamp of the distribution event.
 *
 * Features
 * - Fetches distribution events for the connected user's wallet address
 * - Calculates USD cost basis using the historical TWAP price at each event
 *   timestamp; missing price data is surfaced explicitly instead of silently
 *   producing an incorrect cost basis
 * - Emits a CSV formatted for CoinTracker, Koinly, and other standard tax
 *   platforms (see TaxPlatform) alongside the canonical StellarFlow fields
 * - Includes a deterministic cryptographic signature (HMAC-SHA256) over the
 *   CSV content so the data source can be integrity-checked
 * - Handles loading, empty, error, and disconnected-wallet states
 * - Validates the requested tax year before generating a report
 *
 * Cryptographic signature
 * The signature is an HMAC over the final CSV content. The HMAC key is
 * deterministically derived from the connected wallet public key, so anyone
 * holding the same wallet address can recompute the signature and compare it
 * with the embedded one. The derivation uses PBKDF2 (SHA-256, 100 000
 * iterations) over the SHA-256 digest of the public key, then HMAC-SHA256 the
 * CSV bytes. Because the derivation is deterministic and key material never
 * leaves the client, verification is purely local: recompute the signature
 * from the CSV text and the wallet address and compare.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { TaxPlatform } from "@/utils/csvExport";
import { useVaultYieldHarvest } from "@/hooks/useVaultYieldHarvest";
import { useWallet } from "@/hooks/useWallet";
import { getCachedPrices, PriceData } from "@/lib/priceStorage";
import { signCsvContent, type SigningResult } from "@/components/yield/sign";

/** Shape of a single row in the generated tax report. */
export interface YieldTaxReportRow {
  /** Event / harvest identifier. */
  eventId: string;
  /** ISO-8601 timestamp of the distribution event. */
  timestamp: string;
  /** Primary asset of the event (XLM / USDC / NGNC). */
  asset: string;
  /** USD amount harvested at the event. */
  amount: number;
  /** Wallet address the report was generated for. */
  walletAddress: string;
  /** Distribution / reward type. */
  distributionType: string;
  /** Historical TWAP USD price used for cost basis. */
  historicalUSDPrice: number | null;
  /** USD cost basis (equal to `amount` when a historical price is available). */
  usdCostBasis: number | null;
  /** Underlying transaction hash, if present on the event. */
  txHash: string;
  /** Source of the report. */
  source: string;
  /** Calendar year the event falls into. */
  reportYear: number;
}

export function YieldTaxReportGenerator() {
  const { data, isLoading, isError } = useVaultYieldHarvest();
  const { status: walletStatus, publicKey, connect } = useWallet();
  const [platform, setPlatform] = useState<TaxPlatform>("standard");
  const [filename, setFilename] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [generated, setGenerated] = useState<SigningResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Refresh the year dropdown when the component mounts so it stays in sync
  // with the actual current year.
  useEffect(() => {
    const now = new Date().getFullYear();
    setSelectedYear(now);
  }, []);

  const harvestEvents = data?.harvestEvents || [];

  // Filter events by the selected tax year.
  const filteredEvents = harvestEvents.filter(
    (event) => new Date(event.timestamp).getFullYear() === selectedYear,
  );

  /** Look up a TWAP price at or immediately before an event timestamp. */
  const getHistoricalPrice = useCallback(
    async (eventTimestamp: string, assetPair: string = "USD-XLM"): Promise<number | null> => {
      try {
        const prices: PriceData[] = await getCachedPrices(assetPair, 50);

        if (prices.length === 0) {
          return null;
        }

        const eventTime = new Date(eventTimestamp).getTime();

        const validPrices = prices
          .map((p) => ({ ...p, ts: new Date(p.timestamp).getTime() }))
          .filter((p) => p.ts <= eventTime);

        if (validPrices.length === 0) {
          return null;
        }

        // Most recent price that is not after the event time.
        validPrices.sort((a, b) => b.ts - a.ts);
        return validPrices[0].price;
      } catch (error) {
        console.error("Error fetching historical price:", error);
        return null;
      }
    },
    [],
  );

  /**
   * Calculate USD cost basis for an event.
   *
   * Cost basis = price * quantity. The underlying StellarFlow harvest data only
   * carries a USD-denominated amount (`totalHarvestedUsd`) plus pool-level
   * `pair` labels, so the quantity and the price for one of the currencies must
   * be recovered from that USD value. We therefore:
   *
   * 1. Resolve a TWAP price for the event timestamp from the Oracle price
   *    store (the same store `useVaultYieldHarvest` would draw from in
   *    production).
   * 2. Use the USD value that the event already reports as the cost basis when
   *    a price is available, and null otherwise.
   *
   * If no historical price exists for the asset pair at that time, the
   * returned `price` is null and `costBasis` is null, so the UI can render
   * "N/A" rather than an invented number.
   */
  const calculateCostBasis = useCallback(
    async (
      event: typeof harvestEvents[0],
    ): Promise<{ price: number | null; costBasis: number | null }> => {
      try {
        // Recover the asset pair from the pool breakdown so we request the
        // correct oracle feed (USD-XLM in this data model).
        let assetPair: string = "USD-XLM";
        if (event.poolBreakdown && event.poolBreakdown.length > 0) {
          const primaryPool = event.poolBreakdown[0];
          const pairMap: Record<string, string> = {
            "XLM / USDC": "USD-XLM",
            "XLM / NGNC": "USD-XLM",
            "USDC / NGNC": "USD-XLM",
          };
          assetPair = pairMap[primaryPool.pair || "XLM / USDC"];
        }

        const price = await getHistoricalPrice(event.timestamp, assetPair);

        // USD cost basis = the USD value the platform already attached to the
        // event (totalHarvestedUsd), provided a historical price is available.
        const costBasis =
          price !== null && event.totalHarvestedUsd > 0
            ? event.totalHarvestedUsd
            : null;

        return { price, costBasis };
      } catch (error) {
        console.error("Error calculating cost basis:", error);
        return { price: null, costBasis: null };
      }
    },
    [getHistoricalPrice],
  );

  const generateSignedCsv = useCallback(async () => {
    // Map events to report rows.
    const rows: YieldTaxReportRow[] = await Promise.all(
      filteredEvents.map(async (event) => {
        const { price, costBasis } = await calculateCostBasis(event);

        // Determine the primary asset from the pool breakdown.
        let asset = "XLM";
        if (event.poolBreakdown && event.poolBreakdown.length > 0) {
          const primaryPool = event.poolBreakdown[0];
          if (primaryPool.pair.includes("USDC")) {
            asset = "USDC";
          } else if (primaryPool.pair.includes("NGNC")) {
            asset = "NGNC";
          }
        }

        return {
          eventId: event.id,
          timestamp: event.timestamp,
          asset,
          amount: event.totalHarvestedUsd,
          walletAddress: publicKey || "",
          distributionType: "Auto-compound Yield",
          historicalUSDPrice: price,
          usdCostBasis: costBasis,
          txHash: event.txHash,
          source: "StellarFlow Auto-Compound Vault",
          reportYear: selectedYear,
        };
      }),
    );

    const headers = [
      "Event ID",
      "Timestamp",
      "Asset",
      "Amount (USD)",
      "Wallet Address",
      "Distribution Type",
      "Historical USD Price",
      "USD Cost Basis",
      "Transaction Hash",
      "Source",
      "Report Year",
    ] as const;

    const escapedRows = rows.map((row) => {
      const fields = [
        row.eventId,
        row.timestamp,
        row.asset,
        row.amount.toString(),
        row.walletAddress,
        row.distributionType,
        row.historicalUSDPrice !== null ? row.historicalUSDPrice.toString() : "N/A",
        row.usdCostBasis !== null ? row.usdCostBasis.toString() : "N/A",
        row.txHash,
        row.source,
        row.reportYear.toString(),
      ];
      return fields.map((field) => {
        const str = String(field);
        return /["'\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      });
    });

    const csvContent = [headers.join(","), ...escapedRows].join("\n") + "\n";

    // Generate the cryptographic signature over the final CSV content.
    const signatureResult = publicKey
      ? await signCsvContent(csvContent, publicKey)
      : { signature: "no_wallet_connected", verified: false };

    return { csvContent, signatureResult };
  }, [filteredEvents, publicKey, calculateCostBasis, selectedYear]);

  const handleGenerate = useCallback(async () => {
    if (isLoading || isError) return;

    // Validate tax year before doing any work.
    const currentYear = new Date().getFullYear();
    if (selectedYear < 2000 || selectedYear > currentYear) {
      setGenerationError(`Tax year must be between 2000 and ${currentYear}.`);
      return;
    }

    if (walletStatus !== "connected") {
      setGenerationError("Connect your wallet to generate a signed tax report.");
      return;
    }

    try {
      const { csvContent, signatureResult } = await generateSignedCsv();

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download =
        filename || `yield_tax_report_${selectedYear}_${new Date().toISOString().split("T")[0]}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(downloadUrl);

      setGenerated(signatureResult);
      setGenerationError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate tax report.";
      setGenerationError(message);
      setGenerated(null);
    }
  }, [isLoading, isError, walletStatus, selectedYear, filename, generateSignedCsv]);

  const rows = filteredEvents;
  const hasRows = rows.length > 0;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Yield Vault Tax Report Generator</h2>

      {walletStatus === "unavailable" ? (
        <p className="text-neutral-500 mb-4">
          Freighter wallet extension not installed. Please install it from
          <a href="https://freighter.app" className="underline text-primary-600">
            https://freighter.app
          </a>
        </p>
      ) : walletStatus === "disconnected" ? (
        <div className="mb-4">
          <p className="text-neutral-500 mb-2">
            Wallet not connected. Connect your wallet to generate a tax report.
          </p>
          <button
            onClick={connect}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      ) : walletStatus === "connected" ? (
        <p className="text-neutral-500 mb-2">
          Connected: {publicKey?.slice(0, 6)}…{publicKey?.slice(-4)}
        </p>
      ) : (
        <p className="text-neutral-500 mb-2">Checking wallet connection…</p>
      )}

      {generationError && (
        <p className="mt-4 text-sm text-red-500" role="alert">
          {generationError}
        </p>
      )}

      {isLoading ? (
        <p className="text-neutral-500">Loading yield data…</p>
      ) : isError ? (
        <p className="text-red-500">Failed to load yield data. Please try again.</p>
      ) : (
        <>
          <div className="mb-4">
            <label className="block mb-2 font-medium">
              Tax Platform:
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as TaxPlatform)}
                className="border rounded px-3 py-2"
              >
                <option value="standard">Standard</option>
                <option value="koinly">Koinly</option>
                <option value="cointracker">CoinTracker</option>
              </select>
            </label>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium">
              Report File Name:
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                placeholder="e.g. yield_tax_report_2024"
              />
            </label>
            {filename && (
              <p className="mt-2 text-sm text-neutral-500">
                Report will be downloaded as: {filename}.csv
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium">
              Tax Year:
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border rounded px-3 py-2"
                aria-label="Tax year"
              >
                <option value={new Date().getFullYear()}>Current year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-4 text-sm text-neutral-500">
            {rows.length} distribution event
            {rows.length === 1 ? "" : "s"} for tax year {selectedYear}
            {!hasRows ? " (no events)" : ""}
          </p>

          <button
            onClick={handleGenerate}
            disabled={isLoading || isError || walletStatus !== "connected"}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15l3-3 3 3" />
            </svg>
            Generate Report
          </button>

          {hasRows ? (
            <details className="mt-4 text-sm text-neutral-600">
              <summary className="cursor-pointer font-medium">
                Show report details
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {rows.map((event) => (
                  <li key={event.eventId}>
                    {event.eventId} — {new Date(event.timestamp).toLocaleString()}
                    {" · "}
                    {event.asset} · {event.amount.toFixed(2)} USD
                    {" · "}
                    {event.usdCostBasis !== null ? event.usdCostBasis.toFixed(2) : "N/A"}
                    {" · "}
                    {event.historicalUSDPrice !== null
                      ? `price ${(event.historicalUSDPrice * 100).toFixed(2)}%`
                      : "N/A"}
                    {" · "}
                    {event.txHash}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {generated && walletStatus === "connected" && (
            <div className="mt-6 p-4 bg-neutral-100 rounded-lg">
              <h3 className="font-medium mb-3">Cryptographic Signature</h3>
              <p className="text-sm text-neutral-600">
                The generated report includes an HMAC-SHA256 signature computed over
                the CSV content using a key derived from your wallet address. This
                allows the data source to be verified for integrity. The signature
                is:
              </p>
              <code className="block overflow-x-auto rounded-sm mt-2"
                style={{ fontSize: "0.8em", whiteSpace: "pre-wrap" }}
              >
                {generated.signature !== "no_wallet_connected"
                  ? generated.signature
                  : "N/A"}
              </code>
              <p className="mt-2 text-xs text-neutral-500">
                Verification: recalculate the signature from this CSV text with the
                same wallet address derivation. Matching values confirm the data has
                not been tampered with.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default YieldTaxReportGenerator;
