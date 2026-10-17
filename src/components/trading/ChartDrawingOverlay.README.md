# Chart Drawing Overlay Component

A technical chart drawing tool overlay that provides interactive drawing capabilities for trading charts. Built with React and Canvas API, designed to work seamlessly with the existing lightweight-charts implementation.

## Features

- **Multiple Drawing Tools**:
  - **Trendline**: Draw angled trend lines to identify support/resistance
  - **Horizontal Line**: Draw horizontal price levels for key support/resistance zones
  - **Rectangle**: Highlight rectangular price zones (congestion areas, trading ranges)
  - **Fibonacci**: Draw Fibonacci retracement levels with standard levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)

- **Customization Options**:
  - 8 color options for drawing styles
  - Adjustable line width (1-5px)
  - Toggle visibility of individual drawings
  - Delete specific drawings or clear all

- **State Management**:
  - Undo functionality (Ctrl+Z / Cmd+Z)
  - Drawing history tracking
  - Optional persistence via localStorage
  - Keyboard shortcuts (Esc to cancel, Delete to remove selected)

- **UI Features**:
  - Floating toolbar with intuitive icons
  - Drawings list panel for management
  - Active tool indicator
  - Help text for new users
  - Responsive design with backdrop blur effects

## Installation

The component is already part of the codebase. Import it directly:

```tsx
import { ChartDrawingOverlay } from '@/components/trading/ChartDrawingOverlay';
```

## Basic Usage

### Standalone Overlay

```tsx
import { ChartDrawingOverlay } from '@/components/trading/ChartDrawingOverlay';
import { useRef } from 'react';

function MyChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" style={{ width: 800, height: 420 }}>
      <div ref={chartContainerRef} className="absolute inset-0">
        {/* Your chart component here */}
      </div>
      <ChartDrawingOverlay
        chartContainerRef={chartContainerRef}
        width={800}
        height={420}
      />
    </div>
  );
}
```

### Integrated with CandlestickChart

Use the `ChartWithDrawingTools` wrapper component for seamless integration:

```tsx
import { ChartWithDrawingTools } from '@/components/trading/ChartWithDrawingTools';

function TradingView() {
  return (
    <ChartWithDrawingTools
      pairId="XLM_USDC"
      baseSymbol="XLM"
      quoteSymbol="USDC"
      height={420}
      fillParent={false}
      showTimeframeControls={true}
    />
  );
}
```

## Props

### ChartDrawingOverlay

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chartContainerRef` | `React.RefObject<HTMLDivElement>` | **Required** | Reference to the chart container element |
| `chartApi` | `any` | `undefined` | Optional lightweight-charts API instance for future integration |
| `width` | `number` | `800` | Width of the overlay canvas |
| `height` | `number` | `420` | Height of the overlay canvas |
| `onDrawingsChange` | `(drawings: DrawingShape[]) => void` | `undefined` | Callback when drawings change |
| `initialDrawings` | `DrawingShape[]` | `[]` | Initial drawings to render |
| `disabled` | `boolean` | `false` | Disable drawing functionality |

### ChartWithDrawingTools

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pairId` | `string` | **Required** | Trading pair identifier |
| `baseSymbol` | `string` | **Required** | Base asset symbol |
| `quoteSymbol` | `string` | **Required** | Quote asset symbol |
| `height` | `number` | `420` | Chart height |
| `fillParent` | `boolean` | `false` | Fill parent container height |
| `showTimeframeControls` | `boolean` | `true` | Show timeframe selector |
| `timeframe` | `string` | `undefined` | Controlled timeframe |
| `onTimeframeChange` | `(resolution: string) => void` | `undefined` | Timeframe change callback |

## Data Structures

### DrawingShape

```typescript
interface DrawingShape {
  id: string;                    // Unique identifier
  type: DrawingTool;             // Tool type used
  points: DrawingPoint[];        // Array of coordinate points
  color: string;                 // Hex color code
  lineWidth: number;             // Line width in pixels
  visible: boolean;              // Visibility toggle
  createdAt: number;             // Creation timestamp
}
```

### DrawingPoint

```typescript
interface DrawingPoint {
  x: number;           // Canvas X coordinate
  y: number;           // Canvas Y coordinate
  timestamp?: number;   // Optional chart timestamp
  price?: number;      // Optional price value
}
```

### DrawingTool

```typescript
type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'rectangle' | 'fibonacci';
```

## Keyboard Shortcuts

- **Esc**: Cancel current drawing / Deactivate tool
- **Ctrl+Z / Cmd+Z**: Undo last drawing action
- **Delete / Backspace**: Delete selected drawing

## Drawing Tool Usage

### Trendline
1. Select Trendline tool from toolbar
2. Click and drag to draw a line between two points
3. Release to complete the line

### Horizontal Line
1. Select Horizontal tool from toolbar
2. Click to set the price level (Y position)
3. Click again to confirm the line spans the full width

### Rectangle
1. Select Rectangle tool from toolbar
2. Click and drag to define the rectangle's opposite corners
3. Release to complete the rectangle

### Fibonacci Retracement
1. Select Fibonacci tool from toolbar
2. Click to set the start point (high or low)
3. Drag and release to set the end point
4. Standard Fibonacci levels are automatically drawn

## Persistence

The `ChartWithDrawingTools` component automatically persists drawings to localStorage using the key pattern:

```
stellarflow.chart.drawings.{pairId}
```

Each trading pair has its own set of saved drawings, which are loaded when the chart is initialized.

## Styling

The component uses Tailwind CSS classes for styling. The dark theme is optimized for trading interfaces with:

- Semi-transparent backgrounds with backdrop blur
- High-contrast colors for readability
- Smooth transitions and hover effects
- Responsive layout that adapts to different screen sizes

## Examples

See the Storybook stories in `ChartDrawingOverlay.stories.tsx` for interactive examples:

- **Default**: Basic usage with empty canvas
- **WithInitialDrawings**: Pre-populated with sample drawings
- **LargeSize**: Larger canvas dimensions
- **Disabled**: Drawing functionality disabled

## Accessibility

- All buttons have appropriate `aria-label` or `title` attributes
- Keyboard navigation support
- High contrast colors for visibility
- Screen reader compatible text labels

## Future Enhancements

Potential improvements for future versions:

- Snap to price/time grid
- Extend trendlines indefinitely
- Add more Fibonacci tools (extensions, fans, arcs)
- Drawing templates (patterns, formations)
- Export/import drawings as JSON
- Drawing annotations and labels
- Multi-chart synchronization
- Price/time coordinate conversion for smarter drawings

## Browser Support

Works in all modern browsers that support:
- Canvas API
- ES6+ JavaScript
- CSS Grid and Flexbox

## Dependencies

- React 19+
- lucide-react (icons)
- Tailwind CSS (styling)

No additional chart library dependencies required for the overlay itself.
