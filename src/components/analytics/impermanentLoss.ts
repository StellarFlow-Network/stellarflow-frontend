export interface ImpermanentLossInputs {
  initialAmountA: number;
  initialAmountB: number;
  initialPriceAUsd: number;
  initialPriceBUsd: number;
  currentPriceAUsd: number;
  currentPriceBUsd: number;
  currentLpValueUsd: number;
  feesClaimedUsd: number;
}

export interface ImpermanentLossResult {
  initialValueUsd: number;
  hodlValueUsd: number;
  activeLpValueUsd: number;
  feesClaimedUsd: number;
  impermanentLossUsd: number;
  impermanentLossPercent: number;
  feeAdjustedLossUsd: number;
  feeAdjustedRoiPercent: number;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateImpermanentLoss(
  inputs: ImpermanentLossInputs,
): ImpermanentLossResult {
  const initialValueUsd =
    nonNegative(inputs.initialAmountA) * nonNegative(inputs.initialPriceAUsd) +
    nonNegative(inputs.initialAmountB) * nonNegative(inputs.initialPriceBUsd);
  const hodlValueUsd =
    nonNegative(inputs.initialAmountA) * nonNegative(inputs.currentPriceAUsd) +
    nonNegative(inputs.initialAmountB) * nonNegative(inputs.currentPriceBUsd);
  const activeLpValueUsd = nonNegative(inputs.currentLpValueUsd);
  const feesClaimedUsd = nonNegative(inputs.feesClaimedUsd);
  const impermanentLossUsd = activeLpValueUsd - hodlValueUsd;
  const feeAdjustedLossUsd = impermanentLossUsd + feesClaimedUsd;

  return {
    initialValueUsd,
    hodlValueUsd,
    activeLpValueUsd,
    feesClaimedUsd,
    impermanentLossUsd,
    impermanentLossPercent:
      hodlValueUsd > 0 ? (impermanentLossUsd / hodlValueUsd) * 100 : 0,
    feeAdjustedLossUsd,
    feeAdjustedRoiPercent:
      initialValueUsd > 0
        ? ((activeLpValueUsd + feesClaimedUsd - initialValueUsd) / initialValueUsd) * 100
        : 0,
  };
}