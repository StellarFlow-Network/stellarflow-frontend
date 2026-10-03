import { describe, expect, it } from "vitest";

import {
  ALL_WIDGET_IDS,
  CATEGORY_LABELS,
  DEFAULT_VISIBLE_WIDGET_IDS,
  WIDGET_CATALOG,
  getWidgetDefinition,
} from "@/components/dashboard/layout/catalog";
import {
  DASHBOARD_GRID,
  GRID_BREAKPOINTS,
  GRID_COLS,
  REFERENCE_BREAKPOINT,
  REFERENCE_COLS,
  colsForBreakpoint,
} from "@/components/dashboard/layout/grid";
import {
  addWidget,
  applyGridLayout,
  availableWidgetIds,
  clampItemToCols,
  createDefaultLayout,
  findNextFreeSpot,
  isPlaced,
  normalizeLayout,
  overlaps,
  placedIds,
  referenceLayout,
  removeWidget,
  repackForCols,
} from "@/components/dashboard/layout/layoutState";
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  clearLayout,
  loadLayout,
  loadLayoutOrDefault,
  saveLayout,
} from "@/components/dashboard/layout/storage";
import { LAYOUT_SCHEMA_VERSION, type LayoutItem } from "@/components/dashboard/layout/types";

function item(partial: Partial<LayoutItem> & { i: string }): LayoutItem {
  return { x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1, ...partial };
}

describe("widget catalog", () => {
  it("gives every widget a unique id", () => {
    expect(new Set(ALL_WIDGET_IDS).size).toBe(ALL_WIDGET_IDS.length);
  });

  it("covers the three categories named in the issue", () => {
    const categories = new Set(WIDGET_CATALOG.map((w) => w.category));
    expect([...categories].sort()).toEqual(["analytics", "bookmarks", "portfolio"]);
  });

  it("labels categories as Charts, Bookmarks and Portfolio", () => {
    expect(CATEGORY_LABELS.analytics).toBe("Charts");
    expect(CATEGORY_LABELS.bookmarks).toBe("Bookmarks");
    expect(CATEGORY_LABELS.portfolio).toBe("Portfolio");
  });

  it("never lets a widget's minimum size exceed its default size", () => {
    for (const widget of WIDGET_CATALOG) {
      expect(widget.minSize.w).toBeLessThanOrEqual(widget.defaultSize.w);
      expect(widget.minSize.h).toBeLessThanOrEqual(widget.defaultSize.h);
    }
  });

  it("keeps every default size within the reference column count", () => {
    for (const widget of WIDGET_CATALOG) {
      expect(widget.defaultSize.w).toBeLessThanOrEqual(REFERENCE_COLS);
    }
  });

  it("resolves ids to definitions and returns undefined for unknown ids", () => {
    expect(getWidgetDefinition(ALL_WIDGET_IDS[0])?.id).toBe(ALL_WIDGET_IDS[0]);
    expect(getWidgetDefinition("not-a-widget")).toBeUndefined();
  });
});

describe("grid configuration", () => {
  it("declares a layout for every breakpoint", () => {
    for (const bp of DASHBOARD_GRID) {
      expect(GRID_BREAKPOINTS[bp.name]).toBe(bp.minWidth);
      expect(GRID_COLS[bp.name]).toBe(bp.cols);
    }
  });

  it("orders breakpoints from widest to narrowest with descending columns", () => {
    const cols = DASHBOARD_GRID.map((bp) => bp.cols);
    expect(cols).toEqual([...cols].sort((a, b) => b - a));
    const widths = DASHBOARD_GRID.map((bp) => bp.minWidth);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });

  it("treats the widest breakpoint as the reference", () => {
    expect(REFERENCE_BREAKPOINT).toBe(DASHBOARD_GRID[0].name);
    expect(colsForBreakpoint(REFERENCE_BREAKPOINT)).toBe(REFERENCE_COLS);
  });

  it("falls back to the reference column count for unknown breakpoints", () => {
    expect(colsForBreakpoint("nope")).toBe(REFERENCE_COLS);
  });
});

describe("overlaps", () => {
  it("detects intersecting boxes", () => {
    expect(overlaps(item({ i: "a", x: 0, y: 0, w: 2, h: 2 }), item({ i: "b", x: 1, y: 1, w: 2, h: 2 }))).toBe(
      true
    );
  });

  it("ignores boxes that merely touch", () => {
    expect(overlaps(item({ i: "a", x: 0, y: 0, w: 2, h: 2 }), item({ i: "b", x: 2, y: 0, w: 2, h: 2 }))).toBe(
      false
    );
  });
});

describe("findNextFreeSpot", () => {
  it("returns the origin for an empty grid", () => {
    expect(findNextFreeSpot([], 4, 3, 12)).toEqual({ x: 0, y: 0 });
  });

  it("places a neighbour directly to the right", () => {
    const placed = [item({ i: "a", x: 0, y: 0, w: 4, h: 3 })];
    expect(findNextFreeSpot(placed, 4, 3, 12)).toEqual({ x: 4, y: 0 });
  });

  it("skips occupied cells in the same row", () => {
    const placed = [item({ i: "a", x: 0, y: 0, w: 4, h: 3 })];
    const spot = findNextFreeSpot(placed, 6, 3, 12);
    expect(placed.some((it) => overlaps(item({ i: "probe", ...spot, w: 6, h: 3 }), it))).toBe(
      false
    );
  });

  it("appends below the grid when nothing fits", () => {
    const placed = [item({ i: "a", x: 0, y: 0, w: 12, h: 4 })];
    expect(findNextFreeSpot(placed, 4, 2, 12)).toEqual({ x: 0, y: 4 });
  });

  it("clamps a widget wider than the breakpoint to the full width", () => {
    expect(findNextFreeSpot([], 20, 2, 6)).toEqual({ x: 0, y: 0 });
  });
});

describe("clampItemToCols", () => {
  const wide = ALL_WIDGET_IDS.find((id) => (getWidgetDefinition(id)?.defaultSize.w ?? 0) > 4)!;
  const narrow = ALL_WIDGET_IDS.find((id) => (getWidgetDefinition(id)?.defaultSize.w ?? 0) <= 4)!;

  it("leaves a fitting item untouched", () => {
    const definition = getWidgetDefinition(wide)!;
    const original = item({
      i: wide,
      x: 0,
      y: 0,
      w: definition.defaultSize.w,
      h: definition.defaultSize.h,
      minW: definition.minSize.w,
      minH: definition.minSize.h,
    });
    expect(clampItemToCols(original, REFERENCE_COLS)).toEqual(original);
  });

  it("shrinks a widget that is too wide for the breakpoint", () => {
    expect(clampItemToCols(item({ i: wide, w: 6 }), 2)?.w).toBe(2);
  });

  it("pulls x back inside the grid", () => {
    // A 4-wide widget at x=10 would end at column 14 on a 6-column grid.
    expect(clampItemToCols(item({ i: narrow, x: 10, w: 4 }), 6)?.x).toBe(2);
  });

  it("returns null for an id that is not in the catalog", () => {
    expect(clampItemToCols(item({ i: "ghost" }), 12)).toBeNull();
  });
});

describe("repackForCols", () => {
  const layout = createDefaultLayout();
  const reference = referenceLayout(layout);

  it("produces a non-overlapping layout at every breakpoint", () => {
    for (const [breakpoint, items] of Object.entries(layout.layouts)) {
      expect(colsForBreakpoint(breakpoint)).toBeGreaterThan(0);
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          expect(overlaps(items[i], items[j])).toBe(false);
        }
      }
    }
  });

  it("keeps two side-by-side widgets from colliding on a narrower grid", () => {
    // Two 6-wide widgets sit side by side on 12 columns but both clamp to full
    // width on 6 columns, so independent clamping alone would overlap them.
    const packed = repackForCols(reference, colsForBreakpoint("sm"));
    expect(packed).toHaveLength(reference.length);
    expect(overlaps(packed[0], packed[1])).toBe(false);
  });

  it("keeps the same widget order as the reference layout", () => {
    for (const items of Object.values(layout.layouts)) {
      expect(items.map((it) => it.i)).toEqual(reference.map((it) => it.i));
    }
  });

  it("keeps every repacked widget inside its breakpoint", () => {
    const packed = repackForCols(reference, colsForBreakpoint("xs"));
    for (const it of packed) {
      expect(it.x).toBeGreaterThanOrEqual(0);
      expect(it.x + it.w).toBeLessThanOrEqual(colsForBreakpoint("xs"));
    }
  });

  it("drops items whose id left the catalog", () => {
    expect(repackForCols([...reference, item({ i: "ghost" })], 12)).toHaveLength(
      reference.length
    );
  });
});

describe("createDefaultLayout", () => {
  const layout = createDefaultLayout();

  it("places exactly the widgets marked visible by default", () => {
    expect(placedIds(layout)).toEqual([...DEFAULT_VISIBLE_WIDGET_IDS]);
  });

  it("stamps the current schema version", () => {
    expect(layout.version).toBe(LAYOUT_SCHEMA_VERSION);
  });

  it("produces a layout for every breakpoint", () => {
    expect(Object.keys(layout.layouts).sort()).toEqual(Object.keys(GRID_COLS).sort());
  });

  it("never overlaps two default widgets", () => {
    const items = referenceLayout(layout);
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        expect(overlaps(items[i], items[j])).toBe(false);
      }
    }
  });

  it("keeps every default widget inside the reference grid", () => {
    for (const it of referenceLayout(layout)) {
      expect(it.x).toBeGreaterThanOrEqual(0);
      expect(it.x + it.w).toBeLessThanOrEqual(REFERENCE_COLS);
    }
  });

  it("keeps every widget inside each narrower breakpoint", () => {
    for (const [breakpoint, items] of Object.entries(layout.layouts)) {
      const cols = colsForBreakpoint(breakpoint);
      for (const it of items) {
        expect(it.x).toBeGreaterThanOrEqual(0);
        expect(it.x + it.w).toBeLessThanOrEqual(cols);
      }
    }
  });

  it("carries each widget's declared minimum size", () => {
    for (const it of referenceLayout(layout)) {
      const definition = getWidgetDefinition(it.i);
      expect(it.minW).toBe(definition?.minSize.w);
      expect(it.minH).toBe(definition?.minSize.h);
    }
  });
});

describe("addWidget", () => {
  it("adds a hidden-by-default widget", () => {
    const before = createDefaultLayout();
    const hidden = ALL_WIDGET_IDS.find((id) => !DEFAULT_VISIBLE_WIDGET_IDS.includes(id))!;
    const after = addWidget(before, hidden);

    expect(isPlaced(after, hidden)).toBe(true);
    expect(placedIds(after).length).toBe(placedIds(before).length + 1);
  });

  it("adds the widget at every breakpoint", () => {
    const before = createDefaultLayout();
    const after = addWidget(before, "bookmarks-watchlist");

    for (const items of Object.values(after.layouts)) {
      expect(items.some((it) => it.i === "bookmarks-watchlist")).toBe(true);
    }
  });

  it("ignores an unknown widget id", () => {
    const before = createDefaultLayout();
    expect(addWidget(before, "does-not-exist")).toBe(before);
  });

  it("is idempotent for an already-placed widget", () => {
    const before = createDefaultLayout();
    const first = DEFAULT_VISIBLE_WIDGET_IDS[0];
    expect(addWidget(addWidget(before, first), first)).toBe(addWidget(before, first));
  });

  it("does not mutate the input layout", () => {
    const before = createDefaultLayout();
    const snapshot = JSON.stringify(before);
    addWidget(before, "bookmarks-watchlist");
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("keeps added widgets from overlapping existing ones", () => {
    let layout = createDefaultLayout();
    for (const id of ALL_WIDGET_IDS) layout = addWidget(layout, id);

    for (const items of Object.values(layout.layouts)) {
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          expect(overlaps(items[i], items[j])).toBe(false);
        }
      }
    }
  });
});

describe("removeWidget", () => {
  it("removes the widget from every breakpoint", () => {
    const added = addWidget(createDefaultLayout(), "bookmarks-watchlist");
    const removed = removeWidget(added, "bookmarks-watchlist");

    for (const items of Object.values(removed.layouts)) {
      expect(items.some((it) => it.i === "bookmarks-watchlist")).toBe(false);
    }
  });

  it("leaves other widgets in place", () => {
    const before = createDefaultLayout();
    const target = placedIds(before)[0];
    const after = removeWidget(before, target);

    expect(placedIds(after)).toEqual(placedIds(before).filter((id) => id !== target));
  });

  it("is a no-op for a widget that is not placed", () => {
    const before = createDefaultLayout();
    expect(removeWidget(before, "bookmarks-watchlist")).toBe(before);
  });

  it("round-trips with addWidget", () => {
    const before = createDefaultLayout();
    const hidden = "bookmarks-watchlist";
    expect(removeWidget(addWidget(before, hidden), hidden).layouts).toEqual(before.layouts);
  });
});

describe("applyGridLayout", () => {
  const layout = createDefaultLayout();
  const [first, second] = referenceLayout(layout);

  it("records a drag", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      { ...first, x: 6, y: 9 },
      second,
    ]);
    const moved = next.layouts[REFERENCE_BREAKPOINT].find((it) => it.i === first.i)!;
    expect(moved.x).toBe(6);
    expect(moved.y).toBe(9);
  });

  it("records a resize", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      { ...first, w: 5, h: 9 },
      second,
    ]);
    const resized = next.layouts[REFERENCE_BREAKPOINT].find((it) => it.i === first.i)!;
    expect(resized.w).toBe(5);
    expect(resized.h).toBe(9);
  });

  it("clamps a resize below the widget's minimum size", () => {
    const definition = getWidgetDefinition(first.i)!;
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      { ...first, w: 1, h: 1 },
      second,
    ]);
    const resized = next.layouts[REFERENCE_BREAKPOINT].find((it) => it.i === first.i)!;
    expect(resized.w).toBe(definition.minSize.w);
    expect(resized.h).toBe(definition.minSize.h);
  });

  it("rounds fractional grid coordinates", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      { ...first, x: 3.4, y: 2.6 },
      second,
    ]);
    const moved = next.layouts[REFERENCE_BREAKPOINT].find((it) => it.i === first.i)!;
    expect(moved.x).toBe(3);
    expect(moved.y).toBe(3);
  });

  it("never stores a negative position", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      { ...first, x: -5, y: -2 },
      second,
    ]);
    const moved = next.layouts[REFERENCE_BREAKPOINT].find((it) => it.i === first.i)!;
    expect(moved.x).toBe(0);
    expect(moved.y).toBe(0);
  });

  it("drops a widget that is not in the catalog", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      first,
      second,
      item({ i: "ghost" }),
    ]);
    expect(placedIds(next)).not.toContain("ghost");
  });

  it("keeps the first of two duplicate entries", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [
      { ...first, x: 0 },
      { ...first, x: 7 },
      second,
    ]);
    const entries = next.layouts[REFERENCE_BREAKPOINT].filter((it) => it.i === first.i);
    expect(entries).toHaveLength(1);
    expect(entries[0].x).toBe(0);
  });

  it("keeps a widget the library omitted from the callback", () => {
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [first]);
    expect(placedIds(next)).toEqual(placedIds(layout));
  });

  it("does not mutate the input layout", () => {
    const snapshot = JSON.stringify(layout);
    applyGridLayout(layout, REFERENCE_BREAKPOINT, [{ ...first, x: 9 }, second]);
    expect(JSON.stringify(layout)).toBe(snapshot);
  });

  it("only changes the breakpoint it was given", () => {
    const before = layout.layouts["sm"];
    const next = applyGridLayout(layout, REFERENCE_BREAKPOINT, [{ ...first, x: 9 }, second]);
    expect(next.layouts["sm"]).toEqual(before);
  });

  it("keeps a widget inside a narrow breakpoint", () => {
    const sm = layout.layouts["sm"];
    const next = applyGridLayout(layout, "sm", sm.map((it) => ({ ...it, x: 99, w: 99 })));
    const cols = colsForBreakpoint("sm");
    for (const it of next.layouts["sm"]) {
      expect(it.x + it.w).toBeLessThanOrEqual(cols);
    }
  });
});

describe("availableWidgetIds", () => {
  it("omits widgets already on the grid", () => {
    const layout = createDefaultLayout();
    for (const id of placedIds(layout)) {
      expect(availableWidgetIds(layout)).not.toContain(id);
    }
  });

  it("returns nothing once the whole catalog is placed", () => {
    let layout = createDefaultLayout();
    for (const id of ALL_WIDGET_IDS) layout = addWidget(layout, id);
    expect(availableWidgetIds(layout)).toEqual([]);
  });

  it("returns the whole catalog for an empty dashboard", () => {
    const empty = { version: LAYOUT_SCHEMA_VERSION, layouts: { [REFERENCE_BREAKPOINT]: [] } };
    expect(availableWidgetIds(empty)).toEqual([...ALL_WIDGET_IDS]);
  });
});

describe("normalizeLayout", () => {
  it("round-trips a real layout", () => {
    const layout = createDefaultLayout();
    expect(normalizeLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
  });

  it("rejects a payload that is not an object", () => {
    expect(normalizeLayout(null)).toBeNull();
    expect(normalizeLayout("nope")).toBeNull();
    expect(normalizeLayout(42)).toBeNull();
  });

  it("rejects a missing version", () => {
    expect(normalizeLayout({ layouts: { lg: [] } })).toBeNull();
  });

  it("rejects an unknown schema version", () => {
    const layout = createDefaultLayout();
    expect(normalizeLayout({ ...layout, version: LAYOUT_SCHEMA_VERSION + 1 })).toBeNull();
  });

  it("rejects a payload without a reference breakpoint", () => {
    expect(normalizeLayout({ version: LAYOUT_SCHEMA_VERSION, layouts: { sm: [] } })).toBeNull();
  });

  it("rejects a breakpoint whose layout is not an array", () => {
    expect(
      normalizeLayout({ version: LAYOUT_SCHEMA_VERSION, layouts: { [REFERENCE_BREAKPOINT]: {} } })
    ).toBeNull();
  });

  it("accepts an empty dashboard", () => {
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: { [REFERENCE_BREAKPOINT]: [] },
    });
    expect(result?.layouts[REFERENCE_BREAKPOINT]).toEqual([]);
  });

  it("drops entries that are not known widgets", () => {
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: { [REFERENCE_BREAKPOINT]: [{ i: "ghost", x: 0, y: 0, w: 1, h: 1 }] },
    });
    expect(result?.layouts[REFERENCE_BREAKPOINT]).toEqual([]);
  });

  it("drops entries with non-numeric geometry", () => {
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: {
        [REFERENCE_BREAKPOINT]: [{ i: ALL_WIDGET_IDS[0], x: "left", y: 0, w: 2, h: 2 }],
      },
    });
    expect(result?.layouts[REFERENCE_BREAKPOINT]).toEqual([]);
  });

  it("drops entries with NaN or Infinity geometry", () => {
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: {
        [REFERENCE_BREAKPOINT]: [{ i: ALL_WIDGET_IDS[0], x: NaN, y: Infinity, w: 2, h: 2 }],
      },
    });
    expect(result?.layouts[REFERENCE_BREAKPOINT]).toEqual([]);
  });

  it("deduplicates repeated widget ids", () => {
    const id = ALL_WIDGET_IDS[0];
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: {
        [REFERENCE_BREAKPOINT]: [
          { i: id, x: 0, y: 0, w: 2, h: 2 },
          { i: id, x: 5, y: 5, w: 2, h: 2 },
        ],
      },
    });
    expect(result?.layouts[REFERENCE_BREAKPOINT]).toHaveLength(1);
  });

  it("repairs an out-of-bounds position instead of discarding the widget", () => {
    const id = ALL_WIDGET_IDS[0];
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: { [REFERENCE_BREAKPOINT]: [{ i: id, x: 999, y: 0, w: 2, h: 2 }] },
    });
    const repaired = result!.layouts[REFERENCE_BREAKPOINT][0];
    expect(repaired.i).toBe(id);
    expect(repaired.x + repaired.w).toBeLessThanOrEqual(REFERENCE_COLS);
  });

  it("repairs a size below the widget minimum", () => {
    const id = ALL_WIDGET_IDS[0];
    const definition = getWidgetDefinition(id)!;
    const result = normalizeLayout({
      version: LAYOUT_SCHEMA_VERSION,
      layouts: { [REFERENCE_BREAKPOINT]: [{ i: id, x: 0, y: 0, w: 1, h: 1 }] },
    });
    const repaired = result!.layouts[REFERENCE_BREAKPOINT][0];
    expect(repaired.w).toBe(definition.minSize.w);
    expect(repaired.h).toBe(definition.minSize.h);
  });
});

describe("layout storage", () => {
  function installMemoryStorage() {
    const store = new Map<string, string>();
    const fake = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    Object.defineProperty(window, "localStorage", { value: fake, configurable: true });
    return store;
  }

  it("round-trips a saved layout", () => {
    installMemoryStorage();
    const layout = createDefaultLayout();
    saveLayout(layout);
    expect(loadLayout()).toEqual(layout);
  });

  it("stores under a versioned key", () => {
    const store = installMemoryStorage();
    saveLayout(createDefaultLayout());
    expect(store.get(DASHBOARD_LAYOUT_STORAGE_KEY)).toBeTruthy();
    expect(DASHBOARD_LAYOUT_STORAGE_KEY).toContain("v1");
  });

  it("returns null when nothing is stored", () => {
    installMemoryStorage();
    expect(loadLayout()).toBeNull();
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    installMemoryStorage();
    window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, "{not json");
    expect(loadLayout()).toBeNull();
  });

  it("returns null for a structurally invalid payload", () => {
    installMemoryStorage();
    window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, '{"version":99}');
    expect(loadLayout()).toBeNull();
  });

  it("clears the stored layout", () => {
    installMemoryStorage();
    saveLayout(createDefaultLayout());
    clearLayout();
    expect(loadLayout()).toBeNull();
  });

  it("falls back to the default layout when storage is empty", () => {
    installMemoryStorage();
    expect(loadLayoutOrDefault()).toEqual(createDefaultLayout());
  });

  it("survives a save that throws", () => {
    installMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
      configurable: true,
    });

    expect(() => saveLayout(createDefaultLayout())).not.toThrow();
    expect(() => clearLayout()).not.toThrow();
    expect(loadLayout()).toBeNull();
    expect(loadLayoutOrDefault()).toEqual(createDefaultLayout());
  });
});
