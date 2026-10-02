import { beforeEach, describe, expect, it } from "vitest";

import { ASSET_SYMBOL_LIST } from "@/config/assetSymbols";
import { CANDLE_RESOLUTIONS } from "@/components/trading/CandlestickChart";
import {
  DEFAULT_MULTI_CHART_CONFIG,
  MAX_MULTI_CHART_CELLS,
  MULTI_CHART_GRID_STORAGE_KEY,
  MULTI_CHART_LAYOUTS,
  MULTI_CHART_LAYOUT_IDS,
  clearMultiChartConfig,
  describePair,
  getMultiChartLayout,
  getVisibleCells,
  isAssetSymbol,
  isCandleResolution,
  isMultiChartLayoutId,
  loadMultiChartConfig,
  normalizeMultiChartConfig,
  saveMultiChartConfig,
  updateCellConfig,
} from "@/components/trading/MultiChartGrid";
import { getItem, setItem, __resetStorageForTests } from "@/utils/storage";

/**
 * Pure-logic and persistence coverage for the multi-chart grid (Issue #999).
 *
 * Storage assertions read through {@link file://./src/utils/storage.ts} rather
 * than poking `localStorage` directly, because that module writes an encrypted
 * `{ version, data }` envelope — a raw `getItem` would see ciphertext.
 */

/** Persist a payload the way a past build would have, bypassing normalization. */
function seedStoredConfig(payload: unknown) {
  setItem(MULTI_CHART_GRID_STORAGE_KEY, payload);
}

function readStoredConfig() {
  return getItem<unknown>(MULTI_CHART_GRID_STORAGE_KEY);
}

beforeEach(() => {
  window.localStorage.clear();
  __resetStorageForTests();
});

describe("layout options", () => {
  it("offers single, dual split and 2x2 quad with a rising cell count", () => {
    expect(MULTI_CHART_LAYOUT_IDS).toEqual(["single", "dual", "quad"]);
    expect(MULTI_CHART_LAYOUTS.map((option) => option.cellCount)).toEqual([1, 2, 4]);
  });

  it("keeps every cell box on a definite height so fillParent charts can measure themselves", () => {
    for (const option of MULTI_CHART_LAYOUTS) {
      expect(option.cellBoxClassName).toMatch(/aspect-\[/);
      expect(option.cellBoxClassName).toMatch(/max-h-\[/);
    }
  });

  it("collapses to one column below the sm breakpoint and splits above it", () => {
    for (const option of MULTI_CHART_LAYOUTS) {
      expect(option.columnsClassName).toContain("grid-cols-1");
    }
    for (const option of MULTI_CHART_LAYOUTS.filter((item) => item.cellCount > 1)) {
      expect(option.columnsClassName).toContain("sm:grid-cols-2");
    }
  });

  it("resolves a layout id and falls back for an unknown one", () => {
    expect(getMultiChartLayout("quad").label).toBe("2×2 Quad Grid");
    expect(getMultiChartLayout("nope" as never).id).toBe("single");
  });

  it("validates layout ids, intervals and pairs against their registries", () => {
    expect(isMultiChartLayoutId("dual")).toBe(true);
    expect(isMultiChartLayoutId("triple")).toBe(false);
    expect(isCandleResolution("15m")).toBe(true);
    expect(isCandleResolution("3m")).toBe(false);
    expect(isAssetSymbol(ASSET_SYMBOL_LIST[0])).toBe(true);
    expect(isAssetSymbol("BTC-USD")).toBe(false);
  });
});

describe("getVisibleCells", () => {
  it("slices to the layout's cell count and retains the surplus config", () => {
    const config = { ...DEFAULT_MULTI_CHART_CONFIG, layout: "dual" as const };
    const visible = getVisibleCells(config);

    expect(visible).toHaveLength(2);
    expect(config.cells).toHaveLength(MAX_MULTI_CHART_CELLS);
    // Narrowing must not mutate what is stored, so widening restores the board.
    expect(config.cells.slice(2)).toEqual(DEFAULT_MULTI_CHART_CONFIG.cells.slice(2));
  });
});

describe("describePair", () => {
  it("splits an interned pair id into its base and quote legs", () => {
    expect(describePair("USD-XLM")).toEqual({ baseSymbol: "USD", quoteSymbol: "XLM" });
    expect(describePair("NGN-XLM")).toEqual({ baseSymbol: "NGN", quoteSymbol: "XLM" });
  });
});

describe("updateCellConfig", () => {
  it("patches only the targeted cell", () => {
    const next = updateCellConfig(DEFAULT_MULTI_CHART_CONFIG, 2, { timeframe: "1d" });

    expect(next.cells[2].timeframe).toBe("1d");
    expect(next.cells.slice(0, 2)).toEqual(DEFAULT_MULTI_CHART_CONFIG.cells.slice(0, 2));
    expect(next.cells[3]).toEqual(DEFAULT_MULTI_CHART_CONFIG.cells[3]);
  });

  it("does not mutate the source config", () => {
    const source = structuredClone(DEFAULT_MULTI_CHART_CONFIG);
    updateCellConfig(source, 0, { pair: "EUR-XLM" });
    expect(source).toEqual(DEFAULT_MULTI_CHART_CONFIG);
  });

  it("is a no-op for out-of-range indices", () => {
    expect(updateCellConfig(DEFAULT_MULTI_CHART_CONFIG, -1, { timeframe: "1d" })).toBe(
      DEFAULT_MULTI_CHART_CONFIG,
    );
    expect(updateCellConfig(DEFAULT_MULTI_CHART_CONFIG, 99, { timeframe: "1d" })).toBe(
      DEFAULT_MULTI_CHART_CONFIG,
    );
  });
});

describe("normalizeMultiChartConfig", () => {
  it("returns the default config for nullish or non-object input", () => {
    expect(normalizeMultiChartConfig(null)).toEqual(DEFAULT_MULTI_CHART_CONFIG);
    expect(normalizeMultiChartConfig(undefined)).toEqual(DEFAULT_MULTI_CHART_CONFIG);
    expect(normalizeMultiChartConfig("quad")).toEqual(DEFAULT_MULTI_CHART_CONFIG);
    expect(normalizeMultiChartConfig(42)).toEqual(DEFAULT_MULTI_CHART_CONFIG);
  });

  it("repairs an unknown layout per field instead of discarding valid cells", () => {
    const normalized = normalizeMultiChartConfig({
      layout: "octet",
      cells: [
        { pair: "EUR-XLM", timeframe: "1h" },
        { pair: "USD-XLM", timeframe: "1d" },
        { pair: "USD-XLM", timeframe: "1d" },
        { pair: "USD-XLM", timeframe: "1d" },
      ],
    });

    expect(normalized.layout).toBe(DEFAULT_MULTI_CHART_CONFIG.layout);
    expect(normalized.cells[0]).toEqual({ pair: "EUR-XLM", timeframe: "1h" });
  });

  it("falls back per field for unknown pairs and intervals", () => {
    const normalized = normalizeMultiChartConfig({
      layout: "dual",
      cells: [
        { pair: "BTC-USD", timeframe: "3m" },
        { pair: "NGN-XLM", timeframe: "1h" },
      ],
    });

    expect(normalized.cells[0]).toEqual(DEFAULT_MULTI_CHART_CONFIG.cells[0]);
    expect(normalized.cells[1]).toEqual({ pair: "NGN-XLM", timeframe: "1h" });
  });

  it("tolerates a short, over-long or non-array cell list", () => {
    expect(normalizeMultiChartConfig({ layout: "single", cells: [] }).cells).toHaveLength(
      MAX_MULTI_CHART_CELLS,
    );
    expect(
      normalizeMultiChartConfig({
        layout: "single",
        cells: Array.from({ length: 12 }, () => ({ pair: "USD-XLM", timeframe: "1m" })),
      }).cells,
    ).toHaveLength(MAX_MULTI_CHART_CELLS);
    expect(
      normalizeMultiChartConfig({ layout: "single", cells: "nope" }).cells,
    ).toEqual(DEFAULT_MULTI_CHART_CONFIG.cells);
  });

  it("keeps every default cell on a known pair and interval", () => {
    for (const cell of DEFAULT_MULTI_CHART_CONFIG.cells) {
      expect(isAssetSymbol(cell.pair)).toBe(true);
      expect(isCandleResolution(cell.timeframe)).toBe(true);
      expect(CANDLE_RESOLUTIONS).toContain(cell.timeframe);
    }
  });
});

describe("multi-chart grid persistence", () => {
  it("round-trips a saved layout, pairs and intervals", () => {
    const config = {
      layout: "dual" as const,
      cells: [
        { pair: "NGN-XLM" as const, timeframe: "1h" as const },
        { pair: "EUR-XLM" as const, timeframe: "1d" as const },
        { pair: "USD-XLM" as const, timeframe: "1m" as const },
        { pair: "USD-XLM" as const, timeframe: "15m" as const },
      ],
    };

    saveMultiChartConfig(config);
    expect(loadMultiChartConfig()).toEqual(config);
  });

  it("returns the defaults when nothing is stored", () => {
    expect(loadMultiChartConfig()).toEqual(DEFAULT_MULTI_CHART_CONFIG);
  });

  it("falls back to the defaults when storage holds an unrecognisable shape", () => {
    seedStoredConfig("not-a-config");
    expect(loadMultiChartConfig()).toEqual(DEFAULT_MULTI_CHART_CONFIG);
  });

  it("recovers a stale board field by field instead of resetting it", () => {
    // Simulates a build that shipped a new interval: the layout and the other
    // cells are still valid and must survive.
    seedStoredConfig({
      layout: "dual",
      cells: [
        { pair: "NGN-XLM", timeframe: "1d" },
        { pair: "not-a-pair", timeframe: "1m" },
      ],
    });

    const loaded = loadMultiChartConfig();
    expect(loaded.layout).toBe("dual");
    expect(loaded.cells[0]).toEqual({ pair: "NGN-XLM", timeframe: "1d" });
    expect(loaded.cells[1].pair).toBe(DEFAULT_MULTI_CHART_CONFIG.cells[1].pair);
  });

  it("normalizes on write so storage never holds an out-of-range value", () => {
    saveMultiChartConfig({
      layout: "octet" as never,
      cells: [{ pair: "BTC-USD" as never, timeframe: "3m" as never }],
    });

    expect(readStoredConfig()).toEqual(DEFAULT_MULTI_CHART_CONFIG);
  });

  it("clears the stored board", () => {
    saveMultiChartConfig({ ...DEFAULT_MULTI_CHART_CONFIG, layout: "single" });
    clearMultiChartConfig();

    expect(readStoredConfig()).toBeNull();
    expect(loadMultiChartConfig()).toEqual(DEFAULT_MULTI_CHART_CONFIG);
  });
});
