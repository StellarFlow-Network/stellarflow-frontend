export interface ILScenario {
  assetAChange: number;
  assetBChange: number;
  initialInvestment: number;
  feeEarningsPercent: number;
}

export interface ILScenarioResult {
  assetAReturn: number;
  assetBReturn: number;
  priceRatio: number;
  hodlValue: number;
  poolValue: number;
  feeIncome: number;
  netDifference: number;
  netImpermanentLoss: number;
  grossImpermanentLoss: number;
}

export function calculateImpermanentLoss(priceRatio: number): number {
  if (!Number.isFinite(priceRatio) || priceRatio <= 0) return -100;
  return ((2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1) * 100;
}

export function calculateILScenario({
  assetAChange,
  assetBChange,
  initialInvestment,
  feeEarningsPercent,
}: ILScenario): ILScenarioResult {
  const assetAReturn = Math.max(0, 1 + assetAChange / 100);
  const assetBReturn = Math.max(0, 1 + assetBChange / 100);
  const investment = Math.max(0, initialInvestment);
  const hodlValue = (investment / 2) * (assetAReturn + assetBReturn);
  const poolValue = investment * Math.sqrt(assetAReturn * assetBReturn);
  const feeIncome = investment * (Math.max(0, feeEarningsPercent) / 100);
  const netDifference = poolValue + feeIncome - hodlValue;
  const netImpermanentLoss = hodlValue > 0 ? (netDifference / hodlValue) * 100 : 0;
  const priceRatio = assetBReturn === 0
    ? assetAReturn === 0 ? 1 : Number.POSITIVE_INFINITY
    : assetAReturn / assetBReturn;
  const grossImpermanentLoss = calculateImpermanentLoss(priceRatio);

  return {
    assetAReturn,
    assetBReturn,
    priceRatio,
    hodlValue,
    poolValue,
    feeIncome,
    netDifference,
    netImpermanentLoss,
    grossImpermanentLoss,
  };
}
