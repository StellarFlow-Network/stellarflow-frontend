"use client";

import React, { useId, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Gauge,
  Info,
  RefreshCw,
  Zap,
  Flame,
  CheckCircle2,
} from "lucide-react";
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
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  useSorobanNetworkHealth,
  type CongestionLevel,
  type FeeTrendPoint,
} from "@/hooks/useSorobanNetworkHealth";
import { CongestionFeeAlert } from "./CongestionFeeAlert";

// Register Chart.js modules
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

export interface NetworkHealthWidgetProps {
  /** Title header for the widget */
  title?: string;
  /** Show top bar controls (timeframe, refresh, simulate toggle) */
  showControls?: boolean;
  /** Custom wrapper CSS class */
  className?: string;
}

type TimeFrame = "1h" | "6h" | "24h" | "7d";

const CONGESTION_CONFIG: Record<
  CongestionLevel,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    meterColor: string;
    glow: string;
    icon: React.ReactNode;
  }
> = {
  low: {
    label: "Low Congestion",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-400",
    border: "border-emerald-500/30",
    meterColor: "bg-emerald-500",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.3)]",
    icon: <CheckCircle2 size={15} className="text-emerald-400" />,
  },
  moderate: {
    label: "Moderate Congestion",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-400",
    border: "border-amber-500/30",
    meterColor: "bg-amber-500",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    icon: <Info size={15} className="text-amber-400" />,
  },
  high: {
    label: "High Congestion",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-400",
    border: "border-rose-500/40",
    meterColor: "bg-rose-500",
    glow: "shadow-[0_0_15px_rgba(239,68,68,0.4)]",
    icon: <Flame size={15} className="text-rose-400 animate-pulse" />,
  },
};

export function NetworkHealthWidget({
  title = "Soroban Network Gas & Congestion",
  showControls = true,
  className = "",
}: NetworkHealthWidgetProps) {
  const chartGradientId = useId();
  const {
    metrics,
    isLoading,
    error,
    isSimulatingHighCongestion,
    toggleSimulateHighCongestion,
    refresh,
  } = useSorobanNetworkHealth();

  const [timeframe, setTimeframe] = useState<TimeFrame>("24h");
  const [useFallbackChart, setUseFallbackChart] = useState(false);

  // Filter history based on timeframe selection
  const filteredHistory = React.useMemo(() => {
    const list = metrics.history24h;
    if (timeframe === "1h") return list.slice(-6);
    if (timeframe === "6h") return list.slice(-12);
    return list;
  }, [metrics.history24h, timeframe]);

  // Build Chart.js dataset configuration
  const chartData = React.useMemo(() => {
    const labels = filteredHistory.map((p) => p.timeLabel);
    const dataPoints = filteredHistory.map((p) => p.feeStroops);

    const isHigh = metrics.isHighCongestion;
    const strokeColor = isHigh ? "#ef4444" : "#10b981";
    const gradientTop = isHigh ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)";
    const gradientBottom = "rgba(15,23,42,0.0)";

    return {
      labels,
      datasets: [
        {
          label: "Inclusion Fee (Stroops)",
          data: dataPoints,
          borderColor: strokeColor,
          borderWidth: 2.5,
          pointBackgroundColor: strokeColor,
          pointBorderColor: "#090d16",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D } }) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 220);
            gradient.addColorStop(0, gradientTop);
            gradient.addColorStop(1, gradientBottom);
            return gradient;
          },
        },
      ],
    };
  }, [filteredHistory, metrics.isHighCongestion]);

  const chartOptions: ChartOptions<"line"> = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#94a3b8",
          bodyColor: "#f8fafc",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (item) => `Fee: ${item.formattedValue} stroops`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(51, 65, 85, 0.25)" },
          ticks: { color: "#64748b", font: { size: 11 } },
        },
        y: {
          grid: { color: "rgba(51, 65, 85, 0.25)" },
          ticks: { color: "#64748b", font: { size: 11 } },
          suggestedMin: 50,
        },
      },
    }),
    []
  );

  const congestion = CONGESTION_CONFIG[metrics.congestionLevel];

  // SVG Fallback trend renderer
  const renderSvgTrendChart = () => {
    const data = filteredHistory;
    if (data.length < 2) return null;

    const maxFee = Math.max(...data.map((d) => d.feeStroops), 500);
    const minFee = Math.min(...data.map((d) => d.feeStroops), 50);
    const range = maxFee - minFee || 1;

    const width = 600;
    const height = 180;
    const padding = 20;

    const pointsStr = data
      .map((d, index) => {
        const x = padding + (index / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((d.feeStroops - minFee) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

    const strokeColor = metrics.isHighCongestion ? "#ef4444" : "#10b981";

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />
        {data.map((d, index) => {
          const x = padding + (index / (data.length - 1)) * (width - padding * 2);
          const y = height - padding - ((d.feeStroops - minFee) / range) * (height - padding * 2);
          return (
            <circle
              key={d.timestamp}
              cx={x}
              cy={y}
              r="3.5"
              fill={strokeColor}
              stroke="#090d16"
              strokeWidth="2"
            />
          );
        })}
      </svg>
    );
  };

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl text-white ${className}`}
      aria-labelledby="network-health-title"
    >
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 -z-10 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 -z-10 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />

      {/* Header bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-lime-400 shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="network-health-title" className="text-lg font-bold tracking-tight text-white">
                {title}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live RPC Stats
              </span>
            </div>
            <p className="text-xs text-slate-400">
              SorobanRPC inclusion fee history, ledger congestion & block speed.
            </p>
          </div>
        </div>

        {showControls && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Selector */}
            <div className="flex rounded-lg border border-slate-800 bg-slate-900/90 p-1">
              {(["1h", "6h", "24h"] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition-all ${
                    timeframe === tf
                      ? "bg-slate-800 text-lime-400 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* High Congestion Simulator Toggle */}
            <button
              type="button"
              onClick={toggleSimulateHighCongestion}
              title="Simulate High Network Congestion for fee alert testing"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isSimulatingHighCongestion
                  ? "border-rose-500/50 bg-rose-950/40 text-rose-300 shadow-lg"
                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Flame size={13} className={isSimulatingHighCongestion ? "text-rose-400 animate-pulse" : ""} />
              {isSimulatingHighCongestion ? "Simulating High" : "Test High Traffic"}
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              aria-label="Refresh network health stats"
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </header>

      {/* Informational Fee Alert when Network is in High Congestion */}
      {metrics.isHighCongestion && (
        <div className="mt-4">
          <CongestionFeeAlert compact={false} dismissable={false} />
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Inclusion Fee Trend */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Base Inclusion Fee</span>
            <Zap size={14} className="text-lime-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              {metrics.currentFeeStroops}
            </span>
            <span className="text-xs font-semibold text-slate-400">stroops</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>≈ {metrics.currentFeeXLM} XLM</span>
            <span className="text-[11px] text-slate-500">24h Peak: {metrics.peakFee24hStroops} str</span>
          </div>
        </div>

        {/* Card 2: Congestion Meter */}
        <div className={`rounded-xl border ${congestion.border} ${congestion.badgeBg} p-4 backdrop-blur-sm transition-all`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Congestion Meter
            </span>
            {congestion.icon}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className={`text-base font-bold ${congestion.badgeText}`}>
              {congestion.label}
            </span>
            <span className={`font-mono text-sm font-black ${congestion.badgeText}`}>
              {metrics.congestionPercentage}%
            </span>
          </div>

          {/* Visual Congestion Meter Bar */}
          <div className="mt-2.5">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-500 ${congestion.meterColor} ${congestion.glow}`}
                style={{ width: `${metrics.congestionPercentage}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-500">
              <span>Low</span>
              <span>Moderate</span>
              <span>High</span>
            </div>
          </div>
        </div>

        {/* Card 3: Confirmation Speed Gauge */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Est. Confirmation Speed</span>
            <Gauge size={14} className="text-cyan-400" />
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tracking-tight text-cyan-300">
              {metrics.estimatedSpeedText}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
              <Clock size={12} className="text-slate-500" />
              Ledger #{metrics.ledgerSequence}
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">~5s/block</span>
          </div>
        </div>
      </div>

      {/* Line Chart Section: 24-Hour Inclusion Fee Trend */}
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>24-Hour Inclusion Fee Trend</span>
            <span className="text-[10px] font-mono text-slate-500">({timeframe.toUpperCase()})</span>
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Avg Fee: <strong className="text-slate-300">{metrics.avgFee24hStroops} stroops</strong>
          </span>
        </div>

        <div className="h-48 w-full">
          {!useFallbackChart ? (
            <Line
              data={chartData}
              options={chartOptions}
              onError={() => setUseFallbackChart(true)}
            />
          ) : (
            renderSvgTrendChart()
          )}
        </div>
      </div>
    </section>
  );
}

export default NetworkHealthWidget;
