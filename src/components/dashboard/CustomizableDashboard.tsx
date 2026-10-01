"use client";

/**
 * CustomizableDashboard — drag-and-drop, resizable widget grid (Issue #936).
 *
 * Layout is plain data (`layoutState.ts`), persisted to localStorage
 * (`storage.ts`), and rendered through react-grid-layout's `Responsive`
 * component. Nothing about the grid geometry lives in this file, so the state
 * machine can be unit-tested without a DOM or a layout engine.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Responsive, useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

import Icon from "@/components/icons/Icon";
import type { IconId } from "@/components/icons/iconIds";
import { CATEGORY_LABELS, getWidgetDefinition } from "./layout/catalog";
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_CONTAINER_PADDING,
  GRID_MARGIN,
  ROW_HEIGHT,
} from "./layout/grid";
import {
  addWidget,
  applyGridLayout,
  availableWidgetIds,
  createDefaultLayout,
  placedIds,
  removeWidget,
} from "./layout/layoutState";
import { loadLayoutOrDefault, saveLayout } from "./layout/storage";
import type { DashboardLayoutState, WidgetCategory } from "./layout/types";

const CATEGORY_ORDER: readonly WidgetCategory[] = ["analytics", "bookmarks", "portfolio"];

const CATEGORY_ICONS: Record<WidgetCategory, IconId> = {
  analytics: "lineChart",
  bookmarks: "bookOpen",
  portfolio: "wallet",
};

/**
 * Load once on mount: the server has no localStorage, so reading during render
 * would produce different markup on the server and the client.
 */
const INITIAL_LAYOUT: DashboardLayoutState = createDefaultLayout();

export function CustomizableDashboard() {
  const { width, containerRef, mounted } = useContainerWidth();
  const [layout, setLayout] = useState<DashboardLayoutState>(INITIAL_LAYOUT);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [breakpoint, setBreakpoint] = useState<string>(Object.keys(GRID_COLS)[0]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from storage after the first paint so SSR and the first client
  // render agree, and so a saved layout survives navigation.
  useEffect(() => {
    setLayout(loadLayoutOrDefault());
    setIsHydrated(true);
  }, []);

  // Persist every accepted change. Writes are cheap and idempotent, and going
  // through one effect means a drag, a resize, an add and a remove are all
  // saved by the same path.
  //
  // Gated on `isHydrated`: without it the first pass would write the default
  // layout over the stored one before the load above had a chance to apply it.
  useEffect(() => {
    if (!isHydrated) return;
    saveLayout(layout);
  }, [isHydrated, layout]);

  // `onLayoutChange` reports the layout for the breakpoint currently in view, so
  // the write is scoped to that breakpoint and the others are left alone.
  const handleLayoutChange = useCallback(
    (current: Layout) => {
      setLayout((prev) => applyGridLayout(prev, breakpoint, current));
    },
    [breakpoint]
  );

  const handleAddWidget = useCallback((id: string) => {
    setLayout((prev) => addWidget(prev, id));
  }, []);

  const handleRemoveWidget = useCallback((id: string) => {
    setLayout((prev) => removeWidget(prev, id));
  }, []);

  const handleReset = useCallback(() => {
    setLayout(createDefaultLayout());
  }, []);

  const placed = useMemo(() => placedIds(layout), [layout]);
  const available = useMemo(() => availableWidgetIds(layout), [layout]);

  const groupedAvailable = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        ids: available.filter((id) => getWidgetDefinition(id)?.category === category),
      })).filter((group) => group.ids.length > 0),
    [available]
  );

  return (
    <section className="flex flex-col gap-4" data-testid="customizable-dashboard">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon id="layoutDashboard" size={20} />
          <h2 className="text-lg font-semibold text-white">Your Dashboard</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            data-testid="reset-layout"
            className="flex items-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            <Icon id="rotateCcw" size={16} />
            Reset to Default Layout
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen((open) => !open)}
            aria-expanded={isDrawerOpen}
            data-testid="open-widget-drawer"
            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Icon id="plus" size={16} />
            Add Widget
          </button>
        </div>
      </header>

      {isDrawerOpen ? (
        <div
          data-testid="widget-drawer"
          className="rounded-lg border border-gray-800 bg-[#161b22] p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-white">Available widgets</h3>

          {groupedAvailable.length === 0 ? (
            <p className="text-sm text-gray-400" data-testid="drawer-empty">
              Every available widget is already on your dashboard.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupedAvailable.map((group) => (
                <li key={group.category} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <Icon id={CATEGORY_ICONS[group.category]} size={14} />
                    {group.label}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {group.ids.map((id) => {
                      const definition = getWidgetDefinition(id);
                      if (!definition) return null;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => handleAddWidget(id)}
                            data-testid={`add-widget-${id}`}
                            className="w-full rounded-md border border-gray-700 px-3 py-2 text-left text-sm text-gray-100 hover:border-blue-500 hover:bg-gray-800"
                          >
                            <span className="block font-medium">{definition.title}</span>
                            <span className="block text-xs text-gray-400">
                              {definition.description}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div ref={containerRef}>
        {mounted ? (
          <Responsive
            width={width}
            layouts={layout.layouts}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            rowHeight={ROW_HEIGHT}
            margin={GRID_MARGIN}
            containerPadding={GRID_CONTAINER_PADDING}
            dragConfig={{
              enabled: true,
              handle: ".widget-drag-handle",
              // The remove button lives inside the drag handle; a click on it
              // must remove the widget rather than start a drag.
              cancel: "button",
            }}
            resizeConfig={{ enabled: true }}
            onBreakpointChange={(next) => setBreakpoint(next)}
            onLayoutChange={handleLayoutChange}
          >
            {placed.map((id) => (
              <DashboardWidgetCard key={id} id={id} onRemove={handleRemoveWidget} />
            ))}
          </Responsive>
        ) : null}
      </div>

      {placed.length === 0 ? (
        <p className="text-sm text-gray-400" data-testid="empty-dashboard">
          Your dashboard is empty. Use “Add Widget” to place your first widget.
        </p>
      ) : null}
    </section>
  );
}

interface DashboardWidgetCardProps {
  id: string;
  onRemove: (id: string) => void;
}

function DashboardWidgetCard({ id, onRemove }: DashboardWidgetCardProps) {
  const definition = getWidgetDefinition(id);
  if (!definition) return null;

  return (
    <section
      data-testid={`widget-${id}`}
      aria-label={definition.title}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-800 bg-[#161b22]"
    >
      <header className="widget-drag-handle flex cursor-grab items-center justify-between gap-2 border-b border-gray-800 px-3 py-2 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <Icon id="sliders" size={14} className="shrink-0 text-gray-500" />
          <h3 className="truncate text-sm font-medium text-white">{definition.title}</h3>
        </div>

        <button
          type="button"
          onClick={() => onRemove(id)}
          aria-label={`Remove ${definition.title}`}
          data-testid={`remove-widget-${id}`}
          className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-red-400"
        >
          <Icon id="xCircle" size={16} />
        </button>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-1 p-3">
        <p className="text-sm text-gray-300">{definition.description}</p>
        <p className="text-xs text-gray-500">
          Drag the header to move · drag the corner to resize
        </p>
      </div>
    </section>
  );
}

export default CustomizableDashboard;
