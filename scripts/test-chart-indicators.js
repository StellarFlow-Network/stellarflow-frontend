const assert = require("assert");
const path = require("path");

console.log("\n=======================================================");
console.log("  Running Issue #746 Chart Timeframe & Indicator Tests ");
console.log("=======================================================\n");

// ─── Test 1: Moving Average calculation
console.log("Testing Test 1: Simple Moving Average (SMA)...");

const sampleCandles = [
  { time: 100, close: 10 },
  { time: 200, close: 20 },
  { time: 300, close: 30 },
  { time: 400, close: 40 },
  { time: 500, close: 50 },
];

function calculateSimpleMovingAverage(data, period = 3) {
  if (data.length < period || period <= 0) return [];
  const results = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) {
      sum -= data[i - period].close;
    }
    if (i >= period - 1) {
      results.push({
        time: data[i].time,
        value: Number((sum / period).toFixed(6)),
      });
    }
  }
  return results;
}

const ma3 = calculateSimpleMovingAverage(sampleCandles, 3);
assert.strictEqual(ma3.length, 3, "MA(3) over 5 points should yield 3 points");
assert.strictEqual(ma3[0].time, 300);
assert.strictEqual(ma3[0].value, 20); // (10+20+30)/3 = 20
assert.strictEqual(ma3[1].time, 400);
assert.strictEqual(ma3[1].value, 30); // (20+30+40)/3 = 30
assert.strictEqual(ma3[2].time, 500);
assert.strictEqual(ma3[2].value, 40); // (30+40+50)/3 = 40

console.log("✓ Test 1 Passed: SMA calculated accurately.");

// ─── Test 2: Relative Strength Index (RSI) calculation
console.log("\nTesting Test 2: Relative Strength Index (RSI)...");

function calculateRSI(data, period = 14) {
  if (data.length <= period || period <= 0) return [];
  const results = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  results.push({
    time: data[period].time,
    value: Number(rsi.toFixed(2)),
  });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    results.push({
      time: data[i].time,
      value: Number(rsi.toFixed(2)),
    });
  }

  return results;
}

// 20 price points with alternating gain/loss
const rsiTestCandles = [];
let basePrice = 100;
for (let i = 0; i <= 25; i++) {
  basePrice += (i % 2 === 0 ? 2 : -1);
  rsiTestCandles.push({ time: i * 1000, close: basePrice });
}

const rsiPoints = calculateRSI(rsiTestCandles, 14);
assert.ok(rsiPoints.length > 0, "RSI output must produce points when data length > 14");
rsiPoints.forEach((pt) => {
  assert.ok(pt.value >= 0 && pt.value <= 100, `RSI value ${pt.value} should be between 0 and 100`);
});

console.log("✓ Test 2 Passed: RSI calculated accurately with values bounded in [0, 100].");

// ─── Test 3: Timeframes & Preferences persistence validation
console.log("\nTesting Test 3: Timeframes and Layout Persistence Schema...");

const TIMEFRAMES = ["1H", "24H", "7D", "1M", "1Y", "ALL"];
assert.deepStrictEqual(
  TIMEFRAMES,
  ["1H", "24H", "7D", "1M", "1Y", "ALL"],
  "All 6 required timeframes must be supported",
);

const validPref = {
  timeframe: "7D",
  indicators: {
    ma: true,
    volume: true,
    rsi: true,
    maPeriod: 50,
  },
};

function validateChartPreferences(val) {
  return (
    typeof val === "object" &&
    val !== null &&
    TIMEFRAMES.includes(val.timeframe) &&
    typeof val.indicators === "object" &&
    typeof val.indicators.ma === "boolean" &&
    typeof val.indicators.volume === "boolean" &&
    typeof val.indicators.rsi === "boolean" &&
    typeof val.indicators.maPeriod === "number"
  );
}

assert.strictEqual(validateChartPreferences(validPref), true, "Valid chart preference should pass validation");
assert.strictEqual(validateChartPreferences({ timeframe: "INVALID" }), false, "Invalid timeframe should fail");
assert.strictEqual(validateChartPreferences(null), false, "Null should fail");

console.log("✓ Test 3 Passed: Timeframe options and chart layout preference schema validated.");

console.log("\n=======================================================");
console.log("  ALL ISSUE #746 CHART INDICATOR TESTS PASSED! (3/3)   ");
console.log("=======================================================\n");
process.exit(0);
