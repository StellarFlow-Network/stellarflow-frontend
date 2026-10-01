"use client";

import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "@/app/hooks/useSocket";
import type { AssetSymbol } from "@/config/assetSymbols";
import { CHART_TIMEFRAME_EVENT } from "@/lib/keyboardShortcuts";
import {
  finiteNumber,
  mapHistoricalOhlcv,
  normalizeTimestamp,
  type OhlcvCandle,
} from "@/lib/tradingOhlcv";

export const CANDLE_RESOLUTIONS = ["1m", "5m", "15m", "1h", "1d"] as const;
export type CandleResolution = (typeof CANDLE_RESOLUTIONS)[number];

export interface CandlestickChartProps {
  pairId: AssetSymbol;
  baseSymbol: string;
  quoteSymbol: string;
  height?: number;
}

interface CandleTooltip {
  x: number;
  y: number;
  time: string;
  high: number;
  low: number;
  close: number;
}

const RESOLUTION_SECONDS: Record<CandleResolution, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

function movingAverage(candles: OhlcvCandle[], period = 20): LineData<Time>[] {
  return candles.flatMap((candle, index) => {
    const start = index - period + 1;
    if (start < 0) return [];
    const value = candles.slice(start, index + 1).reduce((total, item) => total + item.close, 0) / period;
    return [{ time: candle.time as Time, value }];
  });
}

function formatPrice(value: number): string {
  return value >= 1 ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : value.toPrecision(5);
}

function formatCandleTime(time: number): string {
  return new Date(time * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function liveVolume(update: unknown): number | undefined {
  if (typeof update !== "object" || update === null || !("metadata" in update)) return undefined;
  const metadata = update.metadata;
  if (typeof metadata !== "object" || metadata === null || !("volume" in metadata)) return undefined;
  return finiteNumber(metadata.volume) ?? undefined;
}

export default function CandlestickChart({
  pairId,
  baseSymbol,
  quoteSymbol,
  height = 360,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  const averageSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const candlesRef = useRef<OhlcvCandle[]>([]);
  const resolutionRef = useRef<CandleResolution>("5m");
  const [resolution, setResolution] = useState<CandleResolution>("5m");
  const [candles, setCandles] = useState<OhlcvCandle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [showVolume, setShowVolume] = useState(true);
  const [showAverage, setShowAverage] = useState(true);
  const [tooltip, setTooltip] = useState<CandleTooltip | null>(null);
  const { isConnected: socketConnected, lastUpdate } = useSocket({ assetIds: [pairId] });

  const endpoint = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    const query = new URLSearchParams({ timeframe: resolution });
    return `${baseUrl}/api/v1/pools/${encodeURIComponent(pairId)}/ohlcv?${query.toString()}`;
  }, [pairId, resolution]);

  const handleCrosshairMove = useCallback((param: Parameters<NonNullable<IChartApi["subscribeCrosshairMove"]>>[0]) => {
    const series = candleSeriesRef.current;
    const value = series ? param.seriesData.get(series) as CandlestickData<Time> | undefined : undefined;
    if (!value || !param.point || param.point.x < 0 || param.point.y < 0) {
      setTooltip(null);
      return;
    }

    const time = typeof value.time === "number" ? value.time : null;
    if (time === null) {
      setTooltip(null);
      return;
    }
    setTooltip({
      x: param.point.x,
      y: param.point.y,
      time: formatCandleTime(time),
      high: value.high,
      low: value.low,
      close: value.close,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#a8b2ae",
        fontFamily: "var(--font-geist-sans), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.045)" },
        horzLines: { color: "rgba(255,255,255,0.045)" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: { priceFormatter: formatPrice },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#a3e635",
      downColor: "#fb7185",
      borderUpColor: "#a3e635",
      borderDownColor: "#fb7185",
      wickUpColor: "#a3e635",
      wickDownColor: "#fb7185",
      priceLineVisible: true,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    const averageSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    averageSeriesRef.current = averageSeries;
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && chartRef.current) chartRef.current.applyOptions({ width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      averageSeriesRef.current = null;
    };
  }, [height, handleCrosshairMove]);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    void fetch(endpoint, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Indexer request failed (${response.status}).`);
        return mapHistoricalOhlcv(await response.json());
      })
      .then((nextCandles) => {
        if (!isCurrent) return;
        candlesRef.current = nextCandles;
        setCandles(nextCandles);
        setLivePrice(nextCandles.at(-1)?.close ?? null);
        if (nextCandles.length === 0) setError("No historical candles are available for this market yet.");
      })
      .catch((cause: unknown) => {
        if (!isCurrent || (cause instanceof Error && cause.name === "AbortError")) return;
        setError(cause instanceof Error ? cause.message : "Could not load market history.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [endpoint]);

  useEffect(() => {
    resolutionRef.current = resolution;
  }, [resolution]);

  // Hotkey integration: the shortcut layer broadcasts the requested timeframe
  // and the chart applies it when it matches one of its own resolutions.
  useEffect(() => {
    const handleTimeframeShortcut = (event: Event) => {
      const detail = (event as CustomEvent<{ timeframe?: string }>).detail;
      const next = detail?.timeframe;
      if (!next) return;
      if (!(CANDLE_RESOLUTIONS as readonly string[]).includes(next)) return;
      setResolution(next as CandleResolution);
    };
    window.addEventListener(CHART_TIMEFRAME_EVENT, handleTimeframeShortcut);
    return () =>
      window.removeEventListener(CHART_TIMEFRAME_EVENT, handleTimeframeShortcut);
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const averageSeries = averageSeriesRef.current;
    if (!candleSeries || !volumeSeries || !averageSeries) return;

    const candleData: CandlestickData<Time>[] = candles.map(({ time, open, high, low, close }) => ({
      time: time as Time,
      open,
      high,
      low,
      close,
    }));
    const volumeData: HistogramData<Time>[] = candles.map((candle) => ({
      time: candle.time as Time,
      value: candle.volume,
      color: candle.close >= candle.open ? "rgba(163,230,53,0.42)" : "rgba(251,113,133,0.42)",
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    averageSeries.setData(movingAverage(candles));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
    averageSeriesRef.current?.applyOptions({ visible: showAverage });
  }, [showVolume, showAverage]);

  useEffect(() => {
    if (!lastUpdate || lastUpdate.assetPair !== pairId || !Number.isFinite(lastUpdate.price) || lastUpdate.price <= 0) return;
    const series = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!series || candlesRef.current.length === 0) return;

    const timestamp = normalizeTimestamp(lastUpdate.timestamp);
    if (timestamp === null) return;
    const step = RESOLUTION_SECONDS[resolutionRef.current];
    const candleTime = Math.floor(timestamp / step) * step;
    const previous = candlesRef.current[candlesRef.current.length - 1];
    if (candleTime < previous.time) return;

    const tickVolume = liveVolume(lastUpdate);
    const nextCandle: OhlcvCandle = candleTime === previous.time
      ? {
          ...previous,
          high: Math.max(previous.high, lastUpdate.price),
          low: Math.min(previous.low, lastUpdate.price),
          close: lastUpdate.price,
          volume: tickVolume === undefined ? previous.volume : previous.volume + tickVolume,
        }
      : {
          time: candleTime,
          open: lastUpdate.price,
          high: lastUpdate.price,
          low: lastUpdate.price,
          close: lastUpdate.price,
          volume: tickVolume ?? 0,
        };

    if (candleTime === previous.time) candlesRef.current[candlesRef.current.length - 1] = nextCandle;
    else candlesRef.current.push(nextCandle);
    setLivePrice(lastUpdate.price);

    series.update({
      time: nextCandle.time as Time,
      open: nextCandle.open,
      high: nextCandle.high,
      low: nextCandle.low,
      close: nextCandle.close,
    });
    volumeSeries?.update({
      time: nextCandle.time as Time,
      value: nextCandle.volume,
      color: nextCandle.close >= nextCandle.open ? "rgba(163,230,53,0.42)" : "rgba(251,113,133,0.42)",
    });

    const averageCandles = candlesRef.current.slice(-20);
    if (averageCandles.length === 20) {
      averageSeriesRef.current?.update({
        time: nextCandle.time as Time,
        value: averageCandles.reduce((total, candle) => total + candle.close, 0) / averageCandles.length,
      });
    }
  }, [lastUpdate, pairId]);

  const activePrice = livePrice ?? candles.at(-1)?.close;
  const priceChange = useMemo(() => {
    if (candles.length === 0 || candles[0].open === 0 || activePrice === undefined || activePrice === null) return null;
    return ((activePrice - candles[0].open) / candles[0].open) * 100;
  }, [activePrice, candles]);

  return (
    <section className="min-w-0 rounded-xl border border-white/10 bg-[#111814] p-4 text-white sm:p-5" aria-label={`${baseSymbol} to ${quoteSymbol} price chart`}>
      <header className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold">{baseSymbol} / {quoteSymbol}</h2>
            <div className="mt-1 flex min-h-5 items-center gap-2 font-mono text-sm">
              {activePrice !== undefined && <span>{formatPrice(activePrice)}</span>}
              {priceChange !== null && (
                <span className={priceChange >= 0 ? "text-lime-300" : "text-rose-300"}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${socketConnected ? "border-lime-300/20 bg-lime-300/[0.07] text-lime-200" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? "bg-lime-300" : "bg-white/35"}`} />
            {socketConnected ? "Live feed" : "Feed offline"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-white/10 bg-black/20 p-1" role="group" aria-label="Chart resolution">
            {CANDLE_RESOLUTIONS.map((item, index) => (
              <button
                key={item}
                type="button"
                title={`Switch to ${item} (press ${index + 1})`}
                aria-pressed={resolution === item}
                onClick={() => setResolution(item)}
                className={`min-h-9 rounded-md px-2.5 text-xs font-semibold transition-colors ${resolution === item ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <label className="inline-flex min-h-9 items-center gap-2">
              <input type="checkbox" checked={showVolume} onChange={(event) => setShowVolume(event.target.checked)} className="accent-lime-300" />
              Volume
            </label>
            <label className="inline-flex min-h-9 items-center gap-2">
              <input type="checkbox" checked={showAverage} onChange={(event) => setShowAverage(event.target.checked)} className="accent-sky-400" />
              MA 20
            </label>
          </div>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-lg bg-black/15" style={{ height }}>
        <div ref={containerRef} className="h-full w-full" />
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 max-w-[calc(100%-1rem)] rounded-md border border-white/10 bg-[#0d1411]/95 px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(tooltip.x + 12, Math.max(8, (containerRef.current?.clientWidth ?? 320) - 172)),
              top: Math.max(8, Math.min(tooltip.y + 12, height - 92)),
            }}
          >
            <p className="mb-1 text-white/50">{tooltip.time}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
              <span className="text-white/55">High</span><span>{formatPrice(tooltip.high)}</span>
              <span className="text-white/55">Low</span><span>{formatPrice(tooltip.low)}</span>
              <span className="text-white/55">Close</span><span>{formatPrice(tooltip.close)}</span>
            </div>
          </div>
        )}
        {isLoading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/45" role="status">
            Loading {resolution} history…
          </div>
        )}
        {!isLoading && error && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/50" role="status">
            {error}
          </div>
        )}
        {!isLoading && error && candles.length > 0 && (
          <p className="absolute left-3 top-3 rounded bg-[#0d1411]/90 px-2 py-1 text-xs text-amber-200" role="status">
            Showing loaded candles · {error}
          </p>
        )}
      </div>
      <p className="mt-3 text-[11px] text-white/35">
        Historical OHLCV with live price ticks. Volume updates only when the feed supplies trade volume.
      </p>
    </section>
  );
}
