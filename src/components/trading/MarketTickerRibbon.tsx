"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ASSET_BASE_PRICES, ASSET_SYMBOL_LIST, type AssetSymbol } from "@/config/assetSymbols";
import { useOrderBook } from "@/app/hooks/useOrderBook";
import { useSocket } from "@/app/hooks/useSocket";
import type { PriceData } from "@/types";

export interface MarketTickerItem {
  pair: AssetSymbol;
  price: number;
  change24h: number;
  volume24h: number;
  quoteCurrency?: string;
}

export interface MarketTickerRibbonProps {
  markets?: readonly MarketTickerItem[];
  className?: string;
  onMarketClick?: (market: MarketTickerItem) => void;
}

const DEFAULT_MARKETS: readonly MarketTickerItem[] = [
  { pair: "NGN-XLM", price: ASSET_BASE_PRICES["NGN-XLM"], change24h: 2.84, volume24h: 4_250_000 },
  { pair: "USD-XLM", price: ASSET_BASE_PRICES["USD-XLM"], change24h: -0.72, volume24h: 1_850_000 },
  { pair: "EUR-XLM", price: ASSET_BASE_PRICES["EUR-XLM"], change24h: 1.18, volume24h: 920_000 },
];

function formatPrice(value: number, pair: AssetSymbol): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: pair === "NGN-XLM" ? 2 : 4,
    maximumFractionDigits: pair === "NGN-XLM" ? 2 : 6,
  });
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function MarketDepth({ pair }: { pair: AssetSymbol }) {
  const { orderBook } = useOrderBook({ assetId: pair, depth: 3 });
  const bestBid = orderBook?.bids[0];
  const bestAsk = orderBook?.asks[0];
  const spread = bestBid && bestAsk ? bestAsk.price - bestBid.price : null;

  return (
    <div className="market-ticker-depth" role="status" aria-label={`${pair} market depth`}>
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Market depth</span>
        {spread !== null && <span className="font-mono text-[10px] text-white/45">Spread {spread.toFixed(6)}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
        <div>
          <p className="mb-1 text-emerald-400/80">Bids</p>
          {(orderBook?.bids.slice(0, 3) ?? []).map((level) => (
            <div key={`bid-${level.price}`} className="flex justify-between gap-3 text-emerald-300">
              <span>{level.price.toFixed(6)}</span>
              <span className="text-white/55">{formatVolume(level.amount)}</span>
            </div>
          ))}
          {!orderBook && <p className="text-white/35">Waiting for feed</p>}
        </div>
        <div>
          <p className="mb-1 text-rose-400/80">Asks</p>
          {(orderBook?.asks.slice(0, 3) ?? []).map((level) => (
            <div key={`ask-${level.price}`} className="flex justify-between gap-3 text-rose-300">
              <span>{level.price.toFixed(6)}</span>
              <span className="text-white/55">{formatVolume(level.amount)}</span>
            </div>
          ))}
          {!orderBook && <p className="text-white/35">Waiting for feed</p>}
        </div>
      </div>
    </div>
  );
}

const MarketPill = memo(function MarketPill({
  market,
  onClick,
  onActiveChange,
}: {
  market: MarketTickerItem;
  onClick: (market: MarketTickerItem) => void;
  onActiveChange: (pair: AssetSymbol | null) => void;
}) {
  const isPositive = market.change24h >= 0;

  return (
    <button
      type="button"
      className="market-ticker-pill group relative shrink-0 text-left"
      onClick={() => onClick(market)}
      onMouseEnter={() => onActiveChange(market.pair)}
      onMouseLeave={() => onActiveChange(null)}
      onFocus={() => onActiveChange(market.pair)}
      onBlur={() => onActiveChange(null)}
      aria-label={`Open ${market.pair} trading view`}
    >
      <span className="flex items-center gap-3 whitespace-nowrap">
        <span className="font-semibold tracking-wide text-white">{market.pair.replace("-", " /")}</span>
        <span className="font-mono text-white/85">{formatPrice(market.price, market.pair)}</span>
        <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
          {isPositive ? "+" : "-"}{Math.abs(market.change24h).toFixed(2)}%
        </span>
        <span className="text-white/35">Vol {formatVolume(market.volume24h)}</span>
      </span>
    </button>
  );
});

function ActiveMarketDepth({ pair }: { pair: AssetSymbol }) {
  return <MarketDepth pair={pair} />;
}

export default function MarketTickerRibbon({
  markets = DEFAULT_MARKETS,
  className = "",
  onMarketClick,
}: MarketTickerRibbonProps) {
  const router = useRouter();
  const [liveMarkets, setLiveMarkets] = useState<readonly MarketTickerItem[]>(markets);
  const [activePair, setActivePair] = useState<AssetSymbol | null>(null);
  const { lastUpdate, isConnected } = useSocket({ assetIds: [...ASSET_SYMBOL_LIST] });

  useEffect(() => {
    setLiveMarkets(markets);
  }, [markets]);

  useEffect(() => {
    if (!lastUpdate) return;
    const update = lastUpdate as PriceData;
    setLiveMarkets((current) => current.map((market) => (
      market.pair === update.assetPair ? { ...market, price: update.price } : market
    )));
  }, [lastUpdate]);

  const handleMarketClick = (market: MarketTickerItem) => {
    if (onMarketClick) {
      onMarketClick(market);
      return;
    }
    router.push(`/swap?asset=${encodeURIComponent(market.pair)}`);
  };

  const items = [...liveMarkets, ...liveMarkets];

  return (
    <div className={`relative ${className}`}>
      <section className="market-ticker-ribbon" aria-label="Live market prices">
      <style>{`
        .market-ticker-ribbon { position: relative; overflow: hidden; contain: content; border-block: 1px solid rgba(255,255,255,.08); background: #0b111b; }
        .market-ticker-track { display: flex; width: max-content; animation: market-ticker-scroll 34s linear infinite; will-change: transform; }
        .market-ticker-ribbon:hover .market-ticker-track, .market-ticker-ribbon:focus-within .market-ticker-track { animation-play-state: paused; }
        .market-ticker-pill { margin: 0; min-height: 42px; padding: 0 22px; border-right: 1px solid rgba(255,255,255,.08); background: transparent; transition: background-color 160ms ease; }
        .market-ticker-pill:hover, .market-ticker-pill:focus-visible { background: rgba(255,255,255,.06); outline: none; }
        .market-ticker-depth { pointer-events: none; position: absolute; z-index: 10; top: calc(100% + 8px); left: 50%; width: 258px; transform: translate(-50%, -4px); border: 1px solid rgba(255,255,255,.13); border-radius: 8px; background: rgba(13,20,31,.98); padding: 12px; box-shadow: 0 14px 32px rgba(0,0,0,.35); opacity: 0; transition: opacity 140ms ease, transform 140ms ease; }
        .market-ticker-pill:hover .market-ticker-depth, .market-ticker-pill:focus-visible .market-ticker-depth { opacity: 1; transform: translate(-50%, 0); }
        .market-depth-overlay .market-ticker-depth { opacity: 1; transform: none; position: relative; top: 0; left: 0; width: 100%; }
        @keyframes market-ticker-scroll { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }
        @media (prefers-reduced-motion: reduce) { .market-ticker-track { animation: none; } .market-ticker-depth { transition: none; } }
      `}</style>
      <div className="market-ticker-track" data-connected={isConnected}>
        {items.map((market, index) => (
          <MarketPill
            key={`${market.pair}-${index}`}
            market={market}
            onClick={handleMarketClick}
            onActiveChange={setActivePair}
          />
        ))}
      </div>
      </section>
      {activePair && (
        <div className="market-depth-overlay pointer-events-none absolute left-4 top-full z-20 mt-2 w-[min(258px,calc(100vw-2rem))]">
          <ActiveMarketDepth pair={activePair} />
        </div>
      )}
    </div>
  );
}