import { describe, expect, it } from "vitest";
import { calculateOnMainThread } from "../../src/workers/mathWorker.fallback";

describe("math worker fallback", () => {
  it("converts a tick to price", () => {
    const result = calculateOnMainThread({
      type: "tickToPrice",
      requestId: "test-1",
      payload: { tick: 0 },
    });
    expect(result).toBe(1);
  });

  it("routes amounts with a fee", () => {
    const result = calculateOnMainThread({
      type: "routePath",
      requestId: "test-2",
      payload: { amounts: [100, 90], feeBps: 30 },
    }) as { output: number };
    expect(result.output).toBeCloseTo(89.73);
  });
});
