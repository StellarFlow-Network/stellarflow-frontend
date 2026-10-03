export interface LiquidityTickPoint {
  tickIndex: number;
  lowerPrice: number;
  upperPrice: number;
  liquidity: number | string;
}

export interface LiquidityConcentrationHeatmapProps {
  ticks: LiquidityTickPoint[];
  activeTickIndex?: number;
  width?: number;
  height?: number;
  maxRenderPoints?: number;
  ariaLabel?: string;
}
