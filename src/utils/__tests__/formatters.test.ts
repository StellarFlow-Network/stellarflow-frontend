import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCompactAmount, formatOrderBookPrice, formatPercent } from "../formatters.ts";

describe("order book formatters (#997)", () => {
  it("formats prices with a bounded fraction", () => {
    assert.equal(formatOrderBookPrice(750), "750.00");
    assert.equal(formatOrderBookPrice(750.6, 2), "750.60");
    assert.equal(formatOrderBookPrice(0.123456, 6), "0.123456");
  });

  it("compacts large amounts", () => {
    assert.equal(formatCompactAmount(3810), "3.81K");
    assert.equal(formatCompactAmount(1_250_000), "1.25M");
    assert.equal(formatCompactAmount(42.5), "42.50");
  });

  it("formats percents", () => {
    assert.equal(formatPercent(0.16), "0.16%");
    assert.equal(formatPercent(1.234, 3), "1.234%");
  });
});
