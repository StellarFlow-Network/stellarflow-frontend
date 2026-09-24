"use client";

/**
 * AssetBreakdownStackedBar — #762
 *
 * Horizontal stacked bar chart that visualises how each asset's total USD
 * value is distributed across the four protocol-lock categories:
 *   • Available      (emerald)
 *   • Limit Orders   (amber)
 *   • Vaults         (purple)
 *   • Liquidity Pools (cyan)
 *
 * Built with chart.js — the same library already used by
 * PortfolioAllocationChart and PortfolioHistoryChart — so no new
 * dependency is introduced.
 *
 * The chart is horizontally oriented so long asset names (e.g. "NGNC") don't
 * crowd the x-axis.  Each bar's segment widths are proportional to their USD
 * share within that asset's total.
 *
 * Accessibility: the canvas carries an aria-label; a visually-hidden summary
 * table is rendered beneath it for screen-reader users.
 */

import React, { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from "chart.js";
import type { PerAssetBreakdown } from "@/types/portfolio";

// Register only the elements we need — avoids pulling in the full chart bundle.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors WalletBalanceBreakdown colour scheme
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  available: {
    background: "rgba(52, 211, 153, 0.85)",  // emerald-400
    border: "#34d399",
    label: "Available",
  },
  limitOrders: {
    background: "rgba(251, 191, 36, 0.85)",  // amber-400
    border: "#fbbf24",
    label: "Limit Orders",
  },
  vaults: {
    background: "rgba(167, 139, 250, 0.85)", // purple-400
    border: "#a78bfa",
    label: "Vaults",
  },
  liquidityPools: {
    background: "rgba(34, 211, 238, 0.85)",  // cyan-400
    border: "#22d3ee",
    label: "Liquidity Pools",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetBreakdownStackedBarProps {
  breakdownByAsset: PerAssetBreakdown[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AssetBreakdownStackedBar({
  breakdownByAsset,
}: AssetBreakdownStackedBarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || breakdownByAsset.length === 0) return;

    const labels = breakdownByAsset.map((a) => a.symbol);

    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: COLORS.available.label,
            data: breakdownByAsset.map((a) => a.breakdown.availableUsd),
            backgroundColor: COLORS.available.background,
            borderColor: COLORS.available.border,
            borderWidth: 1,
            borderSkipped: false,
          },
          {
            label: COLORS.limitOrders.label,
            data: breakdownByAsset.map((a) => a.breakdown.limitOrdersUsd),
            backgroundColor: COLORS.limitOrders.background,
            borderColor: COLORS.limitOrders.border,
            borderWidth: 1,
            borderSkipped: false,
          },
          {
            label: COLORS.vaults.label,
            data: breakdownByAsset.map((a) => a.breakdown.vaultsUsd),
            backgroundColor: COLORS.vaults.background,
            borderColor: COLORS.vaults.border,
            borderWidth: 1,
            borderSkipped: false,
          },
          {
            label: COLORS.liquidityPools.label,
            data: breakdownByAsset.map((a) => a.breakdown.liquidityPoolsUsd),
            backgroundColor: COLORS.liquidityPools.background,
            borderColor: COLORS.liquidityPools.border,
            borderWidth: 1,
            borderSkipped: false,
          },
        ],
      },
      options: {
        // Horizontal orientation — indexAxis "y" swaps the axes so asset
        // symbols appear on the left and dollar amounts on the right.
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              color: "rgba(255,255,255,0.55)",
              boxWidth: 10,
              boxHeight: 10,
              borderRadius: 3,
              useBorderRadius: true,
              padding: 14,
              font: { size: 11 },
            },
          },
          tooltip: {
            mode: "index",
            axis: "y",
            callbacks: {
              label: (context) => {
                const value = context.parsed.x as number;
                return ` ${context.dataset.label}: ${formatUsd(value)}`;
              },
              footer: (items) => {
                const total = items.reduce(
                  (sum, item) => sum + (item.parsed.x as number),
                  0,
                );
                return `Total: ${formatUsd(total)}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: {
              color: "rgba(255,255,255,0.45)",
              callback: (value) => formatUsd(value as number),
              maxTicksLimit: 6,
            },
            border: { color: "transparent" },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: "rgba(255,255,255,0.70)",
              font: { size: 12, weight: 600 },
            },
            border: { color: "transparent" },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [breakdownByAsset]);

  // Dynamic height: at least 160px plus 44px per asset row so bars don't get
  // cramped when many assets are present.
  const chartHeight = Math.max(160, breakdownByAsset.length * 52 + 60);

  return (
    <div>
      {/* Chart */}
      <div style={{ height: chartHeight }}>
        <canvas
          ref={canvasRef}
          aria-label="Asset balance stacked bar chart by protocol lock category"
          role="img"
        />
      </div>

      {/* Screen-reader accessible summary table */}
      <table className="sr-only" aria-label="Asset balance summary table">
        <caption>Asset balance by protocol lock category</caption>
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col">Available</th>
            <th scope="col">Limit Orders</th>
            <th scope="col">Vaults</th>
            <th scope="col">Liquidity Pools</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {breakdownByAsset.map((asset) => (
            <tr key={asset.symbol}>
              <th scope="row">{asset.symbol}</th>
              <td>{formatUsd(asset.breakdown.availableUsd)}</td>
              <td>{formatUsd(asset.breakdown.limitOrdersUsd)}</td>
              <td>{formatUsd(asset.breakdown.vaultsUsd)}</td>
              <td>{formatUsd(asset.breakdown.liquidityPoolsUsd)}</td>
              <td>{formatUsd(asset.totalUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
