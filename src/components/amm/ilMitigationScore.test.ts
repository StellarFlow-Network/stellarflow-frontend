/**
 * Unit tests — #1005 Impermanent Loss Mitigation Score
 *
 * Coverage:
 *  1. Fees below IL      -> partial offset, meter under 100%, not net profitable.
 *  2. Fees equal to IL   -> exactly 100%, boundary is net profitable.
 *  3. Fees above IL      -> over-100% offset, net profitable (green checkmark).
 *  4. No divergence      -> IL === 0 renders the dedicated no-IL state instead
 *     of dividing by zero (no NaN / Infinity anywhere in the result).
 *  5. Zero fees          -> 0% offset, status `unmitigated`.
 *  6. Negative IL sign   -> a signed negative asset shift is the loss;
 *     a positive shift means there is no IL to offset.
 *  7. Rounding/precision -> two decimals, and hostile inputs (non-finite,
 *     negative fees, float overflow) stay finite and clamp the meter.
 *  8. Position decomposition -> `computeIlMitigationForPosition` mirrors
 *     `PoolPnLCard`'s fee-yield / asset-shift split.
 *
 * Run with:
 *   node --experimental-strip-types --test src/components/amm/ilMitigationScore.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeIlMitigation,
  computeIlMitigationForPosition,
} from "./ilMitigationScore.ts";

test("computeIlMitigation: fees below IL is a partial offset", () => {
  const score = computeIlMitigation({ feesCollected: 62.5, impermanentLossValue: -250 });

  assert.equal(score.ilMagnitude, 250);
  assert.equal(score.mitigationPercent, 25);
  assert.equal(score.meterPercent, 25);
  assert.equal(score.isNetProfitable, false);
  assert.equal(score.status, "partial");
});

test("computeIlMitigation: fees equal to IL is exactly 100% and net profitable", () => {
  const score = computeIlMitigation({ feesCollected: 500, impermanentLossValue: -500 });

  assert.equal(score.mitigationPercent, 100);
  assert.equal(score.meterPercent, 100);
  assert.equal(score.isNetProfitable, true);
  assert.equal(score.status, "net-profitable");
});

test("computeIlMitigation: fees above IL reports the over-100% offset", () => {
  const score = computeIlMitigation({ feesCollected: 610, impermanentLossValue: -115 });

  assert.equal(score.mitigationPercent, 530.43);
  // The meter is clamped so an overflowing bar still fills the track.
  assert.equal(score.meterPercent, 100);
  assert.equal(score.isNetProfitable, true);
  assert.equal(score.status, "net-profitable");
});

test("computeIlMitigation: IL === 0 yields the no-divergence state, never Infinity", () => {
  const score = computeIlMitigation({ feesCollected: 120, impermanentLossValue: 0 });

  assert.equal(score.ilMagnitude, 0);
  assert.equal(score.mitigationPercent, null);
  assert.equal(score.meterPercent, 100);
  assert.equal(score.status, "no-divergence");
  assert.equal(score.isNetProfitable, true);
  assert.ok(!Number.isNaN(score.meterPercent) && Number.isFinite(score.meterPercent));
});

test("computeIlMitigation: zero fees leaves the IL unmitigated", () => {
  const score = computeIlMitigation({ feesCollected: 0, impermanentLossValue: -200 });

  assert.equal(score.mitigationPercent, 0);
  assert.equal(score.meterPercent, 0);
  assert.equal(score.isNetProfitable, false);
  assert.equal(score.status, "unmitigated");
});

test("computeIlMitigation: IL === 0 with zero fees is not net profitable", () => {
  const score = computeIlMitigation({ feesCollected: 0, impermanentLossValue: 0 });

  assert.equal(score.mitigationPercent, null);
  assert.equal(score.isNetProfitable, false);
  assert.equal(score.status, "no-divergence");
});

test("computeIlMitigation: signs are handled — positive asset shift means no IL", () => {
  const favourable = computeIlMitigation({ feesCollected: 90, impermanentLossValue: 320 });
  assert.equal(favourable.ilMagnitude, 0);
  assert.equal(favourable.mitigationPercent, null);
  assert.equal(favourable.status, "no-divergence");

  const loss = computeIlMitigation({ feesCollected: 90, impermanentLossValue: -180 });
  assert.equal(loss.ilMagnitude, 180);
  assert.equal(loss.mitigationPercent, 50);
  assert.equal(loss.status, "partial");

  // Only the magnitude of the loss matters, so -0 is still "no divergence".
  const negativeZero = computeIlMitigation({ feesCollected: 90, impermanentLossValue: -0 });
  assert.equal(negativeZero.ilMagnitude, 0);
  assert.equal(negativeZero.status, "no-divergence");
});

test("computeIlMitigation: rounds to two decimals and stays finite", () => {
  const thirds = computeIlMitigation({ feesCollected: 1, impermanentLossValue: -3 });
  assert.equal(thirds.mitigationPercent, 33.33);

  const repeating = computeIlMitigation({ feesCollected: 10, impermanentLossValue: -7 });
  assert.equal(repeating.mitigationPercent, 142.86);

  const whole = computeIlMitigation({ feesCollected: 125, impermanentLossValue: -100 });
  assert.equal(whole.mitigationPercent, 125);
});

test("computeIlMitigation: hostile inputs never produce NaN or Infinity in the meter", () => {
  const negativeFees = computeIlMitigation({ feesCollected: -40, impermanentLossValue: -100 });
  assert.equal(negativeFees.mitigationPercent, -40);
  assert.equal(negativeFees.meterPercent, 0);
  assert.equal(negativeFees.status, "unmitigated");

  const nonFinite = computeIlMitigation({
    feesCollected: Number.NaN,
    impermanentLossValue: Number.POSITIVE_INFINITY,
  });
  assert.equal(nonFinite.ilMagnitude, 0);
  assert.equal(nonFinite.mitigationPercent, null);
  assert.ok(Number.isFinite(nonFinite.meterPercent));

  const overflowing = computeIlMitigation({
    feesCollected: Number.MAX_VALUE,
    impermanentLossValue: -Number.MIN_VALUE,
  });
  assert.equal(overflowing.mitigationPercent, null);
  assert.equal(overflowing.meterPercent, 100);
  assert.equal(overflowing.isNetProfitable, true);
  assert.ok(!Number.isNaN(overflowing.mitigationPercent ?? 0));
});

test("computeIlMitigationForPosition: mirrors PoolPnLCard's fee / asset-shift split", () => {
  const netProfitable = computeIlMitigationForPosition({
    initialDepositValue: 5000,
    currentRedeemableValue: 5495,
    feesEarnedValue: 610,
  });
  // totalPnL 495, asset shift 495 - 610 = -115 => 610 / 115 = 530.43%
  assert.equal(netProfitable.ilMagnitude, 115);
  assert.equal(netProfitable.mitigationPercent, 530.43);
  assert.equal(netProfitable.status, "net-profitable");

  const partial = computeIlMitigationForPosition({
    initialDepositValue: 2200,
    currentRedeemableValue: 2090,
    feesEarnedValue: 95,
  });
  // totalPnL -110, asset shift -110 - 95 = -205 => 95 / 205 = 46.34%
  assert.equal(partial.ilMagnitude, 205);
  assert.equal(partial.mitigationPercent, 46.34);
  assert.equal(partial.status, "partial");

  const noDivergence = computeIlMitigationForPosition({
    initialDepositValue: 12500,
    currentRedeemableValue: 12940,
    feesEarnedValue: 120,
  });
  // asset shift is +320, so there is no loss for fees to offset.
  assert.equal(noDivergence.ilMagnitude, 0);
  assert.equal(noDivergence.mitigationPercent, null);
  assert.equal(noDivergence.status, "no-divergence");
});

test("computeIlMitigationForPosition: deposit equal to redeemable is break-even at 100%", () => {
  const score = computeIlMitigationForPosition({
    initialDepositValue: 8000,
    currentRedeemableValue: 8000,
    feesEarnedValue: 500,
  });

  assert.equal(score.ilMagnitude, 500);
  assert.equal(score.mitigationPercent, 100);
  assert.equal(score.status, "net-profitable");
});
