"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Flame,
  Fuel,
  GitFork,
  HelpCircle,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  calculateMultiHopSlippage,
  calculatePriceVariance,
  calculateRealizedSlippagePercent,
  calculateGasToTradeSizeRatio,
  deriveFillQualityRating,
  saveTradeAnalyticsProfile,
  type FillQualityRating,
  type TradeExecutionProfile,
  type TradeHop,
} from "@/lib/tradeAnalytics";

export interface FillQualityWidgetProps {
  tradeId?: string;
  inputAmount: number;
  inputSymbol: string;
  expectedOutput: number;
  actualOutput: number;
  outputSymbol: string;
  gasCostXlm?: number;
  gasCostUsd?: number;
  tradeSizeUsd?: number;
  hops?: TradeHop[];
  txHash?: string;
  autoSaveToHistory?: boolean;
  className?: string;
}

export function FillQualityWidget({
  tradeId,
  inputAmount,
  inputSymbol,
  expectedOutput,
  actualOutput,
  outputSymbol,
  gasCostXlm = 0.00001,
  gasCostUsd = 0.0000012,
  tradeSizeUsd,
  hops = [],
  txHash,
  autoSaveToHistory = true,
  className = "",
}: FillQualityWidgetProps) {
  const [showHopBreakdown, setShowHopBreakdown] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const expectedPrice = useMemo(
    () => (inputAmount > 0 ? expectedOutput / inputAmount : 0),
    [expectedOutput, inputAmount]
  );
  const actualPrice = useMemo(
    () => (inputAmount > 0 ? actualOutput / inputAmount : 0),
    [actualOutput, inputAmount]
  );

  const priceVariance = useMemo(
    () => calculatePriceVariance(actualPrice, expectedPrice),
    [actualPrice, expectedPrice]
  );

  const realizedSlippagePercent = useMemo(
    () => calculateRealizedSlippagePercent(expectedOutput, actualOutput),
    [expectedOutput, actualOutput]
  );

  const rating: FillQualityRating = useMemo(
    () => deriveFillQualityRating(realizedSlippagePercent, priceVariance),
    [realizedSlippagePercent, priceVariance]
  );

  const computedTradeSizeUsd = useMemo(() => {
    if (tradeSizeUsd && tradeSizeUsd > 0) return tradeSizeUsd;
    // Estimate notional if USDC or XLM
    if (outputSymbol.toUpperCase() === "USDC") return actualOutput;
    if (inputSymbol.toUpperCase() === "USDC") return inputAmount;
    return inputAmount * 0.12; // approximate XLM fallback
  }, [tradeSizeUsd, actualOutput, inputAmount, outputSymbol, inputSymbol]);

  const gasToTradeSizePercent = useMemo(
    () => calculateGasToTradeSizeRatio(gasCostUsd, computedTradeSizeUsd),
    [gasCostUsd, computedTradeSizeUsd]
  );

  const multiHopAnalysis = useMemo(() => {
    if (hops.length > 1) {
      return calculateMultiHopSlippage(hops);
    }
    return null;
  }, [hops]);

  // Save profile to local storage analytics
  useEffect(() => {
    if (autoSaveToHistory && inputAmount > 0 && actualOutput > 0) {
      const generatedId = tradeId || `TRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const profile: TradeExecutionProfile = {
        tradeId: generatedId,
        timestamp: new Date().toISOString(),
        pair: `${inputSymbol}/${outputSymbol}`,
        inputAmount,
        inputAsset: inputSymbol,
        expectedOutputAmount: expectedOutput,
        actualOutputAmount: actualOutput,
        outputAsset: outputSymbol,
        expectedPrice,
        actualPrice,
        priceVariance,
        slippagePercent: realizedSlippagePercent,
        rating,
        gasCostXlm,
        gasCostUsd,
        tradeSizeUsd: computedTradeSizeUsd,
        gasToTradeSizePercent,
        hops,
        txHash,
      };

      saveTradeAnalyticsProfile(profile);
      setSavedSuccess(true);
    }
  }, [
    autoSaveToHistory,
    tradeId,
    inputAmount,
    inputSymbol,
    expectedOutput,
    actualOutput,
    outputSymbol,
    expectedPrice,
    actualPrice,
    priceVariance,
    realizedSlippagePercent,
    rating,
    gasCostXlm,
    gasCostUsd,
    computedTradeSizeUsd,
    gasToTradeSizePercent,
    hops,
    txHash,
  ]);

  const priceVarianceFormatted = useMemo(() => {
    const absVal = Math.abs(priceVariance);
    const prefix = priceVariance > 0 ? "+" : priceVariance < 0 ? "-" : "";
    return `${prefix}${absVal.toFixed(6)}`;
  }, [priceVariance]);

  return (
    <div
      className={`rounded-2xl border border-white/15 bg-[#0d1a21] p-5 sm:p-6 text-slate-100 shadow-xl space-y-5 ${className}`}
      aria-label="Order Execution Slippage & Fill Quality Profiler"
    >
      {/* Header & Quality Rating Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-cyan-400" />
          <h3 className="font-bold text-sm text-white">Execution & Fill Quality Profiler</h3>
        </div>

        {/* Rating Badge */}
        <div>
          {rating === "perfect" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
              <Sparkles size={13} className="text-emerald-400" /> Perfect Fill
            </span>
          )}

          {rating === "minimal" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300">
              <CheckCircle2 size={13} className="text-cyan-400" /> Minimal Slippage
            </span>
          )}

          {rating === "high" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 animate-pulse">
              <AlertTriangle size={13} className="text-rose-400" /> High Slippage
            </span>
          )}
        </div>
      </div>

      {/* Core Math Grid: Price Variance ΔP, Realized Slippage, Gas Cost % */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Price Variance ΔP */}
        <div className="rounded-xl border border-white/10 bg-[#071016] p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Price Variance (ΔP)</span>
            {priceVariance >= 0 ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : (
              <TrendingDown size={14} className="text-rose-400" />
            )}
          </div>
          <p
            className={`font-mono text-base font-bold ${
              priceVariance >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {priceVarianceFormatted}
          </p>
          <p className="text-[10px] text-slate-500">
            {priceVariance >= 0
              ? "Positive price improvement"
              : "Delta from quote price"}
          </p>
        </div>

        {/* 2. Realized Slippage */}
        <div className="rounded-xl border border-white/10 bg-[#071016] p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Realized Slippage</span>
            <Percent size={14} className="text-cyan-400" />
          </div>
          <p
            className={`font-mono text-base font-bold ${
              realizedSlippagePercent <= 0.05
                ? "text-emerald-400"
                : realizedSlippagePercent <= 1.0
                ? "text-cyan-300"
                : "text-amber-400"
            }`}
          >
            {realizedSlippagePercent <= 0 ? "0.00%" : `${realizedSlippagePercent.toFixed(3)}%`}
          </p>
          <p className="text-[10px] text-slate-500">
            Expected: {expectedOutput.toFixed(4)} {outputSymbol}
          </p>
        </div>

        {/* 3. Gas Cost Ratio */}
        <div className="rounded-xl border border-white/10 bg-[#071016] p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Gas / Trade Size</span>
            <Fuel size={14} className="text-[#f5c842]" />
          </div>
          <p className="font-mono text-base font-bold text-white">
            {gasToTradeSizePercent < 0.001
              ? "<0.001%"
              : `${gasToTradeSizePercent.toFixed(3)}%`}
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            Fee: {gasCostXlm} XLM (~${gasCostUsd.toFixed(6)})
          </p>
        </div>
      </div>

      {/* Multi-hop Route Breakdown (if multi-hop trade) */}
      {hops.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#0a151d] p-3 text-xs space-y-2">
          <button
            type="button"
            onClick={() => setShowHopBreakdown((prev) => !prev)}
            className="flex w-full items-center justify-between text-left font-semibold text-slate-300 hover:text-white"
          >
            <div className="flex items-center gap-1.5">
              <GitFork size={14} className="text-cyan-400" />
              <span>
                Multi-Hop Path Analysis ({hops.length} leg{hops.length === 1 ? "" : "s"})
              </span>
            </div>
            {showHopBreakdown ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showHopBreakdown && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              {hops.map((hop, index) => {
                const legDiff = hop.expectedRate - hop.actualRate;
                const legSlippage =
                  hop.expectedRate > 0 ? (legDiff / hop.expectedRate) * 100 : 0;

                return (
                  <div
                    key={`${hop.fromAsset}-${hop.toAsset}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-black/40 p-2 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-cyan-300">{hop.fromAsset}</span>
                      <ArrowRight size={11} className="text-slate-500" />
                      <span className="text-emerald-300">{hop.toAsset}</span>
                      {hop.poolId && (
                        <span className="text-[9px] text-slate-500 font-mono">
                          ({hop.poolId.slice(0, 6)}...)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400">
                        Rate: {hop.actualRate.toFixed(4)}
                      </span>
                      <span
                        className={
                          legSlippage <= 0.05 ? "text-emerald-400" : "text-amber-400"
                        }
                      >
                        {legSlippage <= 0 ? "0.00%" : `${legSlippage.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                );
              })}

              {multiHopAnalysis && (
                <div className="flex justify-between pt-1 text-[10px] text-slate-400 font-mono">
                  <span>Total Cumulative Routing Slippage:</span>
                  <span className="font-bold text-cyan-300">
                    {multiHopAnalysis.totalHopSlippagePercent.toFixed(3)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Output Summary & Local Analytics Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1">
        <div className="flex items-center gap-1.5">
          <Database size={13} className="text-cyan-400" />
          <span>
            {savedSuccess
              ? "Fill metrics logged to local trade analytics"
              : "Trade analytics active"}
          </span>
        </div>

        {txHash && (
          <a
            href={`https://stellar.expert/explorer/public/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline font-mono"
          >
            <span>Tx: {txHash.slice(0, 8)}...{txHash.slice(-6)}</span>
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

export default FillQualityWidget;
