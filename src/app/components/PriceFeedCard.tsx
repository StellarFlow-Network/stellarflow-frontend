"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceFeedData {
  price: number;          // current NGN/XLM price
  change_24h: number;     // 24-hour percentage change (positive = up, negative = down)
  high_24h: number;       // 24h high
  low_24h: number;        // 24h low
  volume_24h: number;     // 24h volume in XLM
  last_updated: string;   // ISO timestamp
}

interface PriceFeedCardProps {
  /** Polling interval in milliseconds. Defaults to 30 000 (30 s). */
  refreshInterval?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches the NGN/XLM price feed from the StellarFlow oracle API.
 * Adjust the endpoint URL to match your actual backend.
 */
async function fetchNgnXlmFeed(): Promise<PriceFeedData> {
  const res = await fetch("/api/price-feed/ngn-xlm", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Price feed request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // Normalise the API response shape.
  // The guardrail requires the Up/Down arrow to be driven by `24h_change`.
  return {
    price: Number(json.price ?? json.current_price ?? 0),
    change_24h: Number(json["24h_change"] ?? json.change_24h ?? json.price_change_percentage_24h ?? 0),
    high_24h: Number(json["24h_high"] ?? json.high_24h ?? 0),
    low_24h: Number(json["24h_low"] ?? json.low_24h ?? 0),
    volume_24h: Number(json["24h_volume"] ?? json.volume_24h ?? 0),
    last_updated: String(json.last_updated ?? new Date().toISOString()),
  };
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "--:--:--";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SkeletonPulse = ({ className }: { className?: string }) => (
  <span className={`block animate-pulse rounded bg-white/10 ${className ?? ""}`} />
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PriceFeedCard: React.FC<PriceFeedCardProps> = ({
  refreshInterval = 30_000,
}) => {
  const [data, setData] = useState<PriceFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    setError(null);

    try {
      const feed = await fetchNgnXlmFeed();
      setData(feed);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load price feed.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    load();
    const id = setInterval(() => load(), refreshInterval);
    return () => clearInterval(id);
  }, [load, refreshInterval]);

  // ── Guardrail: Up/Down arrow is STRICTLY driven by the 24h_change field ──
  const isUp = data !== null && data.change_24h >= 0;
  const changeAbs = data ? Math.abs(data.change_24h).toFixed(2) : "0.00";

  // ── Colour tokens ──────────────────────────────────────────────────────────
  const trendBg = isUp
    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    : "bg-rose-500/10 border-rose-500/20 text-rose-400";

  const trendGlow = isUp
    ? "shadow-[0_0_18px_rgba(52,211,153,0.18)]"
    : "shadow-[0_0_18px_rgba(244,63,94,0.18)]";

  const priceColor = isUp ? "text-emerald-400" : "text-rose-400";

  return (
    <div
      className={`
        relative overflow-hidden
        bg-[#0A121E] border border-[#1B2A3B] rounded-2xl p-6
        shadow-lg hover:border-[#39FF14]/40 transition-all duration-300 group
        ${!loading && !error ? trendGlow : ""}
      `}
    >
      {/* ── Subtle radial glow in the background ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(57,255,20,0.04),transparent_60%)]" />

      {/* ── Header row ── */}
      <div className="relative flex items-start justify-between gap-3 mb-5">
        <div>
          {/* Pair label */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500 group-hover:text-[#39FF14]/70 transition-colors">
            Price Feed
          </p>
          <h3 className="mt-0.5 text-base font-black tracking-tight text-white">
            NGN <span className="text-[#39FF14]">/</span> XLM
          </h3>
        </div>

        {/* Live badge + refresh button */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-2.5 py-1 text-[10px] font-semibold text-[#39FF14]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39FF14] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#39FF14]" />
            </span>
            LIVE
          </span>

          <button
            onClick={() => load(true)}
            disabled={isRefreshing || loading}
            aria-label="Refresh price feed"
            className="flex items-center justify-center w-7 h-7 rounded-full border border-[#1B2A3B] bg-[#0A0F1E] text-gray-500 hover:text-[#39FF14] hover:border-[#39FF14]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* ── Price + 24h change ── */}
      {loading ? (
        <div className="space-y-3 mb-5">
          <SkeletonPulse className="h-10 w-3/4" />
          <SkeletonPulse className="h-5 w-1/3" />
        </div>
      ) : error ? (
        <div className="mb-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3">
          <p className="text-xs font-semibold text-rose-400">Feed unavailable</p>
          <p className="mt-0.5 text-[11px] text-rose-400/70 break-all">{error}</p>
        </div>
      ) : (
        <div className="relative mb-5">
          {/* Current price */}
          <div className={`text-4xl font-black leading-none tracking-tight ${priceColor}`}>
            {formatPrice(data!.price)}
          </div>

          {/* 24h change badge — arrow direction is STRICTLY from 24h_change field */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${trendBg}`}
              aria-label={`24-hour change: ${isUp ? "up" : "down"} ${changeAbs}%`}
            >
              {/* Arrow: ▲ when 24h_change >= 0, ▼ when 24h_change < 0 */}
              <span aria-hidden="true">{isUp ? "▲" : "▼"}</span>
              <span>{changeAbs}%</span>
            </div>
            <span className="text-[10px] text-gray-600 font-medium italic">
              24h change
            </span>
          </div>
        </div>
      )}

      {/* ── 24h stats row ── */}
      {!loading && !error && data && (
        <div className="relative grid grid-cols-3 gap-3 border-t border-[#1B2A3B] pt-4">
          {/* High */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
              24h High
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {formatPrice(data.high_24h)}
            </span>
          </div>

          {/* Low */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
              24h Low
            </span>
            <span className="text-xs font-bold text-rose-400">
              {formatPrice(data.low_24h)}
            </span>
          </div>

          {/* Volume */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
              Volume
            </span>
            <span className="text-xs font-bold text-gray-300">
              {formatVolume(data.volume_24h)}{" "}
              <span className="text-gray-600 font-medium">XLM</span>
            </span>
          </div>
        </div>
      )}

      {/* ── Footer: last updated ── */}
      <div className="relative mt-4 flex items-center justify-between">
        <span className="text-[9px] text-gray-700 font-mono">
          {lastRefresh
            ? `Updated ${formatTime(lastRefresh.toISOString())}`
            : loading
            ? "Fetching…"
            : "—"}
        </span>
        <span className="text-[9px] text-gray-700 font-mono tracking-widest">
          STELLARFLOW ORACLE
        </span>
      </div>
    </div>
  );
};

export default PriceFeedCard;
