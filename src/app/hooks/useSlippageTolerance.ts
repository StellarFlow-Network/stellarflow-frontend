import { useCallback, useState } from "react";
import { loadStoredSlippage, saveStoredSlippage } from "@/lib/slippage";

/** Default safety threshold (percent) above which a spread warning is shown. */
export const DEFAULT_SPREAD_WARNING_THRESHOLD = 2.0;

/**
 * Persists the user's chosen slippage tolerance (percentage) to localStorage
 * so it survives across swap sessions. This hook only mounts inside
 * `SlippageSettingsModal`, which is conditionally rendered client-side (never part
 * of server-rendered HTML), so reading localStorage in the lazy state
 * initializer is safe from hydration mismatches.
 */
export function useSlippageTolerance() {
  const [slippagePercent, setSlippagePercentState] = useState<number>(
    () => loadStoredSlippage(),
  );

  const setSlippagePercent = useCallback((percent: number) => {
    setSlippagePercentState(percent);
    saveStoredSlippage(percent);
  }, []);

  const isSpreadUnsafe = useCallback(
    (spreadPercent: number, threshold = DEFAULT_SPREAD_WARNING_THRESHOLD) =>
      Number.isFinite(spreadPercent) && spreadPercent > threshold,
    []
  );

  return { slippagePercent, setSlippagePercent, isSpreadUnsafe };
}

export default useSlippageTolerance;
