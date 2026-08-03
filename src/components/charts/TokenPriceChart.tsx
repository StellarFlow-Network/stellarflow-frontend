import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';

export type Timeframe = '1H' | '24H' | '7D' | '1M';

export interface TokenPriceChartProps {
  pairId: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  height?: number;
}

interface OHLCVPoint {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

const TIMEFRAMES: Timeframe[] = ['1H', '24H', '7D', '1M'];

export const TokenPriceChart: React.FC<TokenPriceChartProps> = ({
  pairId,
  tokenASymbol,
  tokenBSymbol,
  height = 400,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('24H');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);

  // Fetch OHLCV data from API endpoint
  const fetchChartData = useCallback(async (pair: string, tf: Timeframe): Promise<OHLCVPoint[]> => {
    try {
      const response = await fetch(`/api/v1/pools/${pair}/ohlcv?timeframe=${tf}`);
      if (!response.ok) throw new Error('Failed to fetch price data');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching OHLCV data:', error);
      return [];
    }
  }, []);

  // Initialize Lightweight Chart instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Responsive resize listener
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // Update Chart Data on Pair or Timeframe change
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      const ohlcvData = await fetchChartData(pairId, activeTimeframe);

      if (!isMounted || !seriesRef.current) return;

      const formattedData: CandlestickData<Time>[] = ohlcvData.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      seriesRef.current.setData(formattedData);

      if (formattedData.length > 0) {
        const lastCandle = formattedData[formattedData.length - 1];
        const firstCandle = formattedData[0];
        setCurrentPrice(lastCandle.close);
        
        const change = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
        setPriceChange24h(change);
      }

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      setIsLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [pairId, activeTimeframe, fetchChartData]);

  return (
    <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
      {/* Header: Token Pair Info & Timeframe Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">
            {tokenASymbol} / {tokenBSymbol}
          </h2>
          {currentPrice !== null && (
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-2xl font-mono font-bold text-white">
                ${currentPrice.toFixed(4)}
              </span>
              <span
                className={`text-sm font-semibold font-mono ${
                  priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {priceChange24h >= 0 ? '+' : ''}
                {priceChange24h.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Timeframe Toggles */}
        <div className="flex rounded-lg bg-gray-800 p-1 border border-gray-700">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTimeframe === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="relative w-full" style={{ height }}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/80 backdrop-blur-xs">
            <span className="text-sm font-medium text-gray-400 animate-pulse">
              Loading chart data...
            </span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};