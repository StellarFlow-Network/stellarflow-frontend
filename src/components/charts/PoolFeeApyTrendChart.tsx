'use client';

import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RotateCcw,
  Info,
  Maximize2,
  X,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface PoolApyDataPoint {
  timestamp: number;
  feeApy: number;
  rewardApy: number;
  volume: number;
  tvl: number;
}

export interface PoolApyChartProps {
  poolId: string;
  pair: string;
  data: PoolApyDataPoint[];
  height?: number;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatApy(value: number): string {
  return `${value.toFixed(2)}%`;
}

function calculateMovingAverage(data: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - window + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }
  return result;
}

export function PoolFeeApyTrendChart({
  pair,
  data: rawData,
  height = 400,
}: PoolApyChartProps) {
  const [viewMode, setViewMode] = useState<'raw' | 'ma7' | 'ma30'>('raw');
  const [showFullscreen, setShowFullscreen] = useState(false);

  const sortedData = useMemo(
    () => [...rawData].sort((a, b) => a.timestamp - b.timestamp),
    [rawData]
  );

  const labels = useMemo(
    () => sortedData.map(d => new Date(d.timestamp).toLocaleDateString()),
    [sortedData]
  );

  const feeApyValues = useMemo(() => sortedData.map(d => d.feeApy), [sortedData]);
  const rewardApyValues = useMemo(() => sortedData.map(d => d.rewardApy), [sortedData]);
  const volumeValues = useMemo(() => sortedData.map(d => d.volume), [sortedData]);

  const feeApyMA7 = useMemo(() => calculateMovingAverage(feeApyValues, 7), [feeApyValues]);
  const rewardApyMA7 = useMemo(() => calculateMovingAverage(rewardApyValues, 7), [rewardApyValues]);
  const feeApyMA30 = useMemo(() => calculateMovingAverage(feeApyValues, 30), [feeApyValues]);
  const rewardApyMA30 = useMemo(() => calculateMovingAverage(rewardApyValues, 30), [rewardApyValues]);

  const chartData = useMemo((): ChartData<'line'> => {
    const datasets = [];

    // Fee APY
    datasets.push({
      label: 'Trading Fee APY',
      data: viewMode === 'raw' ? feeApyValues : viewMode === 'ma7' ? feeApyMA7 : feeApyMA30,
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: viewMode === 'raw' ? 3 : 0,
      pointHoverRadius: 5,
    });

    // Reward APY
    datasets.push({
      label: 'Base Token Reward APY',
      data: viewMode === 'raw' ? rewardApyValues : viewMode === 'ma7' ? rewardApyMA7 : rewardApyMA30,
      borderColor: '#fbbf24',
      backgroundColor: 'rgba(251, 191, 36, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: viewMode === 'raw' ? 3 : 0,
      pointHoverRadius: 5,
    });

    return {
      labels,
      datasets,
    };
  }, [labels, feeApyValues, rewardApyValues, feeApyMA7, rewardApyMA7, feeApyMA30, rewardApyMA30, viewMode]);

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { size: 12 },
            color: '#9ca3af',
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (context: TooltipItem<'line'>) => {
              const index = context.dataIndex;
              const point = sortedData[index];
              if (!point) return context.label || '';
              
              const lines = [`${context.dataset.label}: ${formatApy(context.raw as number)}`];
              if (context.datasetIndex === 0) {
                lines.push(`24h Volume: $${formatNumber(point.volume)}`);
                lines.push(`TVL: $${formatNumber(point.tvl)}`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(100, 116, 139, 0.1)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            maxTicksLimit: 10,
            callback: (value: string | number, index: number) => {
              if (index % Math.ceil(labels.length / 10) === 0) {
                return labels[index];
              }
              return '';
            },
          },
        },
        y: {
          grid: {
            color: 'rgba(100, 116, 139, 0.1)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: (value: string | number) => `${typeof value === 'number' ? value.toFixed(1) : value}%`,
          },
          beginAtZero: false,
        },
      },
      elements: {
        line: {
          spanGaps: true,
        },
      },
      animation: {
        duration: 300,
        easing: 'easeOutQuart',
      },
    }),
    [labels, sortedData]
  );

  const currentFeeApy = feeApyValues[feeApyValues.length - 1] || 0;
  const currentRewardApy = rewardApyValues[rewardApyValues.length - 1] || 0;
  const feeApyChange = feeApyValues.length > 1 
    ? feeApyValues[feeApyValues.length - 1] - feeApyValues[feeApyValues.length - 2] 
    : 0;
  const rewardApyChange = rewardApyValues.length > 1
    ? rewardApyValues[rewardApyValues.length - 1] - rewardApyValues[rewardApyValues.length - 2]
    : 0;

  const totalApy = currentFeeApy + currentRewardApy;

  const renderChart = () => (
    <div className="relative h-full w-full" style={{ height }}>
      <Line data={chartData} options={chartOptions} />
    </div>
  );

  const content = (
    <div className={`bg-[#161b22] border border-gray-800 rounded-xl p-6 ${showFullscreen ? 'fixed inset-4 z-50 max-h-[calc(100vh-2rem)] overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-500/20">
            <Activity size={20} className="text-sky-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">{pair} Fee APY Trend</h3>
            <p className="text-xs text-gray-500">Historical fee APY vs base token reward APY</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-gray-800/50 border border-gray-700 p-1" role="group" aria-label="Chart view mode">
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'raw'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              aria-pressed={viewMode === 'raw'}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ma7')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'ma7'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              aria-pressed={viewMode === 'ma7'}
            >
              7-Day MA
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ma30')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'ma30'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              aria-pressed={viewMode === 'ma30'}
            >
              30-Day MA
            </button>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setShowFullscreen(!showFullscreen)}
            className="p-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
            aria-label={showFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Maximize2 size={16} />
          </button>

          {showFullscreen && (
            <button
              type="button"
              onClick={() => setShowFullscreen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white"
              aria-label="Close fullscreen"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total APY"
          value={formatApy(totalApy)}
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          trend={feeApyChange + rewardApyChange}
        />
        <StatCard
          label="Fee APY"
          value={formatApy(currentFeeApy)}
          icon={<Activity size={18} className="text-sky-400" />}
          trend={feeApyChange}
        />
        <StatCard
          label="Reward APY"
          value={formatApy(currentRewardApy)}
          icon={<TrendingUp size={18} className="text-amber-400" />}
          trend={rewardApyChange}
        />
        <StatCard
          label="24h Volume"
          value={`$${formatNumber(volumeValues[volumeValues.length - 1] || 0)}`}
          icon={<RotateCcw size={18} className="text-violet-400" />}
        />
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        {renderChart()}
      </div>

      {/* Legend & Info */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-400" />
            Trading Fee APY
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            Base Token Reward APY
          </span>
          {viewMode !== 'raw' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700">
              <Info size={10} />
              {viewMode === 'ma7' ? '7-day' : '30-day'} moving average
            </span>
          )}
        </div>
        <p className="text-[10px]">
          Data points: {sortedData.length} • Hover for daily volume & TVL
        </p>
      </div>
    </div>
  );

  return showFullscreen ? (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      {content}
    </div>
  ) : (
    content
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
}) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold font-mono text-gray-100">{value}</div>
      {trend !== undefined && (
        <div className="mt-1 flex items-center gap-1 text-xs font-medium">
          {isPositive && <TrendingUp size={10} className="text-emerald-400" />}
          {isNegative && <TrendingDown size={10} className="text-red-400" />}
          {!isPositive && !isNegative && <span className="w-2" />}
          <span className={isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-gray-500'}>
            {isPositive || isNegative ? (trend > 0 ? '+' : '') + trend.toFixed(2) + '%' : '—'}
          </span>
        </div>
      )}
    </div>
  );
}

export default PoolFeeApyTrendChart;