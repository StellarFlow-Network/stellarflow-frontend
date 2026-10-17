'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Line,
  Minus,
  Square,
  Activity,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Undo,
  X,
  GripVertical,
} from 'lucide-react';

export type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'rectangle' | 'fibonacci';

export interface DrawingPoint {
  x: number;
  y: number;
  timestamp?: number;
  price?: number;
}

export interface DrawingShape {
  id: string;
  type: DrawingTool;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  visible: boolean;
  createdAt: number;
}

export interface ChartDrawingOverlayProps {
  chartContainerRef: React.RefObject<HTMLDivElement>;
  chartApi?: any;
  width?: number;
  height?: number;
  onDrawingsChange?: (drawings: DrawingShape[]) => void;
  initialDrawings?: DrawingShape[];
  disabled?: boolean;
}

const DRAWING_TOOLS = [
  { id: 'trendline' as const, label: 'Trendline', icon: Line, description: 'Draw angled trend lines' },
  { id: 'horizontal' as const, label: 'Horizontal', icon: Minus, description: 'Draw horizontal price levels' },
  { id: 'rectangle' as const, label: 'Rectangle', icon: Square, description: 'Draw rectangular zones' },
  { id: 'fibonacci' as const, label: 'Fibonacci', icon: Activity, description: 'Draw Fibonacci retracements' },
];

const DRAWING_COLORS = [
  '#EF4444', // Red
  '#10B981', // Green
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#FFFFFF', // White
];

const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ChartDrawingOverlay({
  chartContainerRef,
  chartApi,
  width = 800,
  height = 420,
  onDrawingsChange,
  initialDrawings = [],
  disabled = false,
}: ChartDrawingOverlayProps) {
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [selectedColor, setSelectedColor] = useState(DRAWING_COLORS[3]);
  const [lineWidth, setLineWidth] = useState(2);
  const [drawings, setDrawings] = useState<DrawingShape[]>(initialDrawings);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<DrawingPoint[]>([]);
  const [showToolbar, setShowToolbar] = useState(true);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [history, setHistory] = useState<DrawingShape[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseDownRef = useRef(false);

  // Save history for undo
  const saveToHistory = useCallback((newDrawings: DrawingShape[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newDrawings);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Update drawings and notify parent
  const updateDrawings = useCallback((newDrawings: DrawingShape[]) => {
    setDrawings(newDrawings);
    onDrawingsChange?.(newDrawings);
  }, [onDrawingsChange]);

  // Undo action
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      updateDrawings(previousState);
    }
  }, [history, historyIndex, updateDrawings]);

  // Clear all drawings
  const handleClearAll = useCallback(() => {
    saveToHistory([]);
    updateDrawings([]);
    setSelectedDrawingId(null);
  }, [saveToHistory, updateDrawings]);

  // Toggle drawing visibility
  const toggleDrawingVisibility = useCallback((id: string) => {
    const newDrawings = drawings.map((d) =>
      d.id === id ? { ...d, visible: !d.visible } : d
    );
    saveToHistory(newDrawings);
    updateDrawings(newDrawings);
  }, [drawings, saveToHistory, updateDrawings]);

  // Delete specific drawing
  const deleteDrawing = useCallback((id: string) => {
    const newDrawings = drawings.filter((d) => d.id !== id);
    saveToHistory(newDrawings);
    updateDrawings(newDrawings);
    if (selectedDrawingId === id) {
      setSelectedDrawingId(null);
    }
  }, [drawings, saveToHistory, updateDrawings, selectedDrawingId]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Initial render
    renderCanvas();
  }, [width, height]);

  // Render drawings on canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render all saved drawings
    drawings.forEach((drawing) => {
      if (!drawing.visible) return;
      renderShape(ctx, drawing);
    });

    // Render current drawing in progress
    if (isDrawing && currentPoints.length > 0) {
      const tempDrawing: DrawingShape = {
        id: 'temp',
        type: activeTool,
        points: currentPoints,
        color: selectedColor,
        lineWidth,
        visible: true,
        createdAt: Date.now(),
      };
      renderShape(ctx, tempDrawing);
    }
  }, [drawings, isDrawing, currentPoints, activeTool, selectedColor, lineWidth]);

  // Render individual shape
  const renderShape = useCallback((ctx: CanvasRenderingContext2D, shape: DrawingShape) => {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { points, type } = shape;

    if (type === 'trendline' && points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();

      // Draw endpoints
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = shape.color;
        ctx.fill();
      });
    } else if (type === 'horizontal' && points.length >= 2) {
      const y = points[0].y;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ctx.canvas.width, y);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = shape.color;
      ctx.font = '11px monospace';
      ctx.fillText(`Price: ${points[0].price?.toFixed(4) || 'N/A'}`, 10, y - 8);
    } else if (type === 'rectangle' && points.length >= 2) {
      const x = Math.min(points[0].x, points[1].x);
      const y = Math.min(points[0].y, points[1].y);
      const w = Math.abs(points[1].x - points[0].x);
      const h = Math.abs(points[1].y - points[0].y);

      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      ctx.strokeRect(x, y, w, h);

      // Semi-transparent fill
      ctx.fillStyle = shape.color + '20';
      ctx.fillRect(x, y, w, h);
    } else if (type === 'fibonacci' && points.length >= 2) {
      const startY = points[0].y;
      const endY = points[1].y;
      const range = endY - startY;
      const x = points[0].x;
      const width = points[1].x - points[0].x;

      FIBONACCI_LEVELS.forEach((level, index) => {
        const y = startY + range * level;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.stroke();

        // Draw level label
        ctx.fillStyle = shape.color;
        ctx.font = '10px monospace';
        ctx.fillText(`${(level * 100).toFixed(1)}%`, x + 5, y - 3);
      });
    }
  }, []);

  // Re-render when drawings change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle mouse events for drawing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled || activeTool === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseDownRef.current = true;
    setIsDrawing(true);

    if (activeTool === 'horizontal') {
      // Horizontal line needs two clicks: one for y position, one for width
      if (currentPoints.length === 0) {
        setCurrentPoints([{ x, y }]);
      } else {
        // Complete the horizontal line
        const newDrawing: DrawingShape = {
          id: generateId(),
          type: activeTool,
          points: [
            { x: 0, y: currentPoints[0].y },
            { x: canvas.width, y: currentPoints[0].y },
          ],
          color: selectedColor,
          lineWidth,
          visible: true,
          createdAt: Date.now(),
        };
        saveToHistory([...drawings, newDrawing]);
        updateDrawings([...drawings, newDrawing]);
        setCurrentPoints([]);
        setIsDrawing(false);
      }
    } else {
      setCurrentPoints([{ x, y }]);
    }
  }, [disabled, activeTool, currentPoints, selectedColor, lineWidth, drawings, saveToHistory, updateDrawings]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'trendline' || activeTool === 'rectangle' || activeTool === 'fibonacci') {
      setCurrentPoints([currentPoints[0], { x, y }]);
    }

    renderCanvas();
  }, [isDrawing, disabled, activeTool, currentPoints, renderCanvas]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    mouseDownRef.current = false;

    if (activeTool === 'horizontal') {
      // Horizontal line completion handled in mouseDown
      return;
    }

    if (currentPoints.length >= 2) {
      const newDrawing: DrawingShape = {
        id: generateId(),
        type: activeTool,
        points: currentPoints,
        color: selectedColor,
        lineWidth,
        visible: true,
        createdAt: Date.now(),
      };
      saveToHistory([...drawings, newDrawing]);
      updateDrawings([...drawings, newDrawing]);
    }

    setCurrentPoints([]);
    setIsDrawing(false);
  }, [isDrawing, disabled, activeTool, currentPoints, selectedColor, lineWidth, drawings, saveToHistory, updateDrawings]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('none');
        setCurrentPoints([]);
        setIsDrawing(false);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          deleteDrawing(selectedDrawingId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, selectedDrawingId, deleteDrawing]);

  if (disabled) return null;

  return (
    <div className="relative">
      {/* Drawing Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
        style={{ width, height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Drawing Toolbar */}
      {showToolbar && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl p-2 space-y-3">
            {/* Tool Selection */}
            <div className="space-y-1">
              <div className="text-xs text-gray-400 px-2 py-1 font-medium">Drawing Tools</div>
              <div className="grid grid-cols-2 gap-1">
                {DRAWING_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        setActiveTool(tool.id);
                        setSelectedDrawingId(null);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        activeTool === tool.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      title={tool.description}
                    >
                      <Icon size={14} />
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-1">
              <div className="text-xs text-gray-400 px-2 py-1 font-medium">Color</div>
              <div className="flex flex-wrap gap-1 px-2">
                {DRAWING_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-md border-2 transition-all ${
                      selectedColor === color
                        ? 'border-white scale-110'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div className="space-y-1">
              <div className="text-xs text-gray-400 px-2 py-1 font-medium">Line Width</div>
              <div className="flex items-center gap-2 px-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-300 w-6">{lineWidth}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-1 pt-2 border-t border-gray-700">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Undo size={14} />
                Undo
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={drawings.length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawings List Panel */}
      {drawings.length > 0 && (
        <div className="absolute top-4 right-4 z-10 max-w-xs">
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">Drawings ({drawings.length})</div>
              <button
                type="button"
                onClick={() => setShowToolbar(!showToolbar)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title="Toggle toolbar"
              >
                <GripVertical size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {drawings.map((drawing) => {
                const tool = DRAWING_TOOLS.find((t) => t.id === drawing.type);
                const Icon = tool?.icon || Line;
                return (
                  <div
                    key={drawing.id}
                    className={`flex items-center gap-2 p-2 rounded-md text-xs transition-all ${
                      selectedDrawingId === drawing.id
                        ? 'bg-blue-600/20 border border-blue-500/30'
                        : 'bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDrawingId(drawing.id)}
                      className="flex items-center gap-2 flex-1"
                    >
                      <Icon size={14} style={{ color: drawing.color }} />
                      <span className="text-gray-300">{tool?.label || drawing.type}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDrawingVisibility(drawing.id)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title={drawing.visible ? 'Hide' : 'Show'}
                    >
                      {drawing.visible ? (
                        <Eye size={12} className="text-gray-400" />
                      ) : (
                        <EyeOff size={12} className="text-gray-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDrawing(drawing.id)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active Tool Indicator */}
      {activeTool !== 'none' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-blue-600/95 backdrop-blur-sm border border-blue-500 rounded-full shadow-xl px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-medium text-white">
              {DRAWING_TOOLS.find((t) => t.id === activeTool)?.label || 'Drawing'} Active
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveTool('none');
                setCurrentPoints([]);
                setIsDrawing(false);
              }}
              className="p-1 hover:bg-blue-700 rounded-full transition-colors"
              title="Cancel drawing (Esc)"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      {activeTool === 'none' && drawings.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl px-4 py-2">
            <span className="text-xs text-gray-400">
              Click a drawing tool to start. Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">Esc</kbd> to cancel
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChartDrawingOverlay;
