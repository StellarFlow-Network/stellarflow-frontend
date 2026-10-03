# Voting Power Calculator - Visual Specification

## Component Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Voting Power Calculator                                        │
│  Preview your governance voting power and yield multiplier...   │
├─────────────────────────────────────────────────────────────────┤
│  ℹ️  veFLOW voting power increases linearly from 1x at 1 week   │
│      to 4x at 4 years. Your voting power percentage is...       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────┐  ┌──────────────────────────┐   │
│  │ SLIDERS                   │  │   CIRCULAR GAUGE         │   │
│  │                           │  │                          │   │
│  │ FLOW Token Amount         │  │        ┌─────┐          │   │
│  │ 5,000 FLOW ▓▓▓▓▓░░░░      │  │     ╱         ╲         │   │
│  │ Available: 50,000 FLOW    │  │   ╱     🗳️      ╲       │   │
│  │                           │  │  │      15.00    │       │   │
│  │ Lock Duration             │  │   ╲  VOTING POWER %╱     │   │
│  │ 1 year ▓▓▓▓▓▓▓▓░░░        │  │     ╲         ╱         │   │
│  │ Longer locks = higher...  │  │        └─────┘          │   │
│  │                           │  │                          │   │
│  │ [1 Month] [6 Months]      │  │  Gradient: Purple→Blue   │   │
│  │ [1 Year] [2 Years] [Max]  │  │           →Cyan          │   │
│  └───────────────────────────┘  └──────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐  │
│  │ 🔒 veFLOW Bal.  │ │ 📈 Power Multi. │ │ ⚡ Yield Boost  │  │
│  │    10,000       │ │     2.00x       │ │     2.00x       │  │
│  │ 5,000 FLOW × ..│ │ Based on 1 year │ │ Applied to vault│  │
│  └─────────────────┘ └─────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [ Lock 5,000 FLOW for 1 year ]  ← Gradient button             │
│                                                                  │
│  veFLOW is non-transferable and will unlock after the chosen... │
│  Voting power and yield boost decay linearly as your lock...    │
└─────────────────────────────────────────────────────────────────┘
```

## Color Palette

### Primary Colors
```css
Blue:    #3b82f6  /* Sliders, primary actions */
Purple:  #8b5cf6  /* Gradients, accents */
Cyan:    #06b6d4  /* Gauge gradient end */
```

### Background Colors
```css
Container:   #0d1117  /* Main component background */
Cards:       #161b22  /* Metric cards, inputs */
Hover:       #1c2128  /* Hover states */
Dark Base:   #0a0a0a  /* Page background */
```

### Border Colors
```css
Default:     rgba(255, 255, 255, 0.08)  /* Standard borders */
Blue Accent: rgba(59, 130, 246, 0.2)    /* Info banners */
Warning:     rgba(239, 68, 68, 0.3)     /* Error states */
```

### Text Colors
```css
Primary:   #ededed      /* Headings, values */
Secondary: #9ca3af      /* Labels, descriptions */
Muted:     #6b7280      /* Helper text */
Accent:    #3b82f6      /* Interactive elements */
Success:   #10b981      /* Positive values */
Error:     #ef4444      /* Validation errors */
```

## Typography

### Headings
- **Title**: 24px, Bold, text-gray-100
- **Section Headers**: 14px, Bold, Uppercase, Tracking-wide
- **Metric Labels**: 10px, Semibold, Uppercase, text-gray-400

### Body Text
- **Primary**: 14px, Normal, text-gray-300
- **Helper**: 12px, Normal, text-gray-500
- **Values**: 24-32px, Bold, Mono, text-blue-400

## Component Dimensions

### Desktop (≥768px)
```
Container:        max-w-4xl (896px)
Padding:          24px
Gap:              24px
Gauge Size:       200x200px
Metric Cards:     ~280px width (responsive grid)
```

### Mobile (<768px)
```
Container:        100% width
Padding:          16px
Gap:              16px
Gauge Size:       160x160px
Metric Cards:     100% width stacked
```

## Interactive Elements

### Sliders
```css
Track Height:     12px
Thumb Size:       20x20px (circular)
Thumb Background: linear-gradient(135deg, #3b82f6, #8b5cf6)
Thumb Shadow:     0 0 8px rgba(59, 130, 246, 0.5)
Hover Scale:      1.1x
Active Scale:     1.05x
```

### Buttons (Presets)
```css
Size:             px-3 py-1.5
Font:             12px, Medium
Border:           1px solid gray-700
Background:       Transparent
Hover:            bg-gray-800
Text:             text-gray-300
```

### Primary Button (Lock)
```css
Width:            100%
Height:           48px (py-3)
Background:       linear-gradient(to right, #2563eb, #7c3aed)
Hover:            linear-gradient(to right, #1d4ed8, #6d28d9)
Text:             14px, Bold, White
Border Radius:    8px
Transition:       all 0.2s
```

## Circular Gauge Specification

### SVG Structure
```
Size:             200x200px
viewBox:          0 0 200 200
Center:           100, 100
Radius:           80px
```

### Track (Background)
```css
Stroke:           currentColor (text-gray-800)
Stroke Width:     12px
Fill:             none
```

### Progress Arc
```css
Stroke:           url(#gradient)
Stroke Width:     12px
Stroke Linecap:   round
Fill:             none
Filter:           drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))
Transition:       stroke-dashoffset 0.5s ease
```

### Gradient Definition
```css
Type:             linear
Direction:        0% 0% → 100% 100%
Stops:
  0%:    #8b5cf6 (purple)
  50%:   #3b82f6 (blue)
  100%:  #06b6d4 (cyan)
```

### Center Content
```
Icon:             Vote (24px)
Value:            32px, Bold, Mono, White
Label:            10px, Semibold, gray-400
```

## Metric Cards Layout

### Grid Configuration
```css
Desktop:          grid-cols-3
Mobile:           grid-cols-1
Gap:              16px
```

### Individual Card
```css
Width:            Responsive (flex: 1)
Padding:          16px
Background:       rgba(22, 27, 34, 0.6)
Border:           1px solid rgba(255, 255, 255, 0.08)
Border Radius:    8px
```

### Card Content
```
Icon:             16x16px, colored
Label:            10px, Uppercase, gray-500
Value:            24px, Bold, Mono, colored
Subtext:          10px, gray-500
```

## Spacing System

```css
Component Gap:    24px (space-y-6)
Section Gap:      16px (space-y-4)
Card Gap:         16px (gap-4)
Element Gap:      12px (space-y-3)
Small Gap:        8px (space-y-2)
```

## Border Radius

```css
Container:        12px (rounded-xl)
Cards:            8px (rounded-lg)
Buttons:          8px (rounded-lg)
Inputs:           8px (rounded-lg)
```

## Shadow System

```css
Card:             none (border-based)
Button:           none (gradient-based)
Gauge Glow:       0 0 8px rgba(59, 130, 246, 0.4)
Thumb Hover:      0 0 12px rgba(59, 130, 246, 0.7)
```

## Animation Specifications

### Slider Movement
```css
Property:         Value change
Duration:         Instant (native behavior)
Easing:           Linear
```

### Gauge Progress
```css
Property:         stroke-dashoffset
Duration:         500ms
Easing:           ease
```

### Button Hover
```css
Property:         background, transform, box-shadow
Duration:         200ms
Easing:           ease
```

### Preset Button Click
```css
Property:         background
Duration:         150ms
Easing:           ease-out
```

## Responsive Breakpoints

```css
Mobile:           < 640px
Tablet:           640px - 768px
Desktop:          ≥ 768px
Large Desktop:    ≥ 1024px
```

### Layout Changes by Breakpoint

#### Mobile (< 640px)
- Single column layout
- Gauge: 160x160px
- Stacked metric cards
- Full-width buttons
- Reduced padding (16px)

#### Tablet (640-768px)
- Adaptive layout
- Gauge: 180x180px
- 2-column metric grid
- Comfortable touch targets

#### Desktop (≥ 768px)
- Two-column layout (sliders | gauge)
- Gauge: 200x200px
- 3-column metric grid
- Optimal spacing

## Accessibility Features

### Focus Indicators
```css
Outline:          3px solid #ffff00 (high visibility)
Outline Offset:   3px
Border Radius:    8px (matched to element)
```

### ARIA Labels
```html
Gauge:            aria-label="Voting power: X.XX%"
Sliders:          aria-label="FLOW Token Amount"
                 aria-label="Lock Duration"
```

### Keyboard Navigation
- Tab: Move between interactive elements
- Arrow Keys: Adjust slider values
- Enter/Space: Activate buttons
- Escape: Clear focus (native)

## State Variations

### Default State
- All interactive elements enabled
- Default values displayed
- Gauge shows calculated power

### Hover State
- Slider thumb scales up (1.1x)
- Button background changes
- Cursor: pointer

### Active/Focus State
- Slider thumb scales (1.05x)
- Button pressed appearance
- Focus outline visible

### Disabled State
- Reduced opacity (0.5)
- Cursor: not-allowed
- Muted colors
- No hover effects

### Error State
- Red border (rgba(239, 68, 68, 0.3))
- Error message visible
- Disabled submission
- Clear visual feedback

## Component States Diagram

```
┌─────────────┐
│   INITIAL   │  Default values, all enabled
└──────┬──────┘
       │
       ├──────────┐
       │          │
       ▼          ▼
┌─────────┐  ┌──────────┐
│ SLIDING │  │ HOVERING │  Interactive states
└────┬────┘  └──────────┘
     │
     ▼
┌─────────────┐
│ CALCULATING │  Real-time updates
└──────┬──────┘
       │
       ├──────────┬──────────┐
       │          │          │
       ▼          ▼          ▼
┌─────────┐  ┌───────┐  ┌────────┐
│  VALID  │  │ ERROR │  │ LOCKED │
└─────────┘  └───────┘  └────────┘
```

## File Structure Visual

```
src/components/governance/
│
├── VotingPowerCalculator.tsx
│   ├── Types & Interfaces
│   ├── Constants
│   ├── Utility Functions
│   │   ├── calculateMultiplier()
│   │   ├── calculateYieldBoost()
│   │   ├── formatDuration()
│   │   └── getPowerColor()
│   ├── Sub-Components
│   │   ├── VotingPowerGauge
│   │   ├── Slider
│   │   └── MetricsCard
│   └── Main Component
│       ├── State Management
│       ├── Memoized Calculations
│       └── JSX Template
│
├── VotingPowerCalculator.stories.tsx
│   └── 6 Story Variants
│
└── __tests__/
    └── VotingPowerCalculator.test.tsx
        └── 20+ Test Cases
```

## Performance Optimizations

### Render Optimization
```typescript
useMemo()     → Calculations cached
useCallback() → Stable function refs
React.memo()  → Sub-component memoization
```

### Animation Performance
```css
transform:      GPU-accelerated
will-change:    Hint to browser
contain:        Layout isolation
```

### Bundle Optimization
```
Code Splitting:   Client component boundary
Tree Shaking:     Named exports
Compression:      ~15KB gzipped
```

---

**Visual Design Notes:**
- Follows existing StellarFlow design system
- Dark theme optimized
- High contrast for accessibility
- Smooth, 60fps animations
- Professional, financial app aesthetic
- Clear information hierarchy
- Intuitive interaction patterns
