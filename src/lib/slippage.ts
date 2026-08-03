/**
 * Slippage tolerance helpers for swap transactions.
 *
 * Slippage is expressed as a percentage (e.g. `0.5` for 0.5%) and used to
 * derive the `min_amount_out` guard passed to the Soroban swap transaction
 * builder, protecting the trader from excessive price movement between
 * quote time and on-chain execution.
 */

export const PRESET_SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0] as const;

export type PresetSlippage = (typeof PRESET_SLIPPAGE_OPTIONS)[number];

/** Custom slippage above this threshold is flagged as high risk in the UI. */
export const HIGH_SLIPPAGE_WARNING_THRESHOLD = 5;

/** Hard ceiling — values above this are rejected outright as invalid input. */
export const MAX_SLIPPAGE_PERCENT = 50;

const STORAGE_KEY = "stellarflow:slippage-tolerance";
const DEFAULT_SLIPPAGE_PERCENT: PresetSlippage = 0.5;

export interface SlippageValidationResult {
  valid: boolean;
  isHighRisk: boolean;
  error: string | null;
}

/**
 * Validates a user-supplied slippage percentage. Values must be a positive
 * number no greater than `MAX_SLIPPAGE_PERCENT`; anything past
 * `HIGH_SLIPPAGE_WARNING_THRESHOLD` is still valid but flagged as high risk.
 */
export function validateSlippagePercent(value: number): SlippageValidationResult {
  if (!Number.isFinite(value) || value <= 0) {
    return {
      valid: false,
      isHighRisk: false,
      error: "Slippage must be a positive number.",
    };
  }

  if (value > MAX_SLIPPAGE_PERCENT) {
    return {
      valid: false,
      isHighRisk: false,
      error: `Slippage cannot exceed ${MAX_SLIPPAGE_PERCENT}%.`,
    };
  }

  return {
    valid: true,
    isHighRisk: value > HIGH_SLIPPAGE_WARNING_THRESHOLD,
    error: null,
  };
}

/**
 * Computes the minimum acceptable output amount for a swap given the quoted
 * output and a slippage tolerance percentage. Rounds down (floor) so the
 * on-chain guard never permits less than the caller intended.
 *
 * @param quotedAmountOut expected output amount from the current quote
 * @param slippagePercent tolerance, e.g. `0.5` for 0.5%
 * @param decimals number of decimal places to preserve (default 7, Stellar's stroop precision)
 */
export function calculateMinAmountOut(
  quotedAmountOut: number,
  slippagePercent: number,
  decimals = 7,
): number {
  if (!Number.isFinite(quotedAmountOut) || quotedAmountOut < 0) {
    throw new RangeError("quotedAmountOut must be a non-negative number.");
  }

  const { valid, error } = validateSlippagePercent(slippagePercent);
  if (!valid) {
    throw new RangeError(error ?? "Invalid slippage percent.");
  }

  const factor = 1 - slippagePercent / 100;
  const scale = 10 ** decimals;
  return Math.floor(quotedAmountOut * factor * scale) / scale;
}

export function loadStoredSlippage(): number {
  if (typeof window === "undefined") {
    return DEFAULT_SLIPPAGE_PERCENT;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_SLIPPAGE_PERCENT;
    }

    const parsed = Number(raw);
    return validateSlippagePercent(parsed).valid ? parsed : DEFAULT_SLIPPAGE_PERCENT;
  } catch {
    return DEFAULT_SLIPPAGE_PERCENT;
  }
}

export function saveStoredSlippage(percent: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, String(percent));
  } catch {
    // localStorage may be unavailable (private browsing quota, etc.) — the
    // in-memory value from this session still applies, so this is safe to ignore.
  }
}

export { DEFAULT_SLIPPAGE_PERCENT };
