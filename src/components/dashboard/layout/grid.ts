/**
 * Grid geometry for the customizable dashboard (Issue #936).
 *
 * Kept separate from the component so tests can assert the same numbers the
 * grid is configured with.
 */

/** Layout of the dashboard grid at a given viewport width. */
export interface DashboardGridConfig {
  name: string;
  /** Minimum viewport width (px) for this breakpoint. */
  minWidth: number;
  /** Number of grid columns at this breakpoint. */
  cols: number;
}

/**
 * Breakpoints are desktop-first: the acceptance criteria only require
 * drag-and-snap on desktop viewports, and collapsing to fewer columns keeps
 * narrow viewports usable without a second interaction model.
 */
export const DASHBOARD_GRID: readonly DashboardGridConfig[] = [
  { name: "lg", minWidth: 1200, cols: 12 },
  { name: "md", minWidth: 900, cols: 10 },
  { name: "sm", minWidth: 640, cols: 6 },
  { name: "xs", minWidth: 0, cols: 2 },
] as const;

/** Row height in pixels. 64px keeps a 1-row widget roughly one content block. */
export const ROW_HEIGHT = 64;

/** Gap between widgets in pixels. */
export const GRID_MARGIN: readonly [number, number] = [16, 16];

/** Padding around the whole grid in pixels. */
export const GRID_CONTAINER_PADDING: readonly [number, number] = [16, 16];

/**
 * The widest breakpoint. Its layout is the reference: it decides which widgets
 * are placed and where new widgets are appended, and the other breakpoints are
 * derived from it.
 */
export const REFERENCE_BREAKPOINT = "lg";

/** Columns at the reference breakpoint. */
export const REFERENCE_COLS = colsForBreakpoint(REFERENCE_BREAKPOINT);

/** Map a breakpoint name to its column count. */
export function colsForBreakpoint(name: string): number {
  return DASHBOARD_GRID.find((bp) => bp.name === name)?.cols ?? REFERENCE_COLS;
}

/** react-grid-layout `breakpoints` prop (name -> min width). */
export const GRID_BREAKPOINTS: Record<string, number> = Object.fromEntries(
  DASHBOARD_GRID.map((bp) => [bp.name, bp.minWidth])
);

/** react-grid-layout `cols` prop (name -> column count). */
export const GRID_COLS: Record<string, number> = Object.fromEntries(
  DASHBOARD_GRID.map((bp) => [bp.name, bp.cols])
);
