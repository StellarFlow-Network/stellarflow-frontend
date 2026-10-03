/**
 * Catalog of widgets the user can place on the dashboard grid (Issue #936).
 *
 * `DEFAULT_VISIBLE_WIDGET_IDS` defines what "Reset to Default Layout" restores.
 */

import type { DashboardWidgetDefinition, WidgetCategory } from "./types";

export const WIDGET_CATALOG: readonly DashboardWidgetDefinition[] = [
  {
    id: "analytics-volume",
    title: "Transaction Volume",
    description: "Daily payment volume across the network, with a 7-day trend.",
    category: "analytics",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 2 },
    defaultVisible: true,
  },
  {
    id: "analytics-fee-market",
    title: "Fee Market",
    description: "Current base fee percentile alongside recent inclusion times.",
    category: "analytics",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 2 },
    defaultVisible: true,
  },
  {
    id: "analytics-asset-mix",
    title: "Asset Mix",
    description: "Share of payment volume by asset, top 8 assets.",
    category: "analytics",
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 2, h: 3 },
    defaultVisible: true,
  },
  {
    id: "analytics-payment-success",
    title: "Payment Success Rate",
    description: "Ratio of successful to failed payments over the last 24 hours.",
    category: "analytics",
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 2, h: 3 },
    defaultVisible: false,
  },
  {
    id: "bookmarks-watchlist",
    title: "Watchlist",
    description: "Bookmarked assets with live price and 24h change.",
    category: "bookmarks",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    defaultVisible: false,
  },
  {
    id: "bookmarks-contracts",
    title: "Bookmarked Contracts",
    description: "Contracts you follow, with last-call block and status.",
    category: "bookmarks",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    defaultVisible: false,
  },
  {
    id: "portfolio-balance",
    title: "Portfolio Balance",
    description: "Aggregate fiat value of held assets, split by account.",
    category: "portfolio",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 2 },
    defaultVisible: true,
  },
  {
    id: "portfolio-allocations",
    title: "Portfolio Allocation",
    description: "Allocation by asset and by counterparty concentration.",
    category: "portfolio",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 2 },
    defaultVisible: true,
  },
] as const;

/** Ordered category labels for the "Add Widget" drawer. */
export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  analytics: "Charts",
  bookmarks: "Bookmarks",
  portfolio: "Portfolio",
};

/** Widget ids visible in the default layout, in default order. */
export const DEFAULT_VISIBLE_WIDGET_IDS: readonly string[] = WIDGET_CATALOG.filter(
  (w) => w.defaultVisible
).map((w) => w.id);

/** Look up a widget definition by id. */
export function getWidgetDefinition(id: string): DashboardWidgetDefinition | undefined {
  return WIDGET_CATALOG.find((w) => w.id === id);
}

/** All catalog ids, in catalog order. */
export const ALL_WIDGET_IDS: readonly string[] = WIDGET_CATALOG.map((w) => w.id);
