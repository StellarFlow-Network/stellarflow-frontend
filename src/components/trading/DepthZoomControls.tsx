import { memo } from "react";
import { DEPTH_ZOOM_CONTROLS, DepthZoomAction } from "./CumulativeDepthChart.constants";

interface DepthZoomControlsProps {
  zoomFactor: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onAction: (action: DepthZoomAction) => void;
}

function DepthZoomControls({ zoomFactor, canZoomIn, canZoomOut, onAction }: DepthZoomControlsProps) {
  const disabledByAction: Record<DepthZoomAction, boolean> = {
    [DepthZoomAction.ZoomIn]: !canZoomIn,
    [DepthZoomAction.ZoomOut]: !canZoomOut,
    [DepthZoomAction.FocusSpread]: !canZoomIn,
    [DepthZoomAction.Reset]: !canZoomOut,
  };

  return (
    <div className="flex items-center gap-1.5" role="toolbar" aria-label="Depth chart zoom">
      <span className="mr-1 font-mono text-[10px] text-gray-500" aria-live="polite">
        {zoomFactor}×
      </span>
      {DEPTH_ZOOM_CONTROLS.map(({ action, label, ariaLabel }) => (
        <button
          key={action}
          type="button"
          onClick={() => onAction(action)}
          disabled={disabledByAction[action]}
          aria-label={ariaLabel}
          className="rounded-md border border-[#1B2A3B] bg-[#0D1726] px-2 py-0.5 text-[10px] font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default memo(DepthZoomControls);
