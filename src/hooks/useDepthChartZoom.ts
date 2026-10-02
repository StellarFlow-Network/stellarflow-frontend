"use client";

import { useEffect, useReducer, type RefObject } from "react";
import {
  DEFAULT_ZOOM_INDEX,
  DEPTH_ZOOM_LEVELS,
  DepthZoomAction,
  SPREAD_FOCUS_ZOOM_INDEX,
  WHEEL_ZOOM_DELTA_THRESHOLD,
} from "@/components/trading/CumulativeDepthChart.constants";

const MAX_ZOOM_INDEX = DEPTH_ZOOM_LEVELS.length - 1;

const clampZoomIndex = (index: number): number =>
  Math.min(Math.max(index, DEFAULT_ZOOM_INDEX), MAX_ZOOM_INDEX);

function zoomReducer(zoomIndex: number, action: DepthZoomAction): number {
  switch (action) {
    case DepthZoomAction.ZoomIn:
      return clampZoomIndex(zoomIndex + 1);
    case DepthZoomAction.ZoomOut:
      return clampZoomIndex(zoomIndex - 1);
    case DepthZoomAction.FocusSpread:
      return SPREAD_FOCUS_ZOOM_INDEX;
    case DepthZoomAction.Reset:
      return DEFAULT_ZOOM_INDEX;
    default:
      return zoomIndex;
  }
}

export interface UseDepthChartZoomReturn {
  zoomFactor: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  dispatchZoom: (action: DepthZoomAction) => void;
}

export function useDepthChartZoom(
  wheelTargetRef: RefObject<HTMLElement | null>,
): UseDepthChartZoomReturn {
  const [zoomIndex, dispatchZoom] = useReducer(zoomReducer, DEFAULT_ZOOM_INDEX);

  useEffect(() => {
    const node = wheelTargetRef.current;
    if (!node) return;

    let accumulatedDelta = 0;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      accumulatedDelta += event.deltaY;

      if (Math.abs(accumulatedDelta) < WHEEL_ZOOM_DELTA_THRESHOLD) return;

      dispatchZoom(accumulatedDelta < 0 ? DepthZoomAction.ZoomIn : DepthZoomAction.ZoomOut);
      accumulatedDelta = 0;
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [wheelTargetRef]);

  return {
    zoomFactor: DEPTH_ZOOM_LEVELS[zoomIndex],
    canZoomIn: zoomIndex < MAX_ZOOM_INDEX,
    canZoomOut: zoomIndex > DEFAULT_ZOOM_INDEX,
    dispatchZoom,
  };
}
