'use client';

import React, { useRef, useState } from 'react';
import { CandlestickChart } from './CandlestickChart';
import { ChartDrawingOverlay, type DrawingShape } from './ChartDrawingOverlay';
import { Settings, X } from 'lucide-react';

interface ChartWithDrawingToolsProps {
  pairId: string;
  baseSymbol: string;
  quoteSymbol: string;
  height?: number;
  fillParent?: boolean;
  showTimeframeControls?: boolean;
  timeframe?: string;
  onTimeframeChange?: (resolution: string) => void;
}

export function ChartWithDrawingTools({
  pairId,
  baseSymbol,
  quoteSymbol,
  height = 420,
  fillParent = false,
  showTimeframeControls = true,
  timeframe,
  onTimeframeChange,
}: ChartWithDrawingToolsProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawings, setDrawings] = useState<DrawingShape[]>([]);

  const handleDrawingsChange = (newDrawings: DrawingShape[]) => {
    setDrawings(newDrawings);
    // Optional: Persist to localStorage
    try {
      const storageKey = `stellarflow.chart.drawings.${pairId}`;
      localStorage.setItem(storageKey, JSON.stringify(newDrawings));
    } catch (e) {
      console.warn('Could not persist chart drawings:', e);
    }
  };

  // Load saved drawings on mount
  React.useEffect(() => {
    try {
      const storageKey = `stellarflow.chart.drawings.${pairId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDrawings(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not load saved chart drawings:', e);
    }
  }, [pairId]);

  return (
    <div className="relative">
      {/* Drawing Toggle Button */}
      <button
        type="button"
        onClick={() => setDrawingEnabled(!drawingEnabled)}
        className={`absolute top-4 right-4 z-20 p-2 rounded-lg shadow-lg transition-all ${
          drawingEnabled
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
        }`}
        title={drawingEnabled ? 'Disable drawing tools' : 'Enable drawing tools'}
      >
        {drawingEnabled ? <X size={18} /> : <Settings size={18} />}
      </button>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="relative">
        <CandlestickChart
          pairId={pairId as any}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          height={height}
          fillParent={fillParent}
          showTimeframeControls={showTimeframeControls}
          timeframe={timeframe as any}
          onTimeframeChange={onTimeframeChange as any}
        />

        {/* Drawing Overlay */}
        {drawingEnabled && (
          <ChartDrawingOverlay
            chartContainerRef={chartContainerRef}
            width={chartContainerRef.current?.clientWidth || 800}
            height={height}
            onDrawingsChange={handleDrawingsChange}
            initialDrawings={drawings}
            disabled={!drawingEnabled}
          />
        )}
      </div>
    </div>
  );
}

export default ChartWithDrawingTools;
