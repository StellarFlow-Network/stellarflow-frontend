# Skeleton Components

Animated shimmer loading placeholders designed to eliminate Cumulative Layout Shift (CLS) during data loading.

## 📁 Directory Structure

```
skeletons/
├── README.md                          # This file
├── index.ts                           # Barrel exports
├── Shimmer.tsx                        # Base shimmer animation
├── SkeletonCard.tsx                   # Card skeletons (vault, pool, farm, stats)
├── SkeletonTable.tsx                  # Table skeletons (pool, transaction, corridor, relayer)
├── SkeletonChart.tsx                  # Chart skeletons (price, liquidity, portfolio, etc.)
├── integration-examples.tsx           # Usage examples and patterns
├── __tests__/                         # Component tests
└── [legacy skeletons]                 # Existing skeleton components
```

## 🎨 Components

### Core Components (New)

| Component | Purpose | Variants |
|-----------|---------|----------|
| **Shimmer** | Base animation component | - |
| **SkeletonCard** | Card layouts | vault, pool, farm, stats |
| **SkeletonTable** | Table layouts | pool, transaction, corridor, relayer |
| **SkeletonChart** | Chart layouts | price, liquidity, portfolio, allocation, orderbook, apy |

### Legacy Components

Existing skeleton components maintained for compatibility:
- `AdminStatsSkeleton`
- `DashboardTrafficChartSkeleton`
- `MapSkeleton`
- `MetricCardSkeleton`
- `PriceFeedCardSkeleton`
- `RateSparklineSkeleton`
- `StatsSkeleton`
- `TransactionHistoryTableSkeleton`
- `ValidatorListSkeleton`
- `ValidatorMetricsSkeleton`
- `VotingGridSkeleton`

## 🚀 Quick Start

```tsx
import { SkeletonCard, SkeletonTable, SkeletonChart } from '@/components/skeletons';

// Use in place of loading spinners
{isLoading ? (
  <SkeletonCard variant="vault" count={3} />
) : (
  vaults.map(v => <VaultCard key={v.id} vault={v} />)
)}
```

## 📖 Documentation

- **[Quick Reference](../../../SKELETON_QUICK_REFERENCE.md)** - Fast lookup and common patterns
- **[Full Guide](../../../SKELETON_LOADING_GUIDE.md)** - Complete documentation with examples
- **[Integration Examples](./integration-examples.tsx)** - Real-world code patterns

## 🎯 Key Features

- **Zero Layout Shift** - Matches exact dimensions of loaded components
- **Smooth Animation** - GPU-accelerated shimmer effect via Framer Motion
- **Variants System** - Pre-built skeletons for common component types
- **CSS Containment** - Optimized rendering performance
- **Responsive** - Works across all viewport sizes

## 🧪 Testing

All skeleton components should maintain **CLS < 0.01**:

```bash
# Test with Lighthouse
1. Open Chrome DevTools
2. Lighthouse tab → Performance
3. Analyze page load
4. Verify CLS score < 0.01
```

## 🔧 Development Guidelines

### Adding New Skeleton Variants

1. **Measure** the real component dimensions precisely
2. **Match** all padding, borders, heights, and grid layouts
3. **Test** CLS score < 0.01 with Lighthouse
4. **Document** the variant in the component file

### Anatomy of a Skeleton

```tsx
function MySkeletonComponent() {
  return (
    <div 
      className="[exact-same-classes-as-real-component]"
      style={{ contain: "layout paint" }}  // Required for CLS
    >
      <Shimmer className="h-[height] w-[width] rounded-[radius]" />
      {/* More shimmer blocks matching real component structure */}
    </div>
  );
}
```

### Best Practices

✅ **DO:**
- Use exact same container classes as real component
- Add `contain: "layout paint"` to wrapper
- Use Shimmer component for all animated blocks
- Match grid layouts precisely
- Test on mobile and desktop

❌ **DON'T:**
- Use Tailwind `animate-pulse` directly (use Shimmer instead)
- Guess dimensions (measure real component)
- Create overly complex skeletons (keep it simple)
- Forget to memoize with `React.memo`

## 🏗️ Architecture

### Component Hierarchy

```
SkeletonCard / SkeletonTable / SkeletonChart (Public API)
    ↓
Variant-specific components (Internal)
    ↓
Shimmer (Base animation)
```

### Animation System

**Shimmer Component** (`Shimmer.tsx`):
- Uses Framer Motion for smooth animation
- Linear gradient sweep: `-100%` to `100%`
- 1.4s duration, infinite loop
- GPU-accelerated transform

```tsx
<motion.div
  animate={{ x: ['-100%', '100%'] }}
  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
/>
```

## 📊 Performance

- **Animation**: 60fps on modern devices
- **CPU**: Low usage (GPU-accelerated)
- **Memory**: ~5KB per skeleton component
- **Bundle**: ~15KB total (gzipped)

## 🔄 Migration from Old Patterns

**Before:**
```tsx
{isLoading ? <div>Loading...</div> : <Component />}
{isLoading ? <Spinner /> : <Component />}
```

**After:**
```tsx
{isLoading ? <SkeletonCard variant="stats" count={4} /> : <Component />}
```

## 🤝 Contributing

When adding new data-loading components:

1. Check if existing skeleton variant matches
2. If not, extend closest variant or create new one
3. Test CLS < 0.01
4. Update documentation
5. Add example to `integration-examples.tsx`

## 📞 Support

- **Questions?** Check [SKELETON_LOADING_GUIDE.md](../../../SKELETON_LOADING_GUIDE.md)
- **Issues?** See troubleshooting section in Quick Reference
- **Examples?** See [integration-examples.tsx](./integration-examples.tsx)

---

**Target:** CLS < 0.01 | **Animation:** 1.4s Shimmer | **Performance:** GPU-accelerated
