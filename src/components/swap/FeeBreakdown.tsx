"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@/app/components/providers/WalletProvider";
import { useNetwork } from "@/app/components/providers/NetworkProvider";
import { formatTokenAmount, formatXLM, formatUSD } from "@/utils/formatters";
import type { TokenOption } from "./SwapForm";

interface FeeBreakdownProps {
  fromToken?: TokenOption;
  toToken?: TokenOption;
  amount?: string;
  className?: string;
}

interface FeeStats {
  min: string;
  max: string;
  mode: string;
  p95: string;
}

interface FeeEstimate {
  baseFeeXLM: string;
  resourceFeeXLM: string;
  totalFeeXLM: string;
  totalFeeUSD: string;
  cpuInstructions: string;
  readBytes: string;
  writeBytes: string;
  congestionLevel: "low" | "medium" | "high";
  feeStats: FeeStats;
}

const XLM_PRICE_USD = 0.12;
const HIGH_CONGESTION_MULTIPLIER = 2.0;
const MEDIUM_CONGESTION_MULTIPLIER = 1.5;

function getCongestionLevel(
  currentFee: number,
  modeFee: number,
  p95Fee: number,
): "low" | "medium" | "high" {
  if (currentFee > p95Fee) return "high";
  if (currentFee > modeFee * MEDIUM_CONGESTION_MULTIPLIER) return "medium";
  return "low";
}

function getCongestionColor(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "high":
      return "text-red-400";
    case "medium":
      return "text-yellow-400";
    default:
      return "text-green-400";
  }
}

function getCongestionBg(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "high":
      return "bg-red-500/10 border-red-500/30";
    case "medium":
      return "bg-yellow-500/10 border-yellow-500/30";
    default:
      return "bg-green-500/10 border-green-500/30";
  }
}

export const FeeBreakdown: React.FC<FeeBreakdownProps> = ({
  fromToken,
  toToken,
  amount,
  className = "",
}) => {
  const { wallet } = useWallet();
  const { config } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [feeStats, setFeeStats] = useState<FeeStats | null>(null);

  const parsedAmount = parseFloat(amount || "0");
  const hasValidAmount = parsedAmount > 0;

  const fetchFeeEstimate = useCallback(async () => {
    if (!hasValidAmount) {
      setFeeEstimate(null);
      setFeeStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { SorobanRpc, Networks, TransactionBuilder, Operation } =
        await import("@stellar/stellar-sdk");

      const rpcServer = new SorobanRpc.Server(config.sorobanRpcUrl, {
        allowHttp: true,
      });

      const stats = await rpcServer.getFeeStats();

      setFeeStats({
        min: stats.min.toString(),
        max: stats.max.toString(),
        mode: stats.mode.toString(),
        p95: stats.p95.toString(),
      });

      if (wallet?.publicKey) {
        const sourceAccount = await rpcServer.getAccount(wallet.publicKey);

        const txBuilder = new TransactionBuilder(sourceAccount, {
          fee: stats.mode.toString(),
          networkPassphrase: Networks.TESTNET,
        })
          .setTimeout(30)
          .addOperation(
            Operation.payment({
              destination: wallet.publicKey,
              asset: Operation.nativeAsset(),
              amount: "1",
            }),
          );

        const builtTx = txBuilder.build();
        const preparedTx = await rpcServer.prepareTransaction(builtTx);

        const minResourceFee = Number(preparedTx.minResourceFee);
        const modeFeeNum = Number(stats.mode);
        const totalFeeXLM = minResourceFee / 10_000_000;
        const totalFeeUSD = totalFeeXLM * XLM_PRICE_USD;

        const congestionLevel = getCongestionLevel(
          minResourceFee,
          modeFeeNum,
          Number(stats.p95),
        );

        setFeeEstimate({
          baseFeeXLM: formatXLM((minResourceFee * 0.3).toFixed(7)),
          resourceFeeXLM: formatXLM((minResourceFee * 0.7).toFixed(7)),
          totalFeeXLM: formatXLM(totalFeeXLM.toFixed(7)),
          totalFeeUSD: formatUSD(totalFeeUSD),
          cpuInstructions: "N/A",
          readBytes: "N/A",
          writeBytes: "N/A",
          congestionLevel,
          feeStats: {
            min: stats.min.toString(),
            max: stats.max.toString(),
            mode: stats.mode.toString(),
            p95: stats.p95.toString(),
          },
        });
      } else {
        setFeeEstimate(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to estimate fees",
      );
    } finally {
      setIsLoading(false);
    }
  }, [hasValidAmount, wallet?.publicKey]);

  useEffect(() => {
    const timer = setTimeout(fetchFeeEstimate, 500);
    return () => clearTimeout(timer);
  }, [fetchFeeEstimate]);

  const congestionAlert = useMemo(() => {
    if (!feeEstimate) return null;
    if (feeEstimate.congestionLevel === "low") return null;

    const levelLabel =
      feeEstimate.congestionLevel.charAt(0).toUpperCase() +
      feeEstimate.congestionLevel.slice(1);

    return (
      <div
        className={`rounded-lg border p-3 text-sm ${getCongestionBg(feeEstimate.congestionLevel)}`}
        role="alert"
      >
        <p className="font-semibold">
          {levelLabel} Network Congestion Detected
        </p>
        <p className="mt-1 text-xs opacity-80">
          Current fee estimates are elevated. Consider waiting for lower
          congestion or adjusting your transaction parameters.
        </p>
      </div>
    );
  }, [feeEstimate]);

  if (!hasValidAmount) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
      >
        <p className="text-sm text-gray-500">
          Enter an amount to see fee estimates
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span>Estimating fees...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
      >
        <p className="text-sm text-red-400">
          Unable to estimate fees: {error}
        </p>
      </div>
    );
  }

  if (!wallet?.publicKey) {
    return (
      <div
        className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
      >
        <p className="text-sm text-gray-400">
          Connect your wallet to see fee estimates
        </p>
      </div>
    );
  }

  if (!feeEstimate) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900/50 p-4 ${className}`}
    >
      <h3 className="mb-3 text-sm font-bold text-gray-300">
        Fee Estimate
      </h3>

      {congestionAlert}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Base Fee</span>
          <span className="font-mono text-gray-200">
            {feeEstimate.baseFeeXLM} XLM
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Resource Fee</span>
          <span className="font-mono text-gray-200">
            {feeEstimate.resourceFeeXLM} XLM
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Resource (CPU)</span>
          <span className="font-mono text-gray-200">
            {feeEstimate.cpuInstructions}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Resource (Read)</span>
          <span className="font-mono text-gray-200">
            {feeEstimate.readBytes}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Resource (Write)</span>
          <span className="font-mono text-gray-200">
            {feeEstimate.writeBytes}
          </span>
        </div>
        <div className="my-2 border-t border-gray-800" />
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-gray-200">Total Fee</span>
          <span className="font-mono font-semibold text-gray-100">
            {feeEstimate.totalFeeXLM} XLM
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">USD Equivalent</span>
          <span className="font-mono text-gray-200">
            {feeEstimate.totalFeeUSD}
          </span>
        </div>
      </div>

      {feeStats && (
        <div className="mt-3 border-t border-gray-800 pt-3">
          <p className="mb-2 text-xs uppercase font-bold text-gray-500">
            Network Fee Stats
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Min</span>
              <span className="font-mono text-gray-400">
                {formatTokenAmount(feeStats.min, 0, 0)} stroops
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max</span>
              <span className="font-mono text-gray-400">
                {formatTokenAmount(feeStats.max, 0, 0)} stroops
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Mode</span>
              <span className="font-mono text-gray-400">
                {formatTokenAmount(feeStats.mode, 0, 0)} stroops
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">P95</span>
              <span className="font-mono text-gray-400">
                {formatTokenAmount(feeStats.p95, 0, 0)} stroops
              </span>
            </div>
          </div>
        </div>
      )}

      {feeEstimate.congestionLevel === "high" && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-400">
          Warning: High network congestion detected. Your transaction fee may
          be significantly higher than usual.
        </div>
      )}
    </div>
  );
};

