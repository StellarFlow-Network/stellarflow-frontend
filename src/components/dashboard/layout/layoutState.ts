/**
 * Pure state transitions for the customizable dashboard grid (Issue #936).
 *
 * Every function here is side-effect free and returns new objects, which keeps
 * the reducer testable and makes react-grid-layout's imperative drag/resize
 * callbacks easy to funnel through a single validated path.
 *
 * All geometry funnels through `clampItemForCols`, which is the only place that
 * knows the three rules a stored item must satisfy: integer grid coordinates, a
 * size no smaller than the widget's minimum, and a position that keeps the
 * widget inside its breakpoint.
 */

import { ALL_WIDGET_IDS, DEFAULT_VISIBLE_WIDGET_IDS, getWidgetDefinition } from "./catalog";
import { GRID_COLS, REFERENCE_BREAKPOINT, REFERENCE_COLS, colsForBreakpoint } from "./grid";
import {
  LAYOUT_SCHEMA_VERSION,
  type DashboardLayouts,
  type DashboardLayoutState,
  type LayoutItem,
} from "./types";

/** True when two items occupy any of the same grid cells. */
export function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * The smallest width a widget may occupy at a given column count.
 *
 * A widget's declared minimum can exceed a narrow breakpoint (a 3-column
 * minimum is meaningless on a 2-column grid), so the effective minimum is
 * capped at the breakpoint width. Storing the capped value keeps
 * react-grid-layout from enforcing a size the grid cannot satisfy.
 */
export function effectiveMinWidth(id: string, cols: number): number {
  const definition = getWidgetDefinition(id);
  if (!definition) return 1;
  return Math.max(1, Math.min(definition.minSize.w, cols));
}

/**
 * Build a storable, fully clamped `LayoutItem`, or `null` for an unknown id.
 *
 * This is the single source of truth for item geometry: it rounds to whole grid
 * cells, enforces the widget's minimum size, and pulls `x` back inside the
 * breakpoint so `x + w` never exceeds `cols`.
 */
export function clampItemForCols(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number
): LayoutItem | null {
  const definition = getWidgetDefinition(id);
  if (!definition) return null;

  const minW = effectiveMinWidth(id, cols);
  const minH = Math.max(1, definition.minSize.h);

  const width = Math.max(minW, Math.min(cols, Math.round(w)));
  const height = Math.max(minH, Math.round(h));

  return {
    i: id,
    x: Math.max(0, Math.min(Math.round(x), cols - width)),
    y: Math.max(0, Math.round(y)),
    w: width,
    h: height,
    minW,
    minH,
  };
}

/** Re-clamp an existing item for a breakpoint. */
export function clampItemToCols(item: LayoutItem, cols: number): LayoutItem | null {
  return clampItemForCols(item.i, item.x, item.y, item.w, item.h, cols);
}

/**
 * Find the first grid position where a `w`x`h` box does not overlap anything
 * already placed, scanning row by row.
 *
 * `w` must already be clamped to `cols`; callers get it from
 * `clampItemForCols`'s width rule so the collision test and the stored item
 * agree.
 */
export function findNextFreeSpot(
  items: readonly LayoutItem[],
  w: number,
  h: number,
  cols: number = REFERENCE_COLS
): { x: number; y: number } {
  const width = Math.max(1, Math.min(Math.round(w), cols));
  const maxRow = items.reduce((max, it) => Math.max(max, it.y + it.h), 0);

  for (let y = 0; y <= maxRow; y += 1) {
    for (let x = 0; x <= cols - width; x += 1) {
      const candidate: LayoutItem = { i: "", x, y, w: width, h, minW: 0, minH: 0 };
      if (!items.some((it) => overlaps(candidate, it))) {
        return { x, y };
      }
    }
  }

  // No gap large enough: append below everything currently placed.
  return { x: 0, y: maxRow };
}

/**
 * Re-pack a list of items for a narrower breakpoint.
 *
 * Clamping each item's `w`/`x` independently is not enough: two widgets that sit
 * side by side on a 12-column grid can both clamp to full width on a 6-column
 * grid and end up on top of each other. Instead the items are replayed in their
 * existing order at the first free spot, which preserves the user's ordering
 * and each widget's size while guaranteeing a valid, non-overlapping layout at
 * every breakpoint.
 */
export function repackForCols(items: readonly LayoutItem[], cols: number): LayoutItem[] {
  const packed: LayoutItem[] = [];

  for (const item of items) {
    const width = Math.max(1, Math.min(item.w, cols));
    const { x, y } = findNextFreeSpot(packed, width, item.h, cols);
    const clamped = clampItemForCols(item.i, x, y, width, item.h, cols);
    if (clamped) packed.push(clamped);
  }

  return packed;
}

/** Build a `LayoutItem` for a widget, placed at the next free spot. */
export function buildItemForWidget(
  id: string,
  items: readonly LayoutItem[],
  cols: number = REFERENCE_COLS
): LayoutItem | null {
  const definition = getWidgetDefinition(id);
  if (!definition) return null;

  const width = Math.max(1, Math.min(definition.defaultSize.w, cols));
  const { x, y } = findNextFreeSpot(items, width, definition.defaultSize.h, cols);

  return clampItemForCols(id, x, y, width, definition.defaultSize.h, cols);
}

/** The layout restored by "Reset to Default Layout". */
export function createDefaultLayout(): DashboardLayoutState {
  const reference: LayoutItem[] = [];
  for (const id of DEFAULT_VISIBLE_WIDGET_IDS) {
    const item = buildItemForWidget(id, reference, REFERENCE_COLS);
    if (item) reference.push(item);
  }

  const layouts: DashboardLayouts = {};
  for (const [breakpoint, cols] of Object.entries(GRID_COLS)) {
    layouts[breakpoint] =
      breakpoint === REFERENCE_BREAKPOINT
        ? reference.map((item) => ({ ...item }))
        : repackForCols(reference, cols);
  }

  return { version: LAYOUT_SCHEMA_VERSION, layouts };
}

/** The reference-breakpoint layout, which is the source of truth for membership. */
export function referenceLayout(state: DashboardLayoutState): LayoutItem[] {
  return state.layouts[REFERENCE_BREAKPOINT] ?? [];
}

/** Whether a widget is currently on the grid. */
export function isPlaced(state: DashboardLayoutState, id: string): boolean {
  return referenceLayout(state).some((item) => item.i === id);
}

/** Ids of every widget on the grid, in placement order. */
export function placedIds(state: DashboardLayoutState): string[] {
  return referenceLayout(state).map((item) => item.i);
}

/** Ids of catalog widgets not currently on the grid, in catalog order. */
export function availableWidgetIds(state: DashboardLayoutState): string[] {
  return ALL_WIDGET_IDS.filter((id) => !isPlaced(state, id));
}

/**
 * Add a widget to every breakpoint, placed at the first free spot for that
 * breakpoint's column count. Unknown or already-placed ids are ignored.
 */
export function addWidget(state: DashboardLayoutState, id: string): DashboardLayoutState {
  if (!getWidgetDefinition(id) || isPlaced(state, id)) return state;

  const layouts: DashboardLayouts = {};
  for (const [breakpoint, existing] of Object.entries(state.layouts)) {
    const item = buildItemForWidget(id, existing, colsForBreakpoint(breakpoint));
    layouts[breakpoint] = item ? [...existing, item] : existing;
  }
  return { ...state, layouts };
}

/** Remove a widget from every breakpoint. */
export function removeWidget(state: DashboardLayoutState, id: string): DashboardLayoutState {
  if (!isPlaced(state, id)) return state;

  const layouts: DashboardLayouts = {};
  for (const [breakpoint, existing] of Object.entries(state.layouts)) {
    layouts[breakpoint] = existing.filter((item) => item.i !== id);
  }
  return { ...state, layouts };
}

/**
 * Apply a layout emitted by react-grid-layout for one breakpoint after a drag
 * or resize.
 *
 * Unknown widgets and duplicates are dropped, every surviving item is re-clamped
 * by `clampItemForCols`, and items the library omitted are kept at their
 * previous position so a mid-drag callback can never silently delete a widget.
 */
export function applyGridLayout(
  state: DashboardLayoutState,
  breakpoint: string,
  next: readonly LayoutItem[]
): DashboardLayoutState {
  const previous = state.layouts[breakpoint] ?? [];
  const cols = colsForBreakpoint(breakpoint);
  const seen = new Set<string>();
  const items: LayoutItem[] = [];

  for (const raw of next) {
    if (seen.has(raw.i)) continue;
    const item = clampItemForCols(raw.i, raw.x, raw.y, raw.w, raw.h, cols);
    if (!item) continue;
    seen.add(item.i);
    items.push(item);
  }

  for (const existing of previous) {
    if (!seen.has(existing.i)) items.push({ ...existing });
  }

  return { ...state, layouts: { ...state.layouts, [breakpoint]: items } };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validate and repair a layout read from localStorage (or any untrusted
 * source).
 *
 * Returns `null` when the payload is unusable so callers fall back to the
 * default layout instead of rendering a broken grid. Individual malformed
 * entries are dropped; the rest are kept and repaired.
 */
export function normalizeLayout(raw: unknown): DashboardLayoutState | null {
  if (typeof raw !== "object" || raw === null) return null;

  const candidate = raw as { version?: unknown; layouts?: unknown };

  // A missing or future schema version must not be reinterpreted.
  if (!isFiniteNumber(candidate.version)) return null;
  if (candidate.version !== LAYOUT_SCHEMA_VERSION) return null;

  if (typeof candidate.layouts !== "object" || candidate.layouts === null) return null;

  const rawLayouts = candidate.layouts as Record<string, unknown>;
  const layouts: DashboardLayouts = {};

  for (const [breakpoint, rawItems] of Object.entries(rawLayouts)) {
    if (!Array.isArray(rawItems)) return null;

    const cols = colsForBreakpoint(breakpoint);
    const seen = new Set<string>();
    const items: LayoutItem[] = [];

    for (const entry of rawItems) {
      if (typeof entry !== "object" || entry === null) continue;
      const value = entry as Record<string, unknown>;

      if (
        !isFiniteNumber(value.x) ||
        !isFiniteNumber(value.y) ||
        !isFiniteNumber(value.w) ||
        !isFiniteNumber(value.h)
      ) {
        continue;
      }

      const item = clampItemForCols(
        typeof value.i === "string" ? value.i : "",
        value.x,
        value.y,
        value.w,
        value.h,
        cols
      );
      if (!item || seen.has(item.i)) continue;

      seen.add(item.i);
      items.push(item);
    }
    layouts[breakpoint] = items;
  }

  // The reference breakpoint drives widget membership, so it must be present.
  if (!Array.isArray(layouts[REFERENCE_BREAKPOINT])) return null;

  return { version: LAYOUT_SCHEMA_VERSION, layouts };
}
