"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  createTransactionCsvStream,
  exportTransactionsToCsv,
  TaxPlatform,
  CreateTransactionCsvStreamOptions,
} from "@/utils/csvExport";
import { useVaultYieldHarvest } from "@/hooks/useVaultYieldHarvest";

export interface HarvestEventCsv {
  date: string;
  type: string;
  sentAmount: number;
  sentCurrency: string;
  receivedAmount: number;
  receivedCurrency: string;
  fee: number;
  feeCurrency: string;
  txHash: string;
  totalHarvestedUsd: number;
  compoundedShares: number;
}

export function YieldTaxReportGenerator() {
  const { data, isLoading, isError } = useVaultYieldHarvest();
  const [platform, setPlatform] = useState<TaxPlatform>("standard");
  const [filename, setFilename] = useState<string>("");

  const cryptoRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    async function initCrypto() {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
      cryptoRef.current = key;
    }
    initCrypto();
  }, []);

  const harvestEvents = data?.harvestEvents || [];

  const eventsForCsv: HarvestEventCsv[] = harvestEvents.map((event) => ({
    date: new Date(event.timestamp).toLocaleDateString(),
    type: "Yield Harvest",
    sentAmount: 0,
    sentCurrency: "USDC",
    receivedAmount: event.totalHarvestedUsd,
    receivedCurrency: "USD",
    fee: 0,
    feeCurrency: "USDC",
    txHash: event.txHash,
    totalHarvestedUsd: event.totalHarvestedUsd,
    compoundedShares: event.compoundedShares,
  }));

  const handleGenerate = async () => {
    if (isLoading || isError) return;

    const stream = createTransactionCsvStream(eventsForCsv, {
      platform,
      chunkSize: 500,
    });

    const blob = await new Response(stream).blob();
    const uuid = crypto.randomUUID();
    const signedBlob = await new Promise<Blob>((resolve) => {
      if (!cryptoRef.current) return resolve(blob);
      crypto.subtle
        .encrypt(
          { name: "AES-GCM", iv: crypto.getRandomValues(new Uint8Array(12)) },
          cryptoRef.current!,
          new TextEncoder().encode(JSON.stringify(eventsForCsv)),
        ),
        )
        .then((encrypted) => {
          resolve(
            new Blob([new Uint8Array(encrypted)], {
              type: "application/octet-stream",
            }),
          );
        })
        .catch(() => resolve(blob));
    });

    const downloadUrl = URL.createObjectURL(signedBlob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = filename || `yield_tax_report_${new Date().toISOString().split("T")[0]}.csv`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        Yield Vault Tax Report Generator
      </h2>

      {isLoading ? (
        <p className="text-neutral-500">Loading yield data...</p>
      ) : isError ? (
        <p className="text-red-500">Failed to load yield data. Please try again.</p>
      ) : (
        <>
          <div className="mb-6">
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

          <div className="mb-6">
            <label className="block mb-2 font-medium">
              Report File Name:
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                placeholder="e.g. yield_tax_report_2024-01-01"
              />
            </label>
          </div>

          <button
            onClick={handleGenerate}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            disabled={isLoading || isError}
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

          {filename && (
            <p className="mt-4 text-sm text-neutral-500">
              Report will be downloaded as: {filename}.csv
            </p>
          )}
        </>
      )}
    </div>
  );
}