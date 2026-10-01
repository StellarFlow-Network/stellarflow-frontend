export enum DepthSide {
  Bid = "bid",
  Ask = "ask",
}

export enum DepthSeriesKey {
  Bid = "bidDepth",
  Ask = "askDepth",
}

export enum DepthZoomAction {
  ZoomIn = "zoom-in",
  ZoomOut = "zoom-out",
  Reset = "reset",
  FocusSpread = "focus-spread",
}

export const CONNECTION_STATUS_LABELS = {
  live: "LIVE",
  offline: "OFF",
} as const;

export const DEPTH_ZOOM_LEVELS = [1, 2, 4, 8, 16, 32] as const;

export const DEFAULT_ZOOM_INDEX = 0;

export const SPREAD_FOCUS_ZOOM_INDEX = DEPTH_ZOOM_LEVELS.length - 1;

export const SPREAD_VISIBILITY_MULTIPLIER = 1.5;

export const WHEEL_ZOOM_DELTA_THRESHOLD = 50;

export const Y_AXIS_HEADROOM_RATIO = 1.1;

export const DEFAULT_DEPTH_CHART_HEIGHT = 280;

export const DEFAULT_DEPTH_LEVELS = 25;

export const RESIZE_DEBOUNCE_MS = 50;

export const PRICE_AXIS_TICK_COUNT = 6;

export const DEPTH_AXIS_WIDTH = 56;

export const DEPTH_CHART_MARGIN = { top: 16, right: 12, bottom: 4, left: 0 } as const;

export const DEPTH_CHART_COLORS = {
  [DepthSide.Bid]: { stroke: "#34d399", fill: "rgba(52, 211, 153, 0.18)" },
  [DepthSide.Ask]: { stroke: "#f87171", fill: "rgba(248, 113, 113, 0.18)" },
  midPrice: "#e5e7eb",
  spread: "rgba(251, 191, 36, 0.14)",
  spreadStroke: "rgba(251, 191, 36, 0.45)",
  grid: "#1f2937",
  axis: "#6b7280",
} as const;

export const DEPTH_SERIES = [
  { side: DepthSide.Bid, dataKey: DepthSeriesKey.Bid, curve: "stepBefore", label: "Bids" },
  { side: DepthSide.Ask, dataKey: DepthSeriesKey.Ask, curve: "stepAfter", label: "Asks" },
] as const;

export const DEPTH_ZOOM_CONTROLS = [
  { action: DepthZoomAction.ZoomOut, label: "−", ariaLabel: "Zoom out" },
  { action: DepthZoomAction.ZoomIn, label: "+", ariaLabel: "Zoom in" },
  { action: DepthZoomAction.FocusSpread, label: "Spread", ariaLabel: "Focus on spread" },
  { action: DepthZoomAction.Reset, label: "Reset", ariaLabel: "Reset zoom" },
] as const;
