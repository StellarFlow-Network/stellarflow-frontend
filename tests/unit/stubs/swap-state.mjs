/**
 * Deterministic double for the swap execution + slippage tolerance hooks.
 * `setSlippagePercent` mutates the in-memory value, mirroring the real hook's
 * persistence, so specs can assert how the UI reacts to a stored tolerance.
 */
let swapState = { isSwapping: false };
let slippageState = { slippagePercent: 0.5 };

export function __setSwapState(next) {
  swapState = { ...swapState, ...next };
}

export function __setSlippage(next) {
  slippageState = { ...slippageState, ...next };
}

export function __resetSwapState() {
  swapState = { isSwapping: false };
  slippageState = { slippagePercent: 0.5 };
}

export function useSwapExecution() {
  return {
    executeSwap: async () => {},
    isSwapping: swapState.isSwapping,
    feeEstimation: {
      customFee: 100,
      hasSufficientBalance: () => true,
    },
  };
}

export function useSlippageTolerance() {
  return {
    slippagePercent: slippageState.slippagePercent,
    setSlippagePercent: (percent) => {
      slippageState.slippagePercent = percent;
    },
  };
}
