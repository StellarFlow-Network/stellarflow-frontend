/**
 * Types for the customizable dashboard grid (Issue #936).
 *
 * The grid state is deliberately kept as plain data so it can be persisted to
 * localStorage, validated on load, and unit-tested without a DOM.
 */

/** Buckets used by the "Add Widget" drawer. */
export type WidgetCategory = "analytics" | "bookmarks" | "portfolio";

/**
 * Static description of a widget the user may place on the grid.
 *
 * `defaultSize`/`minSize` are in grid units (columns x rows) and feed straight
 * into react-grid-layout, which clamps resizing to `minSize`.
 */
export interface DashboardWidgetDefinition {
  /** Stable identifier; also the react-grid-layout item key. */
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  /** Size applied when the widget is first added. */
  defaultSize: { w: number; h: number };
  /** Smallest size the user can resize down to. */
  minSize: { w: number; h: number };
  /** Whether the widget ships visible in the default layout. */
  defaultVisible: boolean;
}

/** A single placed widget: where it sits and how big it is, in grid units. */
export interface LayoutItem {
  /** Widget id — matches `DashboardWidgetDefinition.id`. */
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
}

/**
 * Layouts keyed by breakpoint name, matching what react-grid-layout's
 * `Responsive` component consumes.
 *
 * The widest breakpoint is the reference one: it drives the widget list and is
 * the layout every other breakpoint is derived from when a widget is added.
 */
export type DashboardLayouts = Record<string, LayoutItem[]>;

/**
 * Persisted dashboard layout.
 *
 * `version` is bumped whenever the shape changes so a stale localStorage entry
 * can be discarded instead of being misread as a valid layout.
 */
export interface DashboardLayoutState {
  version: number;
  layouts: DashboardLayouts;
}

/** Bumped on breaking changes to `DashboardLayoutState`. */
export const LAYOUT_SCHEMA_VERSION = 1;
