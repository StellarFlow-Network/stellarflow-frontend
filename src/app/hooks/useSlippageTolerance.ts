import { useCallback, useState } from "react";
import { loadStoredSlippage, saveStoredSlippage } from "@/lib/slippage";

/**
 * Persists the user's chosen slippage tolerance (percentage) to localStorage
 * so it survives across swap sessions. This hook only mounts inside
 * `SlippageModal`, which is conditionally rendered client-side (never part
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

  return { slippagePercent, setSlippagePercent };
}

export default useSlippageTolerance;
