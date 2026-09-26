const assert = require("assert");

console.log("\n=======================================================");
console.log("  Running Issue #990 Yield Benchmark Comparison Tests  ");
console.log("=======================================================\n");

// ─── Mirror of the pure helpers in src/hooks/useYieldBenchmarks.ts ──────────
// (kept in sync manually; the TS source is the single source of truth)

function calculateApyAdvantage(vaultApyPercent, industryApyPercent) {
  return vaultApyPercent - industryApyPercent;
}

function calculateRelativeAdvantage(vaultApyPercent, industryApyPercent) {
  if (industryApyPercent === 0) return 0;
  return ((vaultApyPercent - industryApyPercent) / industryApyPercent) * 100;
}

function calculateChartMax(assets) {
  const values = assets.flatMap((asset) => [
    asset.vaultApyPercent,
    asset.industryApyPercent,
  ]);
  const max = values.length > 0 ? Math.max(...values) : 0;
  return max > 0 ? max : 1;
}

function calculateAggregateAdvantage(assets) {
  if (assets.length === 0) return 0;
  const total = assets.reduce(
    (sum, asset) =>
      sum + calculateApyAdvantage(asset.vaultApyPercent, asset.industryApyPercent),
    0
  );
  return total / assets.length;
}

// ─── Fixture mirroring getMockYieldBenchmarkData() ─────────────────────────

const assets = [
  { symbol: "USDC", vaultApyPercent: 12.4, industryApyPercent: 9.2 },
  { symbol: "XLM", vaultApyPercent: 14.7, industryApyPercent: 11.5 },
  { symbol: "BTC", vaultApyPercent: 8.9, industryApyPercent: 5.7 },
];

// ─── Test 1: net APY spread ────────────────────────────────────────────────
console.log("Test 1: net APY advantage calculation...");
assert.strictEqual(
  Number(calculateApyAdvantage(12.4, 9.2).toFixed(1)),
  3.2,
  "USDC advantage should be +3.2pp"
);
assert.strictEqual(
  Number(calculateApyAdvantage(5.0, 7.5).toFixed(1)),
  -2.5,
  "negative spread should be preserved"
);
console.log("  ✓ net APY spread accurate\n");

// ─── Test 2: relative advantage ────────────────────────────────────────────
console.log("Test 2: relative advantage calculation...");
assert.strictEqual(
  Number(calculateRelativeAdvantage(12.4, 9.2).toFixed(2)),
  Number((((12.4 - 9.2) / 9.2) * 100).toFixed(2)),
  "relative advantage matches formula"
);
assert.strictEqual(
  calculateRelativeAdvantage(10, 0),
  0,
  "zero benchmark must not divide by zero"
);
console.log("  ✓ relative advantage accurate\n");

// ─── Test 3: chart scaling ─────────────────────────────────────────────────
console.log("Test 3: chart max scaling from active feed metrics...");
assert.strictEqual(
  calculateChartMax(assets),
  14.7,
  "chart max should equal the tallest bar (XLM vault APY)"
);
assert.strictEqual(
  calculateChartMax([]),
  1,
  "empty feed must fall back to a positive max"
);
assert.strictEqual(
  calculateChartMax([{ vaultApyPercent: 0, industryApyPercent: 0 }]),
  1,
  "all-zero feed must fall back to a positive max"
);
console.log("  ✓ chart scaling accurate\n");

// ─── Test 4: aggregate advantage ───────────────────────────────────────────
console.log("Test 4: aggregate advantage metric...");
const expectedAggregate = (3.2 + 3.2 + 3.2) / 3;
assert.strictEqual(
  Number(calculateAggregateAdvantage(assets).toFixed(1)),
  Number(expectedAggregate.toFixed(1)),
  "aggregate advantage should average per-asset spreads"
);
assert.strictEqual(
  calculateAggregateAdvantage([]),
  0,
  "empty feed aggregate should be 0"
);
console.log("  ✓ aggregate advantage accurate\n");

console.log("All Issue #990 yield benchmark checks passed");
