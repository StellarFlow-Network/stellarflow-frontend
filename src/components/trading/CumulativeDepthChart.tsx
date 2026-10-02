"use client";

import { memo } from "react";
import { useOrderBook } from "@/app/hooks/useOrderBook";
import type { AssetSymbol } from "@/config/assetSymbols";
import { DEFAULT_DEPTH_LEVELS } from "./CumulativeDepthChart.constants";
import { CumulativeDepthChartView } from "./CumulativeDepthChartView";

export interface CumulativeDepthChartProps {
  assetId: AssetSymbol;
  depth?: number;
  height?: number;
  className?: string;
}

function CumulativeDepthChartComponent({
  assetId,
  depth = DEFAULT_DEPTH_LEVELS,
  height,
  className,
}: CumulativeDepthChartProps) {
  const { orderBook, isConnected } = useOrderBook({ assetId, depth });

  return (
    <CumulativeDepthChartView
      assetId={assetId}
      orderBook={orderBook}
      isConnected={isConnected}
      height={height}
      className={className}
    />
  );
}

export const CumulativeDepthChart = memo(CumulativeDepthChartComponent);

export default CumulativeDepthChart;
