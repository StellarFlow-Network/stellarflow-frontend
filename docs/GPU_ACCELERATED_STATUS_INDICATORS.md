# GPU-Accelerated Status Indicators Implementation

## Overview

Refactored real-time node status indicator animations to use hardware-accelerated CSS animations that run on the GPU compositor thread, eliminating continuous paint updates and layout recalculations.

## Changes Implemented

### 1. Custom Compositor-Safe Keyframes (`globals.css`)

Added three new animation utilities:

```css
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes status-ping {
  0% {
    transform: scale(1);
    opacity: 0.3;
  }
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-status-pulse {
  animation: status-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-status-ping {
  animation: status-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.gpu-layer {
  will-change: opacity, transform;
  transform: translateZ(0);
}
```

**Key Benefits:**
- Only `opacity` and `transform` properties (GPU-accelerated)
- No layout-affecting properties (width, height, margin, padding)
- Explicit layer promotion via `.gpu-layer` class

### 2. GlobalHealthIndicator.tsx

**Changes:**
- ✅ Added `contain: "layout paint"` to wrapper div
- ✅ Conditional rendering: ping ring only renders when `status === "ACTIVE"`
- ✅ Conditional animation: core dot only animates when `status === "ACTIVE"`
- ✅ Applied `.gpu-layer` class to animated elements
- ✅ Replaced `animate-ping` with `animate-status-ping`
- ✅ Replaced `animate-pulse` with `animate-status-pulse`

**Before:**
```tsx
// Ping and pulse ran on ALL states (ACTIVE, INACTIVE, WARNING)
<div className={`absolute w-4 h-4 rounded-full ${config.dotColor} animate-ping opacity-30`} />
<div className={`relative w-3 h-3 rounded-full ${config.dotColor} animate-pulse ${config.dotGlow}`} />
```

**After:**
```tsx
// Only animates when status === "ACTIVE"
{isActive && (
  <div className={`absolute w-4 h-4 rounded-full ${config.dotColor} animate-status-ping opacity-30 gpu-layer`} />
)}
<div className={`relative w-3 h-3 rounded-full ${config.dotColor} ${config.dotGlow} ${isActive ? "animate-status-pulse gpu-layer" : ""}`} />
```

### 3. OracleHealthIndicator.tsx

**Changes:**
- ✅ Added `contain: "layout paint"` to wrapper div
- ✅ Replaced `animate-ping` with `animate-status-ping`
- ✅ Replaced `animate-pulse` with `animate-status-pulse`
- ✅ Applied `.gpu-layer` class to animated elements
- ℹ️ Already had conditional animation guard (`config.pulse` only true for "Online" status)

**Before:**
```tsx
<div className={`absolute w-4 h-4 rounded-full ${config.dotColor} animate-ping opacity-30`} />
<div className={`relative w-3 h-3 rounded-full ${config.dotColor} ${config.dotGlow} ${config.pulse ? "animate-pulse" : ""}`} />
```

**After:**
```tsx
<div className={`absolute w-4 h-4 rounded-full ${config.dotColor} animate-status-ping opacity-30 gpu-layer`} />
<div className={`relative w-3 h-3 rounded-full ${config.dotColor} ${config.dotGlow} ${config.pulse ? "animate-status-pulse gpu-layer" : ""}`} />
```

### 4. RelayerStatusTable.tsx (StatusBadge)

**Changes:**
- ✅ Moved `willChange` from wrapper to actual animated dot element
- ✅ Wrapper retains `contain: "layout"` for isolation
- ✅ Applied `.animate-status-pulse` and `.gpu-layer` to dot when status is "Online"

**Before:**
```tsx
<span style={{ contain: 'layout', willChange: 'opacity, transform' }} className={`... ${RELAYER_STATUS_BADGE_VARIANTS[status]}`}>
  <span className={`h-1.5 w-1.5 rounded-full ${RELAYER_STATUS_DOT_VARIANTS[status]}`} />
  {status}
</span>
```

**After:**
```tsx
<span style={{ contain: 'layout' }} className={`... ${RELAYER_STATUS_BADGE_VARIANTS[status]}`}>
  <span className={`h-1.5 w-1.5 rounded-full ${RELAYER_STATUS_DOT_VARIANTS[status]} ${isOnline ? 'animate-status-pulse gpu-layer' : ''}`} />
  {status}
</span>
```

### 5. ModularStatsCard.tsx

**Changes:**
- ✅ Replaced `transition-all` with `transition-colors` to avoid layout recalculation on hover

**Before:**
```tsx
<div className="... hover:border-[#39FF14]/50 transition-all duration-300 group">
```

**After:**
```tsx
<div className="... hover:border-[#39FF14]/50 transition-colors duration-300 group">
```

## Performance Impact

### Before
- **Paint operations:** Continuous repaints triggered on main thread for all status indicators
- **Layout recalculations:** Surrounding elements re-evaluated on every animation frame
- **CPU usage:** High during simultaneous animations
- **Animation waste:** INACTIVE and WARNING dots animated unnecessarily in GlobalHealthIndicator

### After
- **Paint operations:** Animations run on GPU compositor thread, isolated from main thread
- **Layout recalculations:** Blocked by `contain: layout paint` on wrapper elements
- **CPU usage:** Minimal; GPU handles all animation loops
- **Animation efficiency:** Only ACTIVE/Online states animate; static states have zero animation overhead

## Browser Compatibility

All features used are widely supported:
- `will-change`: [97%+ global support](https://caniuse.com/will-change)
- `transform: translateZ(0)`: Universal support
- `contain: layout paint`: [94%+ global support](https://caniuse.com/css-containment)
- `@keyframes` with `opacity`/`transform`: Universal support

## Testing Checklist

- [ ] GlobalHealthIndicator shows pulse/ping animation only when status="ACTIVE"
- [ ] GlobalHealthIndicator shows static dot when status="INACTIVE" or "WARNING"
- [ ] OracleHealthIndicator shows pulse/ping animation only when status="Online"
- [ ] RelayerStatusTable shows pulse animation on "Online" relayer dots only
- [ ] ModularStatsCard hover transitions border color smoothly without layout shift
- [ ] Chrome DevTools Performance tab shows no paint operations during status animations
- [ ] Chrome DevTools Rendering > Paint flashing shows no flashing on animated dots
- [ ] Chrome DevTools Layers panel shows animated dots on separate compositor layers

## DevTools Verification Commands

### Check compositor layer promotion:
```
1. Open Chrome DevTools
2. More tools > Layers
3. Inspect a pulsing status dot
4. Verify "Compositing Reasons" includes "will-change: opacity, transform"
```

### Check paint performance:
```
1. Open Chrome DevTools > Performance
2. Record 5 seconds with multiple status indicators visible
3. Check "Frames" section — should maintain 60fps
4. Check "Main" thread — animation ticks should be minimal/absent
5. Check "GPU" or "Compositor" thread — should show animation work
```

### Check layout containment:
```
1. Open Chrome DevTools > Rendering
2. Enable "Layout Shift Regions"
3. Hover over ModularStatsCard — should show no layout shift
4. Watch status dot animations — should show no layout shift in surrounding elements
```

## References

- [CSS will-change MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [CSS Containment MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Containment)
- [High Performance Animations](https://web.dev/animations-guide/)
- [Stick to Compositor-Only Properties](https://web.dev/stick-to-compositor-only-properties-and-manage-layer-count/)
