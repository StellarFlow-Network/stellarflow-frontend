"use client";

import { memo, useMemo, useState } from "react";
import type { AssetSymbol } from "@/config/assetSymbols";
import { useOrderBook } from "@/app/hooks/useOrderBook";
import { useMounted } from "@/app/hooks/useMounted";
import { formatCompactAmount, formatOrderBookPrice, formatPercent } from "@/utils/formatters";
import {
  aggregateLevels,
  decimalsForTick,
} from "./tickAggregation";

const PRECISION_OPTIONS = [0.1, 0.01, 0.001] as const;

export interface OrderBookTableProps {
  assetId: AssetSymbol;
  /** Number of aggregated price levels to display per side. Defaults to 8. */
  depth?: number;
}

interface OrderBookRowProps {
  price: number;
  amount: number;
  maxAmount: number;
  precision: number;
  side: "bid" | "ask";
}

const OrderBookRow = memo(function OrderBookRow({
  price,
  amount,
  maxAmount,
  precision,
  side,
}: OrderBookRowProps) {
  const fill = maxAmount > 0 ? Math.min(100, (amount / maxAmount) * 100) : 0;
  const isBid = side === "bid";

  return (
    <div
      className="relative grid grid-cols-2 py-0.5 font-mono text-xs"
      role="row"
    >
      <span
        className={`absolute inset-y-0 ${isBid ? "right-0 bg-emerald-500/10" : "left-0 bg-rose-500/10"}`}
        style={{ width: `${fill}%` }}
        aria-hidden="true"
      />
      <span className={`relative ${isBid ? "text-emerald-400" : "text-rose-400"}`} role="cell">
        {formatOrderBookPrice(price, decimalsForTick(precision))}
      </span>
      <span className="relative text-right text-gray-300" role="cell">
        {formatCompactAmount(amount)}
      </span>
    </div>
  );
});

function OrderBookSkeleton({ depth }: { depth: number }) {
  return (
    <div className="grid grid-cols-2 gap-4" aria-label="Loading order book">
      {[0, 1].map((column) => (
        <div key={column} className="space-y-1.5">
          {Array.from({ length: depth }, (_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ))}
    </div>
  );
}

function OrderBookTableComponent({ assetId, depth = 8 }: OrderBookTableProps) {
  const mounted = useMounted();
  const visibleDepth = Math.max(1, Math.floor(depth));
  const { orderBook, isConnected } = useOrderBook({
    assetId,
    depth: visibleDepth * 10,
  });
  const [precision, setPrecision] = useState<number>(0.01);
  const priceDigits = decimalsForTick(precision);

  const aggregated = useMemo(() => {
    if (!orderBook) return null;

    return {
      bids: aggregateLevels(orderBook.bids, precision, "bid", visibleDepth),
      asks: aggregateLevels(orderBook.asks, precision, "ask", visibleDepth),
    };
  }, [visibleDepth, orderBook, precision]);

  const maxAmount = aggregated
    ? Math.max(
        ...aggregated.bids.map((level) => level.amount),
        ...aggregated.asks.map((level) => level.amount),
        0,
      )
    : 0;
  const bestBid = orderBook?.bids[0]?.price;
  const bestAsk = orderBook?.asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;
  const spreadPercent =
    spread !== null && bestBid !== undefined && bestBid > 0
      ? (spread / bestBid) * 100
      : null;

  return (
    <section className="relative h-full max-w-full overflow-hidden rounded-2xl border border-[#1B2A3B] bg-[#0A121E] p-6 shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
            Order Book
          </p>
          <h3 className="mt-0.5 text-base font-black tracking-tight text-white">{assetId}</h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-[10px] font-semibold text-gray-400">
            Precision
            <select
              aria-label="Price precision"
              className="rounded border border-[#1B2A3B] bg-[#0A121E] px-2 py-1 font-mono text-xs text-white"
              value={precision}
              onChange={(event) => setPrecision(Number(event.target.value))}
            >
              {PRECISION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              mounted && isConnected
                ? "border-[#39FF14]/20 bg-[#39FF14]/10 text-[#39FF14]"
                : "border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
            }`}
            aria-live="polite"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mounted && isConnected ? "bg-[#39FF14]" : "bg-yellow-500"
              }`}
            />
            {mounted && isConnected ? "LIVE" : "OFF"}
          </span>
        </div>
      </div>

      {!mounted || !aggregated ? (
        <OrderBookSkeleton depth={visibleDepth} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {([
              ["bid", aggregated.bids],
              ["ask", aggregated.asks],
            ] as const).map(([side, levels]) => (
              <div
                className="min-w-0"
                key={side}
                role="table"
                aria-label={side === "bid" ? "Bids" : "Asks"}
              >
                <div
                  className="mb-1.5 grid grid-cols-2 text-[9px] font-semibold uppercase tracking-widest text-gray-600"
                  role="row"
                >
                  <span role="columnheader">Price</span>
                  <span className="text-right" role="columnheader">Amount</span>
                </div>
                <div className="space-y-0.5" role="rowgroup" aria-label={side === "bid" ? "Bids" : "Asks"}>
                  {levels.map((level) => (
                    <OrderBookRow
                      key={`${side}-${level.price}`}
                      price={level.price}
                      amount={level.amount}
                      maxAmount={maxAmount}
                      precision={precision}
                      side={side}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 border-t border-[#1B2A3B] pt-3 font-mono text-xs text-gray-400">
            <span>Spread</span>
            <span className="text-white">
              {spread === null ? "—" : formatOrderBookPrice(spread, priceDigits)}
            </span>
            {spreadPercent !== null && <span>({formatPercent(spreadPercent)})</span>}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[#1B2A3B] pt-3">
        <span className="font-mono text-[9px] text-gray-700">
          {orderBook ? `Updated ${new Date(orderBook.timestamp).toLocaleTimeString()}` : "—"}
        </span>
        <span className="font-mono text-[9px] tracking-widest text-gray-700">
          STELLARFLOW ORDER BOOK
        </span>
      </div>
    </section>
  );
}

export const OrderBookTable = memo(OrderBookTableComponent);
export default OrderBookTable;
