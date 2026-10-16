export type FrontRunningRiskLevel = "low" | "medium" | "severe";

export interface FrontRunningRiskAssessment {
  depthSharePercent: number;
  risk: FrontRunningRiskLevel;
  recommendedSlippagePercent: number;
  recommendation: string;
}

export function assessFrontRunningRisk(
  orderSizeUsd: number,
  marketDepthUsd: number,
): FrontRunningRiskAssessment {
  const orderSize = Number.isFinite(orderSizeUsd) ? Math.max(0, orderSizeUsd) : 0;
  const depth = Number.isFinite(marketDepthUsd) ? Math.max(0, marketDepthUsd) : 0;
  const depthSharePercent = orderSize === 0 ? 0 : depth === 0 ? 100 : Math.min(100, (orderSize / depth) * 100);
  const risk: FrontRunningRiskLevel = depthSharePercent > 5
    ? "severe"
    : depthSharePercent > 1
      ? "medium"
      : "low";

  if (risk === "severe") {
    return {
      depthSharePercent,
      risk,
      recommendedSlippagePercent: 0.5,
      recommendation: "Reduce or split the order; a tight slippage limit cannot remove sandwich risk.",
    };
  }
  if (risk === "medium") {
    return {
      depthSharePercent,
      risk,
      recommendedSlippagePercent: 0.5,
      recommendation: "Consider splitting the order and keep slippage at or below 0.5%.",
    };
  }
  return {
    depthSharePercent,
    risk,
    recommendedSlippagePercent: 0.1,
    recommendation: "Current size is small relative to visible depth; keep slippage near 0.1%.",
  };
}