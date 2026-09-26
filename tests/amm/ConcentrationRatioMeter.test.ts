import { describe, expect, it } from "vitest";
import {
  calculateConcentrationRatio,
  type ConcentrationTickBand,
} from "../../src/components/amm/ConcentrationRatioMeter";

describe("calculateConcentrationRatio", () => {
  const tickBands: ConcentrationTickBand[] = [
    { tickIndex: 10, lowerPrice: 94, upperPrice: 96, tvlUsd: 10_000 },
    { tickIndex: 20, lowerPrice: 100, upperPrice: 101, tvlUsd: 20_000 },
    { tickIndex: 30, lowerPrice: 110, upperPrice: 112, tvlUsd: 50_000 },
  ];

  it("counts in-range TVL and prorates bands crossing the window edge", () => {
    expect(calculateConcentrationRatio(tickBands, 100, 100_000)).toBe(25);
  });

  it("updates concentration when spot moves across a tick boundary", () => {
    expect(calculateConcentrationRatio(tickBands, 102, 100_000)).toBe(20);
  });

  it("ignores malformed bands and invalid pool totals", () => {
    const malformed = [
      ...tickBands,
      { tickIndex: 40, lowerPrice: 98, upperPrice: 98, tvlUsd: 10_000 },
    ];
    expect(calculateConcentrationRatio(malformed, 100, 100_000)).toBe(25);
    expect(calculateConcentrationRatio(tickBands, 100, 0)).toBe(0);
  });
});