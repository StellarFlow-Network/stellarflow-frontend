import { expect, test, type Page } from "@playwright/test";

/**
 * Customizable dashboard grid (Issue #936).
 *
 * These cover the two acceptance criteria that only a real browser can show:
 *   1. widgets drag and snap to grid positions on desktop viewports
 *   2. the layout state persists across page navigations
 *
 * The pure layout logic is covered by `tests/ui/customizableDashboard.test.ts`;
 * this spec only asserts the DOM behaviour that depends on a real layout engine.
 */

const DASHBOARD = "/dashboard/widgets";
const STORAGE_KEY = "stellarflow-dashboard-grid-layout:v1";

/** Bounding box of a placed widget, in CSS pixels. */
async function boxOf(page: Page, widgetId: string) {
  const locator = page.getByTestId(`widget-${widgetId}`);
  await expect(locator).toBeVisible();
  return locator.boundingBox();
}

/** Read the persisted layout for the widest (reference) breakpoint. */
function readStoredLayout(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

function storedItem(layout: { layouts: Record<string, { i: string }[]> }, id: string) {
  return layout?.layouts?.lg?.find((item) => item.i === id);
}

test.describe("Customizable dashboard grid", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.getByTestId("customizable-dashboard")).toBeVisible();
    // The grid renders only after the container has been measured.
    await expect(page.locator(".react-grid-layout")).toBeVisible();
  });

  test("renders the default widgets on the desktop grid", async ({ page }) => {
    await expect(page.getByTestId("widget-analytics-volume")).toBeVisible();
    await expect(page.getByTestId("widget-analytics-fee-market")).toBeVisible();
    await expect(page.getByTestId("widget-portfolio-balance")).toBeVisible();
  });

  test("snaps a dragged widget to grid positions", async ({ page }) => {
    const before = await boxOf(page, "analytics-volume");

    const handle = page.locator('[data-testid="widget-analytics-volume"] .widget-drag-handle');
    await handle.hover();
    await page.mouse.down();
    // Move well past the drag threshold and past several column widths.
    await page.mouse.move(before!.x + 520, before!.y + 340, { steps: 20 });
    await page.mouse.up();

    await expect
      .poll(async () => storedItem(await readStoredLayout(page), "analytics-volume")?.x)
      .not.toBe(0);

    // The stored position must be a whole number of grid columns and the widget
    // must actually have moved on screen.
    const item = storedItem(await readStoredLayout(page), "analytics-volume")!;
    expect(Number.isInteger(item.x)).toBe(true);
    expect(Number.isInteger(item.y)).toBe(true);

    const after = await boxOf(page, "analytics-volume");
    expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(50);
  });

  test("persists the layout across a page navigation", async ({ page }) => {
    const before = await boxOf(page, "analytics-asset-mix");

    const handle = page.locator('[data-testid="widget-analytics-asset-mix"] .widget-drag-handle');
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(before!.x + 400, before!.y + 260, { steps: 20 });
    await page.mouse.up();

    await expect
      .poll(async () => storedItem(await readStoredLayout(page), "analytics-asset-mix")?.y)
      .not.toBe(0);

    // Navigate away and back: the saved layout must be restored.
    await page.goto("/dashboard/portfolio");
    await page.goto(DASHBOARD);
    await expect(page.locator(".react-grid-layout")).toBeVisible();

    const after = await boxOf(page, "analytics-asset-mix");
    const restored = await boxOf(page, "analytics-volume");
    const fresh = await page.evaluate(() => {
      const raw = window.localStorage.getItem("stellarflow-dashboard-grid-layout:v1");
      const layout = raw ? JSON.parse(raw) : null;
      return layout?.layouts?.lg?.find((item: { i: string }) => item.i === "analytics-asset-mix");
    });
    expect(restored?.y).toBeGreaterThan(after!.y);
    expect(Number.isInteger(restored?.x)).toBe(true);
    expect(Number.isInteger(fresh?.y)).toBe(true);
  });

  test("restores a saved layout after a full reload", async ({ page }) => {
    const before = await boxOf(page, "portfolio-balance");

    const handle = page.locator('[data-testid="widget-portfolio-balance"] .widget-drag-handle');
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(before!.x + 300, before!.y + 420, { steps: 20 });
    await page.mouse.up();

    await expect
      .poll(async () => storedItem(await readStoredLayout(page), "portfolio-balance")?.y)
      .not.toBe(4);

    await page.reload();
    await expect(page.locator(".react-grid-layout")).toBeVisible();

    const after = await boxOf(page, "portfolio-balance");
    const stored = storedItem(await readStoredLayout(page), "portfolio-balance")!;
    expect(Number.isInteger(stored.y)).toBe(true);
    expect(after!.y).toBeGreaterThan(before!.y);
  });

  test("adds a widget from the drawer and persists it", async ({ page }) => {
    await expect(page.getByTestId("widget-bookmarks-watchlist")).toHaveCount(0);

    await page.getByTestId("open-widget-drawer").click();
    await expect(page.getByTestId("widget-drawer")).toBeVisible();
    await page.getByTestId("add-widget-bookmarks-watchlist").click();

    await expect(page.getByTestId("widget-bookmarks-watchlist")).toBeVisible();
    await expect
      .poll(async () => Boolean(storedItem(await readStoredLayout(page), "bookmarks-watchlist")))
      .toBe(true);

    // It must stay added after a reload.
    await page.reload();
    await expect(page.locator(".react-grid-layout")).toBeVisible();
    await expect(page.getByTestId("widget-bookmarks-watchlist")).toBeVisible();
  });

  test("groups the drawer by Charts, Bookmarks and Portfolio", async ({ page }) => {
    await page.getByTestId("open-widget-drawer").click();
    const drawer = page.getByTestId("widget-drawer");
    await expect(drawer).toContainText("Charts");
    await expect(drawer).toContainText("Bookmarks");
    await expect(drawer).toContainText("Portfolio");
  });

  test("removes a widget and persists the removal", async ({ page }) => {
    await expect(page.getByTestId("widget-analytics-fee-market")).toBeVisible();
    await page.getByTestId("remove-widget-analytics-fee-market").click();
    await expect(page.getByTestId("widget-analytics-fee-market")).toHaveCount(0);

    await expect
      .poll(async () => storedItem(await readStoredLayout(page), "analytics-fee-market"))
      .toBeUndefined();

    await page.reload();
    await expect(page.locator(".react-grid-layout")).toBeVisible();
    await expect(page.getByTestId("widget-analytics-fee-market")).toHaveCount(0);
  });

  test("restores the default layout with the reset action", async ({ page }) => {
    const defaultBox = await boxOf(page, "analytics-asset-mix");

    await page.getByTestId("open-widget-drawer").click();
    await page.getByTestId("add-widget-bookmarks-watchlist").click();
    await expect(page.getByTestId("widget-bookmarks-watchlist")).toBeVisible();

    const handle = page.locator('[data-testid="widget-analytics-asset-mix"] .widget-drag-handle');
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(defaultBox!.x + 380, defaultBox!.y + 300, { steps: 20 });
    await page.mouse.up();

    await page.getByTestId("reset-layout").click();

    // The added widget is gone and the moved widget is back where it started.
    await expect(page.getByTestId("widget-bookmarks-watchlist")).toHaveCount(0);
    const resetBox = await boxOf(page, "analytics-asset-mix");
    expect(Math.abs(resetBox!.x - defaultBox!.x)).toBeLessThan(2);
    expect(Math.abs(resetBox!.y - defaultBox!.y)).toBeLessThan(2);
  });

  test("falls back to the default layout for a corrupt saved layout", async ({ page }) => {
    await page.evaluate((key) => {
      window.localStorage.setItem(key, "{ this is not json");
    }, STORAGE_KEY);
    await page.reload();

    await expect(page.locator(".react-grid-layout")).toBeVisible();
    await expect(page.getByTestId("widget-analytics-volume")).toBeVisible();
  });

  test("ignores a saved layout written by a future schema version", async ({ page }) => {
    await page.evaluate((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ version: 99, layouts: { lg: [{ i: "analytics-volume", x: 99, y: 99, w: 6, h: 4 }] } })
      );
    }, STORAGE_KEY);
    await page.reload();

    await expect(page.locator(".react-grid-layout")).toBeVisible();
    const item = storedItem(await readStoredLayout(page), "analytics-volume")!;
    expect(item.x).toBeLessThan(12);
  });
});
