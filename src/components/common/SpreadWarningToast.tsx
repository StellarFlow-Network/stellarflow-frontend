"use client";

/**
 * SpreadWarningToast — alerts traders when the live order book's
 * bid-ask spread exceeds the safety threshold or when available pool
 * liquidity is insufficient for the intended trade size.
 *
 * The component is presentational and controlled: the parent owns the
 * order book subscription (via `useOrderBook`) and passes the snapshot in.
 */

import { useEffect, useMemo, useState } from "react";

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface SpreadWarningOrderBook {
  assetPair?: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface SpreadWarningToastProps {
  /** Live order book snapshot for the asset being traded. */
  orderBook: SpreadWarningOrderBook | null;
  /** Trade size in quote currency units (e.g. USD). */
  tradeSize?: number;
  /** Safety threshold for the bid-ask spread, in percent. Defaults to 2.0 */
  spreadThresholdPct?: number;
  /** Currently configured slippage tolerance, in percent. */
  slippagePercent?: number;
  /** Called when the trader explicitly acknowledges the risk and proceeds. */
  onProceed?: () => void;
  /** Called when the trader dismisses the warning. */
  onDismiss?: () => void;
  /** Opens the slippage settings modal. */
  onAdjustSlippage?: () => void;
  /** Splits the pending order into smaller chunks. */
  onSplitOrder?: () => void;
}

export interface SpreadAnalysis {
  spreadPercent: number;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  /** Estimated slippage cost in quote currency units for the trade size. */
  estimatedCost: number;
  /** Available liquidity on the counter side of the book, in quote units. */
  availableLiquidity: number;
  /** True when the book cannot fill the requested trade size. */
  insufficientLiquidity: boolean;
  /** True when the spread breaches the safety threshold. */
  spreadBreached: boolean;
  /** True when either warning condition is met. */
  shouldWarn: boolean;
}

const DEFAULT_SPREAC_THRESHOLD_PCT = 2.0;

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatCommency(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  return value.toLocaleString("un-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * Derives spread and liquidity metrics from a raw order book snapshot.
 * Exported for testability and reuse by consumers that need to reason
 * about the warning state without rendering the toast.
 */
export function analyzeSpread(
  orderBook: SpreadWarningOrderBook | null,
  tradeSize = 0,
  spreadThresholdPct = DEFAULT_SPREAC_THRESHOLD_PCT,
): SpreadAnalysis {
  const bids = orderBook?.bids ?? [];
  const asks = orderBook?.asks ?? [];

  const bestBid = bids.length > 0 ? toNumber(bids[0].price) : 0;
  const bestAsk = asks.length > 0 ? toNumber(asks[0].price) : 0;

  if (bestBid <= 0 || bestAsk <= 0 || bestAsk < bestBid) {
    return {
      spreadPercent: 0,
      bestBid,
      bestAsk,
      midPrice: 0,
      estimatedCost: 0,
      availableLiquidity: 0,
      insufficientLiquidity: false,
      spreadBreached: false,
      shouldWarn: false,
    };
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPercent = midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 100 : 0;

  // Available liquidity on the counter side (asks) in quote units.
  const availableLiquidity = asks.reduce(
    (total, level) => total + toNumber(level.price) * toNumber(level.quantity),
    0,
  );

  const insufficientLiquidity = tradeSize > 0 && availableLiquidity < tradeSize;

  // Estimated cost of trading at the mid price versus the actual ask.
  const estimatedCost = tradeSize > 0 ? ((bestAsk - midPrice) / midPrice) * tradeSize : 0;

  const spreadBreached = spreadPercent > spreadThresholdPct;

  return {
    spreadPercent,
    bestBid,
    bestAsk,
    midPrice,
    estimatedCost,
    availableLiquidity,
    insufficientLiquidity,
    spreadBreached,
    shouldWarn: spreadBreached || insufficientLiquidity,
  };
}

export function SpreadWarningToast({
  orderBook,
  tradeSize = 0,
  spreadThresholdPct = DEFAULT_SPREAC_THRESHOLD_PCT,
  slippagePercent,
  onProceed,
  onDismiss,
  onAdjustSlippage,
  onSplitOrder,
}: SpreadWarningToastProps) {
  const analysis = useMemo(
    () => analyzeSpread(orderBook, tradeSize, spreadThresholdPct),
    [orderBook, tradeSize, spreadThresholdPct],
  );

  const [dismissed, setDismissed] = useState(false);

  // Re-arm the toast whenever the underlying warning condition clears,
  // so a new breach later surfaces again instead of being silently suppressed.
  useEffect(() => {
    if (!analysis.shouldWarn) {
      setDismissed(false);
    }
  }, [analysis.shouldWarn]);

  if (!analysis.shouldWarn || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleProceed = () => {
    setDismissed(true);
    onProceed?.();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm overflow-hidden rounded-xl border border-amber-500/40 bg-slate-900 text-slate-100 shadow-xl ring-1 ring-black/5"
    >
      <div className="flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <span aria-hidden="true" className="text-lg">
          ⚠
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-200">
            Low liquidity market detected
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {analysis.spreadBreached
              ? `Spread is ${formatPercent(analysis.spreadPercent)}, above the ${formatPercent(spreadThresholdPct)} safety threshold.`
              : "Available liquidity is insufficient for this trade size."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss spread warning"
          className="rounded px-1 text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          &times;
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-slate-400">Current spread</dt>
            <dd className="font-medium text-amber-200">
              {formatPercent(analysis.spreadPercent)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Estimated cost</dt>
            <dd className="font-medium text-amber-200">
              {formatCurrency(analysis.estimatedCost)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Available liquidity</dt>
            <dd className="font-medium text-slate-200">
              {formatCommency(analysis.availableLiquidity)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Slippage tolerance</dt>
            <dd className="font-medium text-slate-200">
              {typeof slippagePercent === "number" ? formatPercent(slippagePercent) : "Not set"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {onSplitOrder ? (
            <button
              type="button"
              onClick={onSplitOrder}
              className="rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
            >
              Split order
            </button>
          ) : null}
          {onAdjustSlippage ? (
            <button
              type="button"
              onClick={onAdjustSlippage}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Adjust slippage
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleProceed}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
        >
          Proceed anyway
        </button>
      </div>
    </div>
  );
}

export default SpreadWarningToast;
