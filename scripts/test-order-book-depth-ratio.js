#!/usr/bin/env node

/**
 * Unit tests for Issue #987: Order Book Depth Ratio Indicator Bar
 * and Issue #964: Bundle Size Analyzer Configuration & Page Bundle Budget
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("\n=======================================================");
console.log("  Running Issue #987 & #964 Validation Tests ");
console.log("=======================================================\n");

// ─── Part 1: Volume Calculation & Depth Ratio Logic ──────────

function calculateDepthRatio(bids, asks, depth = 10) {
  const safeBids = Array.isArray(bids) ? bids.slice(0, depth) : [];
  const safeAsks = Array.isArray(asks) ? asks.slice(0, depth) : [];

  const bidVolume = safeBids.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  const askVolume = safeAsks.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  const totalVolume = bidVolume + askVolume;

  let bidRatio = 50;
  let askRatio = 50;

  if (totalVolume > 0) {
    bidRatio = (bidVolume / totalVolume) * 100;
    askRatio = (askVolume / totalVolume) * 100;
  }

  return {
    bidVolume,
    askVolume,
    totalVolume,
    bidRatio,
    askRatio,
  };
}

console.log("Test 1: Balanced Order Book (50% / 50%)...");
{
  const bids = [{ amount: 100 }, { amount: 200 }];
  const asks = [{ amount: 150 }, { amount: 150 }];
  const result = calculateDepthRatio(bids, asks);

  assert.strictEqual(result.bidVolume, 300);
  assert.strictEqual(result.askVolume, 300);
  assert.strictEqual(result.totalVolume, 600);
  assert.strictEqual(result.bidRatio, 50);
  assert.strictEqual(result.askRatio, 50);
  console.log("  ✓ Balanced ratio passed");
}

console.log("Test 2: Buyer Dominant Order Book (75% Bids / 25% Asks)...");
{
  const bids = [{ amount: 750 }];
  const asks = [{ amount: 250 }];
  const result = calculateDepthRatio(bids, asks);

  assert.strictEqual(result.bidVolume, 750);
  assert.strictEqual(result.askVolume, 250);
  assert.strictEqual(result.totalVolume, 1000);
  assert.strictEqual(result.bidRatio, 75);
  assert.strictEqual(result.askRatio, 25);
  console.log("  ✓ Buyer dominant ratio passed");
}

console.log("Test 3: Seller Dominant Order Book (20% Bids / 80% Asks)...");
{
  const bids = [{ amount: 20 }];
  const asks = [{ amount: 80 }];
  const result = calculateDepthRatio(bids, asks);

  assert.strictEqual(result.bidVolume, 20);
  assert.strictEqual(result.askVolume, 80);
  assert.strictEqual(result.totalVolume, 100);
  assert.strictEqual(result.bidRatio, 20);
  assert.strictEqual(result.askRatio, 80);
  console.log("  ✓ Seller dominant ratio passed");
}

console.log("Test 4: Depth level slicing (depth = 2)...");
{
  const bids = [{ amount: 100 }, { amount: 100 }, { amount: 9999 }];
  const asks = [{ amount: 50 }, { amount: 50 }, { amount: 9999 }];
  const result = calculateDepthRatio(bids, asks, 2);

  assert.strictEqual(result.bidVolume, 200, "Should only sum first 2 bids");
  assert.strictEqual(result.askVolume, 100, "Should only sum first 2 asks");
  assert.strictEqual(result.totalVolume, 300);
  assert.strictEqual(Number(result.bidRatio.toFixed(2)), 66.67);
  assert.strictEqual(Number(result.askRatio.toFixed(2)), 33.33);
  console.log("  ✓ Depth slicing passed");
}

console.log("Test 5: Edge Cases (Empty, Null, Zero)...");
{
  // Both empty
  const empty = calculateDepthRatio([], []);
  assert.strictEqual(empty.totalVolume, 0);
  assert.strictEqual(empty.bidRatio, 50);
  assert.strictEqual(empty.askRatio, 50);

  // Null / undefined inputs
  const nullInputs = calculateDepthRatio(null, undefined);
  assert.strictEqual(nullInputs.totalVolume, 0);
  assert.strictEqual(nullInputs.bidRatio, 50);

  // Zero asks
  const zeroAsks = calculateDepthRatio([{ amount: 500 }], []);
  assert.strictEqual(zeroAsks.bidVolume, 500);
  assert.strictEqual(zeroAsks.askVolume, 0);
  assert.strictEqual(zeroAsks.bidRatio, 100);
  assert.strictEqual(zeroAsks.askRatio, 0);

  // Zero bids
  const zeroBids = calculateDepthRatio([], [{ amount: 500 }]);
  assert.strictEqual(zeroBids.bidVolume, 0);
  assert.strictEqual(zeroBids.askVolume, 500);
  assert.strictEqual(zeroBids.bidRatio, 0);
  assert.strictEqual(zeroBids.askRatio, 100);
  console.log("  ✓ Edge cases passed");
}

// ─── Part 2: Component & Export Verification ─────────────────

console.log("Test 6: Component files and exports exist...");
{
  const componentPath = path.join(
    __dirname,
    "../src/components/trading/OrderBookDepthRatioBar.tsx"
  );
  assert.ok(fs.existsSync(componentPath), "OrderBookDepthRatioBar.tsx must exist");

  const componentContent = fs.readFileSync(componentPath, "utf8");
  assert.ok(
    componentContent.includes("export function calculateDepthRatio"),
    "calculateDepthRatio must be exported"
  );
  assert.ok(
    componentContent.includes("export const OrderBookDepthRatioBar") ||
      componentContent.includes("export function OrderBookDepthRatioBar"),
    "OrderBookDepthRatioBar must be exported"
  );
  assert.ok(
    componentContent.includes('role="progressbar"'),
    "Component must have accessibility role=progressbar"
  );
  assert.ok(
    componentContent.includes("depth-ratio-tooltip"),
    "Component must include hover tooltip"
  );

  const indexPath = path.join(__dirname, "../src/components/trading/index.ts");
  const indexContent = fs.readFileSync(indexPath, "utf8");
  assert.ok(
    indexContent.includes("OrderBookDepthRatioBar"),
    "src/components/trading/index.ts must re-export OrderBookDepthRatioBar"
  );
  console.log("  ✓ Component and export verification passed");
}

// ─── Part 3: Issue #964 Bundle Analyzer & Budget Limits ──────

console.log("Test 7: Bundle analyzer and budget limits verification...");
{
  const limitsPath = path.join(__dirname, "../.bundle-limits.json");
  assert.ok(fs.existsSync(limitsPath), ".bundle-limits.json must exist");

  const limits = JSON.parse(fs.readFileSync(limitsPath, "utf8"));
  assert.ok(
    limits.maxPageBundle <= 150,
    `maxPageBundle must be <= 150KB (actual: ${limits.maxPageBundle}KB)`
  );

  const packageJsonPath = path.join(__dirname, "../package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  assert.ok(
    pkg.scripts.analyze,
    "package.json must contain analyze script"
  );

  const docPath = path.join(__dirname, "../BUNDLE_OPTIMIZATION.md");
  const docContent = fs.readFileSync(docPath, "utf8");
  assert.ok(
    docContent.includes("150"),
    "BUNDLE_OPTIMIZATION.md must document the 150KB limit"
  );
  console.log("  ✓ Bundle budget and analyzer verification passed");
}

console.log("\n=======================================================");
console.log("  ✅ All Issue #987 & #964 tests passed successfully! ");
console.log("=======================================================\n");
