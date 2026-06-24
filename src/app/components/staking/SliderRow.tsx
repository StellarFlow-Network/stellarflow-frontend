"use client";

import React from "react";
import { useThrottledSlider } from "@/app/hooks/useThrottledSlider";
import type { StakerTableRecord } from "./StakerTableRow";

interface SliderRowProps {
  node: StakerTableRecord;
  maxAllocation: number;
  /** Receives the committed value whenever the Calculation_Engine should update */
  onCommit: (nodeId: string, value: number) => void;
}

export const SliderRow = React.memo(function SliderRow({
  node,
  maxAllocation,
  onCommit,
}: SliderRowProps) {
  const { displayValue, committedValue, handleChange } = useThrottledSlider(
    0,
    node.nodeName,
  );

  // Notify parent only when committedValue changes (not on mount or every raw drag event).
  const prevCommittedRef = React.useRef<number>(committedValue);
  React.useEffect(() => {
    if (committedValue !== prevCommittedRef.current) {
      prevCommittedRef.current = committedValue;
      onCommit(node.id, committedValue);
    }
  }, [committedValue, node.id, onCommit]);

  const pct = maxAllocation > 0 ? (committedValue / maxAllocation) * 100 : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <label
          htmlFor={`slider-${node.id}`}
          className="text-gray-300 font-medium"
        >
          {node.nodeName}
        </label>
        <span className="text-gray-400 font-mono text-xs">
          {committedValue.toLocaleString()} XLM ({pct.toFixed(1)}%)
        </span>
      </div>
      <input
        id={`slider-${node.id}`}
        type="range"
        min={0}
        max={maxAllocation}
        step={100}
        value={displayValue}
        onChange={handleChange}
        aria-label={`Allocate XLM to ${node.nodeName}`}
        aria-valuenow={displayValue}
        aria-valuemin={0}
        aria-valuemax={maxAllocation}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );
});

SliderRow.displayName = "SliderRow";
