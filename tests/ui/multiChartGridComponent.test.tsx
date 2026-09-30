import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHART_TIMEFRAME_EVENT } from "@/lib/keyboardShortcuts";

/**
 * Component tests for the multi-chart grid (Issue #999).
 *
 * `lightweight-charts` is stubbed because it needs a real canvas and a real
 * layout engine; jsdom has neither. Everything the issue is actually about
 * runs for real on top of that stub:
 *
 * - the real `CandlestickChart` mounting and tearing down four chart instances,
 * - the real `ResizeObserver` plumbing (driven by a controllable stub),
 * - the real grid state, per-cell controls and localStorage persistence.
 *
 * The chart lifecycle is the leak surface this issue calls out, so the stub
 * records every `createChart`/`remove` pair instead of asserting on markup.
 */
const charts = vi.hoisted(() => ({ created: [] as unknown[], removed: 0 }));

vi.mock("lightweight-charts", () => {
  const makeSeries = () => ({
    setData: vi.fn(),
    update: vi.fn(),
    applyOptions: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
  });

  return {
    CandlestickSeries: "CandlestickSeries",
    HistogramSeries: "HistogramSeries",
    LineSeries: "LineSeries",
    createChart: vi.fn(() => {
      const chart = {
        applyOptions: vi.fn(),
        remove: vi.fn(() => {
          charts.removed += 1;
        }),
        subscribeCrosshairMove: vi.fn(),
        unsubscribeCrosshairMove: vi.fn(),
        timeScale: () => ({ fitContent: vi.fn() }),
        addSeries: vi.fn(() => makeSeries()),
      };
      charts.created.push(chart);
      return chart;
    }),
  };
});

// The real hook opens a WebSocket; the grid only needs a static connection state.
vi.mock("@/app/hooks/useSocket", () => ({
  useSocket: () => ({ isConnected: true, lastUpdate: null }),
}));

/** Observable registry so a test can assert that nothing is left listening. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    MockResizeObserver.instances = MockResizeObserver.instances.filter(
      (instance) => instance !== this,
    );
  }
}

/** Push a size to every live observer, the way a viewport change would. */
function triggerResize(width: number, height: number) {
  for (const instance of [...MockResizeObserver.instances]) {
    instance.callback(
      [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
      instance as unknown as ResizeObserver,
    );
  }
}

const OHLCV = {
  candles: [
    { time: 1_700_000_000, open: 0.1, high: 0.12, low: 0.09, close: 0.11, volume: 10 },
    { time: 1_700_000_300, open: 0.11, high: 0.13, low: 0.1, close: 0.12, volume: 20 },
  ],
};

function liveChartCount() {
  return charts.created.length - charts.removed;
}

const { DEFAULT_MULTI_CHART_CONFIG, MULTI_CHART_GRID_STORAGE_KEY, MultiChartGrid } = await import(
  "@/components/trading/MultiChartGrid"
);
const { __resetStorageForTests, getItem } = await import("@/utils/storage");

/** Every chart section currently mounted, in DOM order. */
function chartSections() {
  return screen.getAllByRole("region", { name: /price chart$/ });
}

/** The controls belonging to one grid cell. */
function cell(index: number) {
  return screen.getByTestId(`multi-chart-cell-${index}`);
}

beforeEach(() => {
  window.localStorage.clear();
  __resetStorageForTests();
  charts.created = [];
  charts.removed = 0;
  MockResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(OHLCV), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MultiChartGrid layout", () => {
  it("mounts four independent charts in the default quad layout", async () => {
    render(<MultiChartGrid />);

    await waitFor(() => expect(chartSections()).toHaveLength(4));
    expect(liveChartCount()).toBe(4);

    // Every cell offers its own market and interval controls.
    for (let index = 0; index < 4; index += 1) {
      const region = cell(index);
      expect(within(region).getByRole("combobox", { name: `Chart ${index + 1}` })).toBeInTheDocument();
      expect(
        within(region).getByRole("group", { name: `Interval for chart ${index + 1}` }),
      ).toBeInTheDocument();
    }
  });

  it("switches between single, dual split and quad cell counts", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    await user.click(screen.getByRole("button", { name: "Dual Split" }));
    await waitFor(() => expect(chartSections()).toHaveLength(2));
    expect(liveChartCount()).toBe(2);

    await user.click(screen.getByRole("button", { name: "Single Chart" }));
    await waitFor(() => expect(chartSections()).toHaveLength(1));
    expect(liveChartCount()).toBe(1);

    await user.click(screen.getByRole("button", { name: "2×2 Quad Grid" }));
    await waitFor(() => expect(chartSections()).toHaveLength(4));
    expect(liveChartCount()).toBe(4);
  });

  it("tears down the charts a narrower layout no longer shows", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    await user.click(screen.getByRole("button", { name: "Single Chart" }));
    await waitFor(() => expect(chartSections()).toHaveLength(1));

    expect(charts.removed).toBe(3);
    expect(MockResizeObserver.instances).toHaveLength(1);
  });
});

describe("MultiChartGrid per-cell controls", () => {
  it("scopes an interval change to the cell that made it", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    const firstCell = within(cell(0)).getByRole("group", { name: "Interval for chart 1" });
    await user.click(within(firstCell).getByRole("button", { name: "1d" }));

    expect(within(firstCell).getByRole("button", { name: "1d" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Cell 2 keeps its own interval.
    const secondCell = within(cell(1)).getByRole("group", { name: "Interval for chart 2" });
    expect(within(secondCell).getByRole("button", { name: "15m" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("scopes a market change to the cell that made it", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    const select = within(cell(1)).getByRole("combobox", { name: "Chart 2" });
    await user.selectOptions(select, "NGN-XLM");

    expect(select).toHaveValue("NGN-XLM");
    expect(within(cell(0)).getByRole("combobox", { name: "Chart 1" })).toHaveValue(
      DEFAULT_MULTI_CHART_CONFIG.cells[0].pair,
    );
  });

  it("requests each cell's own interval from the indexer", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    await user.click(
      within(within(cell(0)).getByRole("group", { name: "Interval for chart 1" })).getByRole(
        "button",
        { name: "1m" },
      ),
    );

    await waitFor(() => {
      const requested = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes("timeframe="));
      expect(requested.some((url) => url.includes("timeframe=1m"))).toBe(true);
      expect(requested.some((url) => url.includes("timeframe=15m"))).toBe(true);
      expect(requested.some((url) => url.includes("timeframe=1h"))).toBe(true);
    });
  });

  it("applies the global timeframe shortcut to the focused cell only", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    // Interacting with a cell focuses it; the shortcut then aims at that cell.
    await user.click(
      within(within(cell(1)).getByRole("group", { name: "Interval for chart 2" })).getByRole(
        "button",
        { name: "1m" },
      ),
    );
    // Dispatched rather than clicked, so it has to be wrapped for React to flush.
    act(() => {
      window.dispatchEvent(
        new CustomEvent(CHART_TIMEFRAME_EVENT, { detail: { timeframe: "1d" } }),
      );
    });

    const secondCell = within(cell(1)).getByRole("group", { name: "Interval for chart 2" });
    expect(within(secondCell).getByRole("button", { name: "1d" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The other three charts keep their own intervals.
    for (const index of [0, 2, 3]) {
      const group = within(cell(index)).getByRole("group", { name: `Interval for chart ${index + 1}` });
      expect(within(group).getByRole("button", { name: DEFAULT_MULTI_CHART_CONFIG.cells[index].timeframe })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  });
});

describe("MultiChartGrid responsiveness", () => {
  it("resizes every chart from a container resize without recreating them", async () => {
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));
    const createdBefore = charts.created.length;

    triggerResize(900, 420);

    await waitFor(() => {
      for (const chart of charts.created) {
        expect(chart).toHaveProperty("applyOptions");
        expect((chart as { applyOptions: ReturnType<typeof vi.fn> }).applyOptions).toHaveBeenCalledWith(
          { width: 900, height: 420 },
        );
      }
    });

    // Options were re-applied, not torn down and rebuilt.
    expect(charts.created).toHaveLength(createdBefore);
    expect(charts.removed).toBe(0);
  });

  it("ignores a collapsed container that would hand the chart a zero width", async () => {
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));
    const first = charts.created[0] as { applyOptions: ReturnType<typeof vi.fn> };

    triggerResize(0, 0);
    expect(first.applyOptions).not.toHaveBeenCalled();
  });
});

describe("MultiChartGrid persistence", () => {
  it("saves the chosen layout and restores it on the next mount", async () => {
    const user = userEvent.setup();
    const first = render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    await user.click(screen.getByRole("button", { name: "Dual Split" }));
    await user.selectOptions(
      within(cell(0)).getByRole("combobox", { name: "Chart 1" }),
      "EUR-XLM",
    );
    await user.click(
      within(within(cell(0)).getByRole("group", { name: "Interval for chart 1" })).getByRole(
        "button",
        { name: "1d" },
      ),
    );

    await waitFor(() => {
      expect(getItem<{ layout: string }>(MULTI_CHART_GRID_STORAGE_KEY)?.layout).toBe("dual");
    });

    first.unmount();
    render(<MultiChartGrid />);

    await waitFor(() => expect(chartSections()).toHaveLength(2));
    expect(within(cell(0)).getByRole("combobox", { name: "Chart 1" })).toHaveValue("EUR-XLM");
    expect(
      within(within(cell(0)).getByRole("group", { name: "Interval for chart 1" })).getByRole(
        "button",
        { name: "1d" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the four-cell board that was hidden while a narrow layout was active", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    await user.click(screen.getByRole("button", { name: "Single Chart" }));
    await user.selectOptions(
      within(cell(0)).getByRole("combobox", { name: "Chart 1" }),
      "EUR-XLM",
    );
    await user.click(screen.getByRole("button", { name: "2×2 Quad Grid" }));

    await waitFor(() => expect(chartSections()).toHaveLength(4));
    expect(within(cell(0)).getByRole("combobox", { name: "Chart 1" })).toHaveValue("EUR-XLM");
  });

  it("falls back to the default board when storage holds an unrecognisable payload", async () => {
    window.localStorage.setItem(MULTI_CHART_GRID_STORAGE_KEY, "not-an-envelope");
    render(<MultiChartGrid />);

    await waitFor(() => expect(chartSections()).toHaveLength(4));
    expect(
      within(cell(0)).getByRole("combobox", { name: "Chart 1" }),
    ).toHaveValue(DEFAULT_MULTI_CHART_CONFIG.cells[0].pair);
  });

  it("resets the board back to the defaults on request", async () => {
    const user = userEvent.setup();
    render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    await user.click(screen.getByRole("button", { name: "Dual Split" }));
    await user.selectOptions(
      within(cell(0)).getByRole("combobox", { name: "Chart 1" }),
      "EUR-XLM",
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => expect(chartSections()).toHaveLength(4));
    expect(within(cell(0)).getByRole("combobox", { name: "Chart 1" })).toHaveValue(
      DEFAULT_MULTI_CHART_CONFIG.cells[0].pair,
    );
  });
});

describe("MultiChartGrid cleanup", () => {
  it("removes every chart and observer on unmount", async () => {
    const view = render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));
    expect(liveChartCount()).toBe(4);
    expect(MockResizeObserver.instances).toHaveLength(4);

    view.unmount();

    expect(liveChartCount()).toBe(0);
    expect(MockResizeObserver.instances).toHaveLength(0);
  });

  it("leaves nothing behind after repeated layout changes", async () => {
    const user = userEvent.setup();
    const view = render(<MultiChartGrid />);
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    for (const label of ["Single Chart", "2×2 Quad Grid", "Dual Split", "2×2 Quad Grid"]) {
      await user.click(screen.getByRole("button", { name: label }));
    }
    await waitFor(() => expect(chartSections()).toHaveLength(4));

    // Churn happened, but the board settled back to exactly four live charts.
    expect(charts.created.length).toBeGreaterThan(4);
    expect(liveChartCount()).toBe(4);
    expect(MockResizeObserver.instances).toHaveLength(4);

    view.unmount();

    expect(liveChartCount()).toBe(0);
    expect(MockResizeObserver.instances).toHaveLength(0);
  });
});
