/**
 * Impermanent loss (IL) mitigation score math.
 *
 * The score answers one question for an active LP position: how much of the
 * value lost to price divergence (impermanent loss) has been paid back by the
 * trading fees the position has accumulated?
 *
 *   M_offset = (Fees_collected / |IL|) * 100
 *
 * `Fees_collected` and `IL` are both USD values taken from the PnL
 * decomposition already used by `PoolPnLCard`:
 *
 *   totalPnL        = currentRedeemableValue - initialDepositValue
 *   feesCollected   = feesEarnedValue                     (fee yield leg)
 *   assetShiftValue = totalPnL - feesCollected            (IL / asset price leg)
 *
 * A negative `assetShiftValue` is the impermanent loss; a positive one means
 * the pool diverged in the LP's favour, so there is no loss left to offset.
 *
 * This module is intentionally pure (no React, no imports with runtime values)
 * so the math can be unit-tested with the Node test runner directly.
 */

import type { PoolPnLPosition } from "@/components/pools/PoolPnLCard";

/**
 * The subset of fields a `PoolPnLPosition` needs to expose to be scored.
 * Derived from the existing exported type rather than redefined.
 */
export type IlMitigationPositionInput = Pick<
  PoolPnLPosition,
  "initialDepositValue" | "currentRedeemableValue" | "feesEarnedValue"
>;

export type IlMitigationStatus =
  /** Fees fully cover the IL (or there was no IL at all). */
  | "net-profitable"
  /** Fees offset part of the IL, but a gap remains. */
  | "partial"
  /** No fees accrued, so none of the IL is offset. */
  | "unmitigated"
  /** The pool diverged in the LP's favour; there is no IL to offset. */
  | "no-divergence";

export interface IlMitigationInput {
  /** USD value of trading fees collected by the position since deposit. */
  feesCollected: number;
  /**
   * Signed USD value of the asset-shift leg of PnL. Negative values are
   * impermanent loss, positive values are a favourable divergence.
   */
  impermanentLossValue: number;
}

export interface IlMitigationScore {
  /** Fees collected, coerced to a finite number (non-finite input becomes 0). */
  feesCollected: number;
  /** Absolute USD magnitude of the impermanent loss (0 when there is none). */
  ilMagnitude: number;
  /**
   * Raw mitigation ratio as a percentage. `null` when there is no IL to
   * offset, because the ratio is undefined (division by zero); callers should
   * render the dedicated "no IL" state instead of a percentage.
   */
  mitigationPercent: number | null;
  /**
   * Display-safe fill for the progress meter: always finite and clamped to
   * [0, 100], so an overflow (e.g. 125%) fills the meter completely.
   */
  meterPercent: number;
  /** True when fees exceed the IL, i.e. the position is net profitable. */
  isNetProfitable: boolean;
  status: IlMitigationStatus;
}

/** Progress meters are filled in whole percent, so clamp before rendering. */
const METER_MAX = 100;

function toFinite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(METER_MAX, Math.max(0, value));
}

/** Rates are displayed to two decimals to match `PoolPnLCard`'s formatting. */
function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Compute the fee-offset mitigation score for a single position leg.
 *
 * Edge cases are explicit so no `NaN`/`Infinity` ever reaches the UI:
 * - `IL === 0` (no divergence): the ratio is undefined, so
 *   `mitigationPercent` is `null`, the meter is treated as full and the
 *   status is `"no-divergence"` rather than dividing by zero.
 * - zero fees: `0%` offset, status `"unmitigated"`.
 * - negative fees (data anomaly): the score stays a real number and the meter
 *   clamps to 0 instead of rendering a negative bar.
 * - non-finite inputs are coerced to 0.
 */
export function computeIlMitigation({
  feesCollected: rawFees,
  impermanentLossValue,
}: IlMitigationInput): IlMitigationScore {
  const feesCollected = toFinite(rawFees);
  const signedShift = toFinite(impermanentLossValue);

  // Only a negative asset shift is an impermanent loss; a positive shift means
  // the pool moved in the LP's favour, leaving nothing to offset.
  const ilMagnitude = signedShift < 0 ? Math.abs(signedShift) : 0;

  if (ilMagnitude === 0) {
    const isNetProfitable = feesCollected > 0;
    return {
      feesCollected,
      ilMagnitude: 0,
      mitigationPercent: null,
      meterPercent: METER_MAX,
      isNetProfitable,
      status: "no-divergence",
    };
  }

  const rawPercent = (feesCollected / ilMagnitude) * 100;
  const mitigationPercent = Number.isFinite(rawPercent)
    ? roundToTwoDecimals(rawPercent)
    : null;

  // `null` here means the ratio overflowed the float range, which only happens
  // when fees dwarf the IL — unambiguously net profitable.
  const isNetProfitable =
    feesCollected > 0 && (mitigationPercent === null || mitigationPercent >= METER_MAX);

  const status: IlMitigationStatus = isNetProfitable
    ? "net-profitable"
    : feesCollected > 0
      ? "partial"
      : "unmitigated";

  return {
    feesCollected,
    ilMagnitude,
    mitigationPercent,
    meterPercent:
      mitigationPercent === null ? METER_MAX : clampPercent(mitigationPercent),
    isNetProfitable,
    status,
  };
}

/**
 * Score a full `PoolPnLPosition` by decomposing its PnL into the fee leg and
 * the asset-shift (impermanent loss) leg, mirroring `PoolPnLCard`'s breakdown.
 */
export function computeIlMitigationForPosition(
  position: IlMitigationPositionInput,
): IlMitigationScore {
  const initialDepositValue = toFinite(position.initialDepositValue);
  const currentRedeemableValue = toFinite(position.currentRedeemableValue);
  const feesCollected = toFinite(position.feesEarnedValue);
  const totalPnLValue = currentRedeemableValue - initialDepositValue;

  return computeIlMitigation({
    feesCollected,
    impermanentLossValue: totalPnLValue - feesCollected,
  });
}
