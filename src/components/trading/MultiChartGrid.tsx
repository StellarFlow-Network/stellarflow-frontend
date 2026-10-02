"use client";

/**
 * MultiChartGrid — multi-market price chart grid (Issue #999).
 *
 * Renders 1, 2 or 4 {@link CandlestickChart} cells side by side, each with its
 * own trading pair and candle interval, and remembers that arrangement in local
 * storage so a returning trader lands on the board they left.
 *
 * Design notes
 * ────────────
 * - **Sizing.** Cells size themselves with `aspect-ratio` (clamped by a
 *   `max-height` so a wide desktop does not produce a single absurdly tall
 *   chart) and the charts run with `fillParent`, so a window resize only
 *   re-applies chart options inside each `ResizeObserver`. The alternative —
 *   re-measuring the grid and passing a new `height` prop — would tear down and
 *   rebuild every chart instance on every resize tick.
 * - **Intervals stay independent.** The charts are mounted as *controlled*
 *   timeframe consumers, which also means they decline the global
 *   {@link CHART_TIMEFRAME_EVENT} broadcast. The grid owns that shortcut and
 *   routes it to the focused cell only, so one keypress cannot silently rewrite
 *   every interval on screen.
 * - **Config repair.** Everything read back from storage goes through
 *   {@link normalizeMultiChartConfig}, so a payload written by an older build
 *   degrades field-by-field instead of resetting the whole board.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ASSET_SYMBOL_LIST, type AssetSymbol } from "@/config/assetSymbols";
import { CHART_TIMEFRAME_EVENT } from "@/lib/keyboardShortcuts";
import { getItem, removeItem, setItem } from "@/utils/storage";
import {
  CANDLE_RESOLUTIONS,
  CandlestickChart,
  type CandleResolution,
} from "./CandlestickChart";

// ─── Layout options ────────────────────────────────────────────────────────────

export const MULTI_CHART_LAYOUT_IDS = ["single", "dual", "quad"] as const;
export type MultiChartLayoutId = (typeof MULTI_CHART_LAYOUT_IDS)[number];

export interface MultiChartLayoutOption {
  readonly id: MultiChartLayoutId;
  readonly label: string;
  readonly description: string;
  /** How many cells this layout mounts. */
  readonly cellCount: number;
  /** Columns for the grid. Stacks to one column below `sm`, side by side above. */
  readonly columnsClassName: string;
  /**
   * Cell box sizing. The `aspect-*` class gives a definite height on every
   * viewport (the charts are `fillParent`, so they need one); the `max-h-*`
   * clamp stops a 2560px monitor from rendering a chart taller than the fold.
   */
  readonly cellBoxClassName: string;
}

export const MULTI_CHART_LAYOUTS: readonly MultiChartLayoutOption[] = [
  {
    id: "single",
    label: "Single Chart",
    description: "One full-width market",
    cellCount: 1,
    columnsClassName: "grid-cols-1",
    // A lone chart stretches across the grid, so it is width-capped as well as
    // height-capped — otherwise an ultrawide desktop yields a letterboxed strip.
    cellBoxClassName: "mx-auto aspect-[16/9] w-full max-w-[1200px] sm:max-h-[640px]",
  },
  {
    id: "dual",
    label: "Dual Split",
    description: "Two markets side by side",
    cellCount: 2,
    columnsClassName: "grid-cols-1 sm:grid-cols-2",
    cellBoxClassName: "aspect-[16/10] sm:max-h-[420px]",
  },
  {
    id: "quad",
    label: "2×2 Quad Grid",
    description: "Four markets at once",
    cellCount: 4,
    columnsClassName: "grid-cols-1 sm:grid-cols-2",
    cellBoxClassName: "aspect-[16/10] sm:max-h-[380px]",
  },
] as const;

// ─── Config shape ──────────────────────────────────────────────────────────────

/** The grid always keeps four cell configs, even when fewer are on screen. */
export const MAX_MULTI_CHART_CELLS = 4;

export interface MultiChartCellConfig {
  readonly pair: AssetSymbol;
  readonly timeframe: CandleResolution;
}

export interface MultiChartGridConfig {
  readonly layout: MultiChartLayoutId;
  readonly cells: readonly MultiChartCellConfig[];
}

const DEFAULT_CELL_TIMEFRAMES: readonly CandleResolution[] = ["5m", "15m", "1h", "1d"];

export const DEFAULT_MULTI_CHART_CONFIG: MultiChartGridConfig = {
  layout: "quad",
  cells: Array.from({ length: MAX_MULTI_CHART_CELLS }, (_, index) => ({
    pair: ASSET_SYMBOL_LIST[index % ASSET_SYMBOL_LIST.length],
    timeframe: DEFAULT_CELL_TIMEFRAMES[index],
  })),
};

// ─── Pure helpers ──────────────────────────────────────────────────────────────

export function isMultiChartLayoutId(value: unknown): value is MultiChartLayoutId {
  return typeof value === "string" && (MULTI_CHART_LAYOUT_IDS as readonly string[]).includes(value);
}

export function isCandleResolution(value: unknown): value is CandleResolution {
  return typeof value === "string" && (CANDLE_RESOLUTIONS as readonly string[]).includes(value);
}

export function isAssetSymbol(value: unknown): value is AssetSymbol {
  return typeof value === "string" && (ASSET_SYMBOL_LIST as readonly string[]).includes(value);
}

export function getMultiChartLayout(id: MultiChartLayoutId): MultiChartLayoutOption {
  return MULTI_CHART_LAYOUTS.find((option) => option.id === id) ?? MULTI_CHART_LAYOUTS[0];
}

/**
 * Cells a layout actually renders. Surplus cell configs are retained rather than
 * dropped so narrowing to a single chart and widening again restores the board.
 */
export function getVisibleCells(config: MultiChartGridConfig): readonly MultiChartCellConfig[] {
  return config.cells.slice(0, getMultiChartLayout(config.layout).cellCount);
}

/** Split an interned pair id (`"USD-XLM"`) into the legs a chart labels with. */
export function describePair(pair: AssetSymbol): { baseSymbol: string; quoteSymbol: string } {
  const [baseSymbol, quoteSymbol] = pair.split("-");
  return { baseSymbol: baseSymbol || pair, quoteSymbol: quoteSymbol || "XLM" };
}

/** Immutably patch one cell. Out-of-range indices are a no-op. */
export function updateCellConfig(
  config: MultiChartGridConfig,
  index: number,
  patch: Partial<MultiChartCellConfig>,
): MultiChartGridConfig {
  if (!Number.isInteger(index) || index < 0 || index >= config.cells.length) return config;
  return {
    ...config,
    cells: config.cells.map((cell, cellIndex) =>
      cellIndex === index ? { ...cell, ...patch } : cell,
    ),
  };
}

/**
 * Coerce anything into a renderable config: unknown layouts fall back to the
 * default, invalid pairs and intervals fall back per field, and the cell list is
 * always exactly {@link MAX_MULTI_CHART_CELLS} long. Never throws — a corrupt
 * payload must not take the grid down with it.
 */
export function normalizeMultiChartConfig(value: unknown): MultiChartGridConfig {
  const source = (typeof value === "object" && value !== null ? value : {}) as Partial<MultiChartGridConfig>;
  const layout = isMultiChartLayoutId(source.layout) ? source.layout : DEFAULT_MULTI_CHART_CONFIG.layout;
  const rawCells: readonly unknown[] = Array.isArray(source.cells) ? source.cells : [];

  const cells = Array.from({ length: MAX_MULTI_CHART_CELLS }, (_, index): MultiChartCellConfig => {
    const fallback = DEFAULT_MULTI_CHART_CONFIG.cells[index];
    const candidate = (
      typeof rawCells[index] === "object" && rawCells[index] !== null ? rawCells[index] : {}
    ) as Partial<MultiChartCellConfig>;
    return {
      pair: isAssetSymbol(candidate.pair) ? candidate.pair : fallback.pair,
      timeframe: isCandleResolution(candidate.timeframe) ? candidate.timeframe : fallback.timeframe,
    };
  });

  return { layout, cells };
}

// ─── Persistence ───────────────────────────────────────────────────────────────

/**
 * Versioned storage key. Registered in
 * {@link file://./../../../utils/storageSanitizer.ts} so the boot-time
 * sanitizer version-checks it alongside the other managed chart preferences.
 */
export const MULTI_CHART_GRID_STORAGE_KEY = "stellarflow.chart.multiGrid";

/**
 * Coarse shape gate for storage reads. Deliberately lax: field-level repair is
 * {@link normalizeMultiChartConfig}'s job, and rejecting a whole board because
 * one interval went stale would be a worse outcome than repairing it.
 */
function isStoredMultiChartConfig(value: unknown): value is MultiChartGridConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "layout" in value &&
    Array.isArray((value as { cells?: unknown }).cells)
  );
}

/** Stored config if present and repairable, otherwise the defaults. */
export function loadMultiChartConfig(): MultiChartGridConfig {
  return normalizeMultiChartConfig(
    getItem<MultiChartGridConfig>(MULTI_CHART_GRID_STORAGE_KEY, isStoredMultiChartConfig) ??
      DEFAULT_MULTI_CHART_CONFIG,
  );
}

/** Persist the board. Storage failures are non-fatal — the grid stays in memory. */
export function saveMultiChartConfig(config: MultiChartGridConfig): void {
  try {
    setItem(MULTI_CHART_GRID_STORAGE_KEY, normalizeMultiChartConfig(config));
  } catch (error) {
    console.warn("Could not persist multi-chart grid layout:", error);
  }
}

export function clearMultiChartConfig(): void {
  removeItem(MULTI_CHART_GRID_STORAGE_KEY);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface MultiChartGridProps {
  className?: string;
}

export function MultiChartGrid({ className }: MultiChartGridProps) {
  const [config, setConfig] = useState<MultiChartGridConfig>(DEFAULT_MULTI_CHART_CONFIG);
  const [isHydrated, setIsHydrated] = useState(false);
  const [focusedCell, setFocusedCell] = useState(0);

  // First paint must match the server-rendered markup, so the stored board is
  // adopted in an effect rather than read during render. Cells that turn out to
  // match the defaults are never unmounted by this swap.
  useEffect(() => {
    setConfig(loadMultiChartConfig());
    setIsHydrated(true);
  }, []);

  // Gated on hydration: without it this would overwrite the stored board with
  // the defaults during the same commit the defaults were rendered from.
  useEffect(() => {
    if (!isHydrated) return;
    saveMultiChartConfig(config);
  }, [config, isHydrated]);

  const layout = useMemo(() => getMultiChartLayout(config.layout), [config.layout]);
  const visibleCells = useMemo(() => getVisibleCells(config), [config]);
  const activeCell = Math.min(focusedCell, visibleCells.length - 1);

  const changeCell = useCallback((index: number, patch: Partial<MultiChartCellConfig>) => {
    setConfig((current) => updateCellConfig(current, index, patch));
  }, []);

  // Pointer and focus events both fire for a click; bail out when the target
  // cell is already focused so a click does not re-render the whole board.
  const focusCell = useCallback((index: number) => {
    setFocusedCell((current) => (current === index ? current : index));
  }, []);

  const selectLayout = useCallback((id: MultiChartLayoutId) => {
    setConfig((current) => (current.layout === id ? current : { ...current, layout: id }));
    setFocusedCell(0);
  }, []);

  const resetGrid = useCallback(() => {
    clearMultiChartConfig();
    setConfig(DEFAULT_MULTI_CHART_CONFIG);
    setFocusedCell(0);
  }, []);

  // The charts are controlled, so they ignore the global broadcast themselves;
  // the grid claims it and aims it at the focused cell to keep intervals
  // independent.
  useEffect(() => {
    const handleTimeframeShortcut = (event: Event) => {
      const next = (event as CustomEvent<{ timeframe?: string }>).detail?.timeframe;
      if (!isCandleResolution(next)) return;
      changeCell(activeCell, { timeframe: next });
    };
    window.addEventListener(CHART_TIMEFRAME_EVENT, handleTimeframeShortcut);
    return () => window.removeEventListener(CHART_TIMEFRAME_EVENT, handleTimeframeShortcut);
  }, [activeCell, changeCell]);

  return (
    <section className={className} aria-label="Multi-chart trading view">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Multi-chart grid</h2>
          <p className="mt-1 text-xs text-white/50">
            {layout.description}. Each cell keeps its own pair and interval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-white/10 bg-black/20 p-1"
            role="group"
            aria-label="Chart grid layout"
          >
            {MULTI_CHART_LAYOUTS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.description}
                aria-pressed={config.layout === option.id}
                onClick={() => selectLayout(option.id)}
                className={`min-h-9 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  config.layout === option.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={resetGrid}
            className="min-h-9 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Reset
          </button>
        </div>
      </header>

      <ul
        className={`grid gap-3 sm:gap-4 ${layout.columnsClassName}`}
        aria-label={`${layout.cellCount} chart price grid`}
      >
        {visibleCells.map((cell, index) => {
          const { baseSymbol, quoteSymbol } = describePair(cell.pair);
          return (
            <li
              key={index}
              data-testid={`multi-chart-cell-${index}`}
              className="min-w-0"
              onFocusCapture={() => focusCell(index)}
              onPointerDownCapture={() => focusCell(index)}
            >
              <div
                className={`flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#0c120f] p-3 ${layout.cellBoxClassName}`}
              >
                <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
                  <label className="flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] font-medium text-white/55">
                    Chart {index + 1}
                    <select
                      value={cell.pair}
                      onChange={(event) => changeCell(index, { pair: event.target.value as AssetSymbol })}
                      className="min-h-7 rounded bg-transparent font-mono text-xs font-semibold text-white"
                    >
                      {ASSET_SYMBOL_LIST.map((pair) => (
                        <option key={pair} value={pair} className="bg-[#0c120f] text-white">
                          {pair.replace("-", " / ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div
                    className="flex rounded-lg border border-white/10 bg-black/30 p-0.5"
                    role="group"
                    aria-label={`Interval for chart ${index + 1}`}
                  >
                    {CANDLE_RESOLUTIONS.map((resolution) => (
                      <button
                        key={resolution}
                        type="button"
                        aria-pressed={cell.timeframe === resolution}
                        onClick={() => changeCell(index, { timeframe: resolution })}
                        className={`min-h-8 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                          cell.timeframe === resolution
                            ? "bg-white/10 text-white"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        {resolution}
                      </button>
                    ))}
                  </div>
                </div>

                <CandlestickChart
                  pairId={cell.pair}
                  baseSymbol={baseSymbol}
                  quoteSymbol={quoteSymbol}
                  timeframe={cell.timeframe}
                  onTimeframeChange={(next) => changeCell(index, { timeframe: next })}
                  fillParent
                  showTimeframeControls={false}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default MultiChartGrid;
