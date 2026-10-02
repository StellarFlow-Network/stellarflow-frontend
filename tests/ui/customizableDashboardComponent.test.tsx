import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VISIBLE_WIDGET_IDS, getWidgetDefinition } from "@/components/dashboard/layout/catalog";
import { DASHBOARD_LAYOUT_STORAGE_KEY } from "@/components/dashboard/layout/storage";

/**
 * Component tests for the customizable dashboard (Issue #936).
 *
 * `react-grid-layout` is stubbed because its geometry needs a real, measured
 * container: jsdom reports every element as 0x0, so the real engine cannot
 * compute a position to drag or snap to. The stub renders the children and
 * exposes the props so a test can play the part of the layout engine and call
 * `onLayoutChange` the same way a drag would.
 *
 * Everything below the grid — the catalog, the state transitions, the clamping
 * rules and localStorage — is the real implementation, and the layout arithmetic
 * itself is covered directly in `customizableDashboard.test.ts`.
 */
const grid = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock("react-grid-layout", () => ({
  useContainerWidth: () => ({
    width: 1280,
    containerRef: { current: null },
    mounted: true,
  }),
  Responsive: (props: Record<string, any>) => {
    grid.props = props;
    return (
      <div className="react-grid-layout" data-testid="grid">
        <button
          type="button"
          data-testid="simulate-drag"
          onClick={() => {
            const layouts = props.layouts as Record<string, { i: string; x: number; y: number }[]>;
            const moved = layouts.lg.map((item, index) =>
              index === 0 ? { ...item, x: item.x + 3, y: item.y + 2 } : item
            );
            props.onLayoutChange(moved);
          }}
        />
        {props.children}
      </div>
    );
  },
}));

const { CustomizableDashboard } = await import("@/components/dashboard/CustomizableDashboard");

function storedLayout() {
  const raw = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function storedIds() {
  return (storedLayout()?.layouts?.lg ?? []).map((item: { i: string }) => item.i);
}

beforeEach(() => {
  window.localStorage.clear();
  grid.props = null;
});

describe("CustomizableDashboard", () => {
  it("renders every widget that ships visible by default", async () => {
    render(<CustomizableDashboard />);

    for (const id of DEFAULT_VISIBLE_WIDGET_IDS) {
      expect(await screen.findByTestId(`widget-${id}`)).toBeInTheDocument();
    }
  });

  it("does not render widgets that are hidden by default", () => {
    render(<CustomizableDashboard />);
    expect(screen.queryByTestId("widget-bookmarks-watchlist")).not.toBeInTheDocument();
  });

  it("keeps the drawer closed until it is asked for", () => {
    render(<CustomizableDashboard />);
    expect(screen.queryByTestId("widget-drawer")).not.toBeInTheDocument();
    expect(screen.getByTestId("open-widget-drawer")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes the drawer", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);

    await user.click(screen.getByTestId("open-widget-drawer"));
    expect(screen.getByTestId("widget-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("open-widget-drawer")).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByTestId("open-widget-drawer"));
    expect(screen.queryByTestId("widget-drawer")).not.toBeInTheDocument();
  });

  it("groups the drawer by category and omits groups with nothing to add", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);
    await user.click(screen.getByTestId("open-widget-drawer"));

    const drawer = screen.getByTestId("widget-drawer");
    // Charts and Bookmarks still have widgets that are not on the grid.
    expect(drawer).toHaveTextContent("Charts");
    expect(drawer).toHaveTextContent("Bookmarks");
    expect(within(drawer).getByTestId("add-widget-analytics-payment-success")).toBeInTheDocument();
    expect(within(drawer).getByTestId("add-widget-bookmarks-watchlist")).toBeInTheDocument();

    // Every portfolio widget ships on the default layout, so the group is
    // hidden rather than rendered empty.
    expect(drawer).not.toHaveTextContent("Portfolio");
  });

  it("adds a widget from the drawer", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);
    await user.click(screen.getByTestId("open-widget-drawer"));
    await user.click(screen.getByTestId("add-widget-bookmarks-watchlist"));

    expect(screen.getByTestId("widget-bookmarks-watchlist")).toBeInTheDocument();
    await waitFor(() => expect(storedIds()).toContain("bookmarks-watchlist"));
  });

  it("removes a widget and forgets it on save", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);

    const target = DEFAULT_VISIBLE_WIDGET_IDS[0];
    await user.click(screen.getByTestId(`remove-widget-${target}`));

    expect(screen.queryByTestId(`widget-${target}`)).not.toBeInTheDocument();
    await waitFor(() => expect(storedIds()).not.toContain(target));
  });

  it("gives the remove button an accessible name", () => {
    render(<CustomizableDashboard />);
    const target = DEFAULT_VISIBLE_WIDGET_IDS[0];
    const title = getWidgetDefinition(target)!.title;
    expect(screen.getByRole("button", { name: `Remove ${title}` })).toBeInTheDocument();
  });

  it("removes a widget even though the remove button sits in the drag handle", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);

    const target = DEFAULT_VISIBLE_WIDGET_IDS[0];
    const handle = screen.getByTestId(`widget-${target}`).querySelector(".widget-drag-handle")!;
    expect(handle).toContainElement(screen.getByTestId(`remove-widget-${target}`));

    await user.click(screen.getByTestId(`remove-widget-${target}`));
    expect(screen.queryByTestId(`widget-${target}`)).not.toBeInTheDocument();
  });

  it("saves a layout reported by the grid after a drag", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    await user.click(screen.getByTestId("simulate-drag"));

    await waitFor(() => {
      const item = storedLayout()?.layouts?.lg?.find(
        (it: { i: string }) => it.i === DEFAULT_VISIBLE_WIDGET_IDS[0]
      );
      expect(item.x).toBe(3);
      expect(item.y).toBe(2);
    });
  });

  it("persists the layout across a remount", async () => {
    const user = userEvent.setup();
    const first = render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    await user.click(screen.getByTestId("open-widget-drawer"));
    await user.click(screen.getByTestId("add-widget-bookmarks-contracts"));
    await waitFor(() => expect(storedIds()).toContain("bookmarks-contracts"));

    // Unmount and mount again, as a navigation to another page and back would.
    first.unmount();
    render(<CustomizableDashboard />);

    expect(await screen.findByTestId("widget-bookmarks-contracts")).toBeInTheDocument();
  });

  it("restores a dragged layout after a remount", async () => {
    const user = userEvent.setup();
    const first = render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    await user.click(screen.getByTestId("simulate-drag"));
    await waitFor(() =>
      expect(
        storedLayout()?.layouts?.lg?.find(
          (it: { i: string }) => it.i === DEFAULT_VISIBLE_WIDGET_IDS[0]
        )?.x
      ).toBe(3)
    );

    first.unmount();
    render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    const layouts = grid.props?.layouts as Record<string, { i: string; x: number }[]>;
    expect(layouts.lg.find((it) => it.i === DEFAULT_VISIBLE_WIDGET_IDS[0])?.x).toBe(3);
  });

  it("does not overwrite a saved layout before it has been loaded", async () => {
    const user = userEvent.setup();
    const first = render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);
    await user.click(screen.getByTestId("open-widget-drawer"));
    await user.click(screen.getByTestId("add-widget-bookmarks-contracts"));
    await waitFor(() => expect(storedIds()).toContain("bookmarks-contracts"));

    const saved = storedLayout();
    first.unmount();
    render(<CustomizableDashboard />);
    await screen.findByTestId("widget-bookmarks-contracts");

    // The stored payload is still the one we saved, not a clobbered default.
    expect(storedLayout()).toEqual(saved);
  });

  it("resets to the default layout", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    await user.click(screen.getByTestId("open-widget-drawer"));
    await user.click(screen.getByTestId("add-widget-bookmarks-watchlist"));
    expect(screen.getByTestId("widget-bookmarks-watchlist")).toBeInTheDocument();

    await user.click(screen.getByTestId("simulate-drag"));
    await user.click(screen.getByTestId("reset-layout"));

    expect(screen.queryByTestId("widget-bookmarks-watchlist")).not.toBeInTheDocument();
    for (const id of DEFAULT_VISIBLE_WIDGET_IDS) {
      expect(screen.getByTestId(`widget-${id}`)).toBeInTheDocument();
    }

    await waitFor(() => expect(storedIds()).toEqual([...DEFAULT_VISIBLE_WIDGET_IDS]));
  });

  it("falls back to the default layout when storage holds invalid JSON", async () => {
    window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, "{ not json");
    render(<CustomizableDashboard />);

    for (const id of DEFAULT_VISIBLE_WIDGET_IDS) {
      expect(await screen.findByTestId(`widget-${id}`)).toBeInTheDocument();
    }
  });

  it("falls back to the default layout for a foreign schema version", async () => {
    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify({ version: 42, layouts: { lg: [] } })
    );
    render(<CustomizableDashboard />);

    for (const id of DEFAULT_VISIBLE_WIDGET_IDS) {
      expect(await screen.findByTestId(`widget-${id}`)).toBeInTheDocument();
    }
  });

  it("shows the empty state when every widget has been removed", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    for (const id of DEFAULT_VISIBLE_WIDGET_IDS) {
      await user.click(screen.getByTestId(`remove-widget-${id}`));
    }

    expect(screen.getByTestId("empty-dashboard")).toBeInTheDocument();
  });

  it("reports the drawer as empty once everything is placed", async () => {
    const user = userEvent.setup();
    render(<CustomizableDashboard />);
    await screen.findByTestId(`widget-${DEFAULT_VISIBLE_WIDGET_IDS[0]}`);

    // The button toggles, so the drawer is opened once and each widget added
    // from it in turn.
    await user.click(screen.getByTestId("open-widget-drawer"));
    for (const id of ["bookmarks-watchlist", "bookmarks-contracts", "analytics-payment-success"]) {
      await user.click(screen.getByTestId(`add-widget-${id}`));
    }

    expect(
      within(screen.getByTestId("widget-drawer")).getByTestId("drawer-empty")
    ).toBeInTheDocument();
  });
});
