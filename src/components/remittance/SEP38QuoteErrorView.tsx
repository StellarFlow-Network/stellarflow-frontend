"use client";

import React from "react";
import { AlertTriangle, RefreshCw, ServerCrash, XCircle, Clock } from "lucide-react";

export interface SEP38QuoteErrorViewProps {
  error?: { status?: number; message?: string } | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  originalRate?: number;
  updatedRate?: number;
}

export function SEP38QuoteErrorView({
  error,
  onRefresh,
  isRefreshing = false,
  originalRate,
  updatedRate,
}: SEP38QuoteErrorViewProps) {
  // Determine if there is a rate fluctuation > 1%
  const hasFluctuation =
    originalRate !== undefined &&
    updatedRate !== undefined &&
    Math.abs(updatedRate - originalRate) / originalRate > 0.01;

  // Determine error details based on status
  let title = "Quote Error";
  let message = "An unexpected error occurred while fetching the exchange rate.";
  let Icon = AlertTriangle;
  let iconColorClass = "text-rose-500 bg-rose-500/10";

  if (error) {
    if (error.status === 400) {
      title = "Invalid Request";
      message = "The quote could not be generated due to invalid parameters. Please check your transaction details.";
      Icon = XCircle;
    } else if (error.status === 503) {
      title = "Service Unavailable";
      message = "The quote server is currently unavailable. Please try again later.";
      Icon = ServerCrash;
    } else if (error.status === 408 || error.message?.toLowerCase().includes("expir")) {
      title = "Quote Expired";
      message = "Your previous quote has expired. Please refresh the FX rate to get a new firm quote.";
      Icon = Clock;
      iconColorClass = "text-amber-500 bg-amber-500/10";
    } else if (error.message) {
      message = error.message;
    }
  } else if (hasFluctuation) {
    title = "Rate Fluctuation Alert";
    message = "The exchange rate has fluctuated significantly since your initial estimate.";
    Icon = AlertTriangle;
    iconColorClass = "text-amber-500 bg-amber-500/10";
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 text-center" data-testid="sep38-quote-error">
      <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconColorClass}`}>
        <Icon className="h-6 w-6" />
      </div>
      
      <h3 className="mb-2 text-lg font-semibold text-neutral-100">{title}</h3>
      <p className="mb-6 text-sm text-neutral-400">{message}</p>

      {hasFluctuation && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left">
          <div className="mb-2 flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Rate fluctuated by &gt;1% ⚠️</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Original Rate:</span>
            <span className="font-mono text-neutral-200">{originalRate?.toFixed(4)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-neutral-400">Updated Rate:</span>
            <span className="font-mono text-neutral-200">{updatedRate?.toFixed(4)}</span>
          </div>
        </div>
      )}

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        Refresh FX Rate
      </button>
    </div>
  );
}

export default SEP38QuoteErrorView;
