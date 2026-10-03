export interface DashboardWidget {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultOrder: number;
  visible: boolean;
  category: "analytics" | "trading" | "network" | "utility";
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  order: string[];
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: "rate-cards",
    title: "FX Rate Cards",
    component: null,
    defaultOrder: 1,
    visible: true,
    category: "analytics",
  },
  {
    id: "price-feed",
    title: "Price Feed",
    component: null,
    defaultOrder: 2,
    visible: true,
    category: "trading",
  },
  {
    id: "order-book",
    title: "Order Book",
    component: null,
    defaultOrder: 3,
    visible: true,
    category: "trading",
  },
  {
    id: "rpc-health",
    title: "RPC Health",
    component: null,
    defaultOrder: 4,
    visible: true,
    category: "network",
  },
  {
    id: "network-map",
    title: "Network Map",
    component: null,
    defaultOrder: 5,
    visible: true,
    category: "network",
  },
  {
    id: "traffic-chart",
    title: "Traffic Chart",
    component: null,
    defaultOrder: 6,
    visible: true,
    category: "analytics",
  },
];

export const STORAGE_KEY = "stellarflow-dashboard-layout";

export function getStoredLayout(): DashboardLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function saveLayout(layout: DashboardLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function resetToDefaultLayout(): DashboardLayout {
  return {
    widgets: DEFAULT_WIDGETS,
    order: DEFAULT_WIDGETS.map((w) => w.id),
  };
}