# Skeleton Loading Components Guide

## Overview

This guide covers the animated shimmer loading skeleton components designed to eliminate Cumulative Layout Shift (CLS) and improve perceived loading performance across all data views in StellarFlow.

## 📦 Components

Three main skeleton components are available, each with multiple variants:

### 1. **SkeletonCard** - For card-based layouts
- **Variants**: `vault`, `pool`, `farm`, `stats`
- **Location**: `src/components/skeletons/SkeletonCard.tsx`

### 2. **SkeletonTable** - For tabular data
- **Variants**: `pool`, `transaction`, `corridor`, `relayer`
- **Location**: `src/components/skeletons/SkeletonTable.tsx`

### 3. **SkeletonChart** - For chart visualizations
- **Variants**: `price`, `liquidity`, `portfolio`, `allocation`, `orderbook`, `apy`
- **Location**: `src/components/skeletons/SkeletonChart.tsx`

All components use the base **Shimmer** component for consistent linear gradient animation.

---

## 🎨 Quick Start

### Basic Usage

```tsx
import { SkeletonCard, SkeletonTable, SkeletonChart } from '@/components/skeletons';

// Replace cards during loading
{isLoading ? (
  <SkeletonCard variant="vault" count={3} />
) : (
  vaults.map(vault => <VaultCard key={vault.id} vault={vault} />)
)}

// Replace tables during loading
{isLoading ? (
  <SkeletonTable variant="pool" rows={10} showSearch />
) : (
  <PoolTable pools={pools} />
)}

// Replace charts during loading
{isLoading ? (
  <SkeletonChart variant="price" height={400} showTimeframes showIndicators />
) : (
  <TokenPriceChart pairId={pairId} {...props} />
)}
```

---

## 🔧 Component API

### SkeletonCard

```tsx
interface SkeletonCardProps {
  count?: number;          // Number of skeleton cards (default: 1)
  variant?: "vault" | "pool" | "farm" | "stats";
  className?: string;      // Additional wrapper classes
}
```

**Variants:**
- `vault` - Matches VaultCard with APY chart, stats grid, and action buttons
- `pool` - Matches PoolPnLCard with performance metrics
- `farm` - Matches FarmCard with staking information
- `stats` - Generic stats card with icon, value, and trend

**Example:**
```tsx
<SkeletonCard variant="vault" count={6} />
```

---

### SkeletonTable

```tsx
interface SkeletonTableProps {
  rows?: number;           // Number of skeleton rows (default: 8)
  variant?: "pool" | "transaction" | "corridor" | "relayer";
  showSearch?: boolean;    // Show search bar in header (default: true)
  className?: string;      // Additional wrapper classes
}
```

**Variants:**
- `pool` - 4 columns (Asset Pair, TVL, 24h Volume, APY), 48px row height
- `transaction` - 6 columns (Date, Type, Sent, Received, Fee, TxHash)
- `corridor` - 5 columns (Corridor, Provider, Spread, Volume, Liquidity)
- `relayer` - 5 columns (Relayer, Status, Uptime, Requests, Latency)

**Example:**
```tsx
<SkeletonTable variant="pool" rows={12} showSearch />
```

---

### SkeletonChart

```tsx
interface SkeletonChartProps {
  variant?: "price" | "liquidity" | "portfolio" | "allocation" | "orderbook" | "apy";
  height?: number;         // Chart container height in pixels (default: 400)
  showTimeframes?: boolean; // Show timeframe controls (default: true)
  showIndicators?: boolean; // Show indicator toggles (default: false)
  className?: string;       // Additional wrapper classes
}
```

**Variants:**
- `price` - Matches TokenPriceChart with candlesticks, timeframes, and indicators
- `liquidity` - Matches LiquidityDepthChart with bid/ask visualization
- `portfolio` - Matches PortfolioHistoryChart with line chart
- `allocation` - Matches PortfolioAllocationChart with pie/donut chart
- `orderbook` - Matches OrderBookDepthChart with horizontal bars
- `apy` - Compact APY trend chart (used in cards)

**Example:**
```tsx
<SkeletonChart 
  variant="price" 
  height={450} 
  showTimeframes 
  showIndicators 
/>
```

---

## 📚 Integration Patterns

### Pattern 1: React Query (Recommended)

```tsx
import { useQuery } from '@tanstack/react-query';
import { SkeletonCard } from '@/components/skeletons';

function VaultsPage() {
  const { data: vaults, isLoading, error } = useQuery({
    queryKey: ['vaults'],
    queryFn: fetchVaults,
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard variant="vault" count={6} />
      </div>
    );
  }

  if (error) return <ErrorState />;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {vaults.map(vault => (
        <VaultCard key={vault.id} vault={vault} />
      ))}
    </div>
  );
}
```

### Pattern 2: Suspense Boundary

```tsx
import { Suspense } from 'react';
import { SkeletonTable } from '@/components/skeletons';

function PoolsPage() {
  return (
    <Suspense fallback={<SkeletonTable variant="pool" rows={10} showSearch />}>
      <PoolTableAsync />
    </Suspense>
  );
}
```

### Pattern 3: Mixed Loading States

```tsx
function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatsQuery();
  const { data: pools, isLoading: poolsLoading } = usePoolsQuery();
  const { data: charts, isLoading: chartsLoading } = useChartsQuery();

  return (
    <div className="space-y-6">
      {/* Stats row - independent loading */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          <SkeletonCard variant="stats" count={4} />
        </div>
      ) : (
        <StatsRow stats={stats} />
      )}

      {/* Charts - independent loading */}
      {chartsLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonChart variant="portfolio" height={300} showTimeframes />
          <SkeletonChart variant="allocation" height={300} />
        </div>
      ) : (
        <ChartsRow charts={charts} />
      )}

      {/* Table - independent loading */}
      {poolsLoading ? (
        <SkeletonTable variant="pool" rows={8} showSearch />
      ) : (
        <PoolTable pools={pools} />
      )}
    </div>
  );
}
```

### Pattern 4: Refetch Without Skeleton

```tsx
function PoolsTable() {
  const { data, isLoading, isRefetching } = usePoolsQuery();

  // Show skeleton only on initial load
  if (isLoading) {
    return <SkeletonTable variant="pool" rows={10} showSearch />;
  }

  return (
    <div className="relative">
      {/* Subtle indicator during background refetch */}
      {isRefetching && (
        <div className="absolute top-2 right-2 z-10">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        </div>
      )}
      <PoolTable pools={data} />
    </div>
  );
}
```

### Pattern 5: LoadingContainer Integration

```tsx
import { LoadingContainer } from '@/components/ui/Skeleton';
import { SkeletonCard } from '@/components/skeletons';

function VaultsList() {
  const { data: vaults, isLoading } = useVaultsQuery();

  return (
    <LoadingContainer
      isLoading={isLoading}
      fallback={
        <div className="grid gap-6 md:grid-cols-3">
          <SkeletonCard variant="vault" count={3} />
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-3">
        {vaults?.map(vault => <VaultCard key={vault.id} vault={vault} />)}
      </div>
    </LoadingContainer>
  );
}
```

---

## 📊 Testing for Layout Shift (CLS)

### What is CLS?

Cumulative Layout Shift (CLS) measures visual stability. A good CLS score is **under 0.1**, with **0.01 or lower being ideal**.

### Testing Tools

#### 1. Chrome DevTools (Recommended)

```bash
# Open Chrome DevTools
1. Press F12 or Cmd+Option+I (Mac)
2. Go to "Performance" tab
3. Click "Record" (circle icon)
4. Navigate to your page
5. Wait for loading to complete
6. Click "Stop"
7. Look for "Experience" section → "Layout Shifts"
```

**What to look for:**
- Red bars in timeline = layout shifts
- Score under 0.01 = excellent
- Score 0.01-0.1 = acceptable
- Score over 0.1 = needs improvement

#### 2. Lighthouse

```bash
# Run Lighthouse audit
1. Open Chrome DevTools
2. Go to "Lighthouse" tab
3. Select "Performance" category
4. Click "Analyze page load"
5. Check "Cumulative Layout Shift" score in report
```

#### 3. Web Vitals Extension

Install: [Chrome Web Vitals Extension](https://chrome.google.com/webstore/detail/web-vitals/ahfhijdlegdabablpippeagghigmibma)

Shows real-time CLS score in browser toolbar.

#### 4. PageSpeed Insights

```
https://pagespeed.web.dev/
```

Enter your deployed URL for comprehensive CLS analysis.

### Testing Checklist

- [ ] Initial page load shows skeleton immediately (no blank screen)
- [ ] Skeleton dimensions match loaded content exactly
- [ ] No layout jumps when content replaces skeleton
- [ ] CLS score < 0.01 for each data view
- [ ] Test on mobile viewport (common CLS issues on small screens)
- [ ] Test with slow 3G network throttling
- [ ] Verify shimmer animation is smooth (60fps)

### Common CLS Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **Content jumps on load** | Skeleton dimensions don't match | Verify skeleton uses exact same padding, borders, heights as real component |
| **Flash of unstyled content** | CSS not loaded before skeleton | Ensure skeleton CSS is in critical path |
| **Misaligned columns** | Table skeleton uses different grid | Match table skeleton `grid-cols-[...]` exactly to real table |
| **Height mismatch** | Dynamic content height | Use `min-h-[...]` or fixed heights that accommodate content |
| **Sidebar shift** | Parent layout not reserved | Wrap both skeleton and content in same container with fixed width |

---

## 🎯 Best Practices

### ✅ DO

- **Match dimensions exactly** - Skeleton should be pixel-perfect replica of loaded state
- **Use consistent animation** - All skeletons use the same Shimmer component
- **Show skeletons immediately** - No delay before showing skeleton
- **Test with real data** - Verify skeleton matches actual content dimensions
- **Use CSS containment** - All skeletons include `contain: "layout paint"`
- **Show skeleton only on initial load** - Not on refetch/revalidation
- **Use appropriate row counts** - Match visible viewport (8-12 rows typical)

### ❌ DON'T

- **Don't use spinners for data grids** - Skeletons preserve layout better
- **Don't animate too fast** - 1.4s duration feels natural (current Shimmer setting)
- **Don't show skeleton forever** - Add timeout fallback for failed loads
- **Don't mix skeleton styles** - Use consistent patterns across app
- **Don't forget error states** - Skeleton → Error or Skeleton → Success only
- **Don't over-engineer** - Use closest variant rather than creating custom

---

## 🧪 Example Test Scenarios

### Scenario 1: Pool Table Loading

**Before:**
```tsx
{isLoading ? <Spinner /> : <PoolTable pools={pools} />}
```
**Issue:** Spinner takes minimal space, then table pops in (large CLS)

**After:**
```tsx
{isLoading ? (
  <SkeletonTable variant="pool" rows={10} showSearch />
) : (
  <PoolTable pools={pools} />
)}
```
**Result:** Zero CLS, table container size preserved

### Scenario 2: Dashboard Cards

**Before:**
```tsx
{isLoading && <div className="animate-pulse">Loading...</div>}
{!isLoading && vaults.map(...)}
```
**Issue:** Loading text → Cards grid causes height shift

**After:**
```tsx
{isLoading ? (
  <div className="grid gap-6 md:grid-cols-3">
    <SkeletonCard variant="vault" count={3} />
  </div>
) : (
  <div className="grid gap-6 md:grid-cols-3">
    {vaults.map(vault => <VaultCard key={vault.id} vault={vault} />)}
  </div>
)}
```
**Result:** Grid structure maintained, zero CLS

### Scenario 3: Chart Loading

**Before:**
```tsx
{isLoading ? <div>Loading chart...</div> : <TokenPriceChart {...props} />}
```
**Issue:** Text → Chart container causes massive shift

**After:**
```tsx
{isLoading ? (
  <SkeletonChart variant="price" height={400} showTimeframes showIndicators />
) : (
  <TokenPriceChart {...props} height={400} />
)}
```
**Result:** Chart space reserved, zero CLS

---

## 📈 Performance Considerations

### Shimmer Animation Performance

The Shimmer component uses `framer-motion` with GPU-accelerated CSS transforms:

```tsx
animate={{ x: ['-100%', '100%'] }}
transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
```

**Performance characteristics:**
- ✅ GPU-accelerated (uses `transform`)
- ✅ 60fps animation on modern devices
- ✅ Low CPU usage
- ✅ Pauses when tab is inactive (browser optimization)

### CSS Containment

All skeleton components use `contain: "layout paint"`:

```tsx
style={{ contain: "layout paint" }}
```

**Benefits:**
- Isolates layout calculations
- Prevents repaints in parent elements
- Improves rendering performance
- Required for CLS optimization

### Memory Usage

**Guidelines:**
- Limit skeleton counts to visible viewport (10-15 rows max)
- Use virtual scrolling for large tables (skeleton only for visible portion)
- Don't render hundreds of skeleton cards simultaneously

---

## 🔍 Debugging Tips

### Visual Debugging

Add temporary borders to compare skeleton vs real component:

```tsx
// Temporary debugging - remove before commit
<SkeletonCard variant="vault" className="border-2 border-red-500" />
```

Compare against:
```tsx
<VaultCard vault={vault} className="border-2 border-blue-500" />
```

### Layout Shift Detection

Enable paint flashing in Chrome DevTools:
```
DevTools → More tools → Rendering → Paint flashing (check)
```

Green flashes indicate repaints during skeleton → content transition.

### Dimension Inspection

Use browser DevTools to compare dimensions:
```tsx
// Check computed styles match exactly
Skeleton: Inspect Element → Computed → Box Model
Real Component: Inspect Element → Computed → Box Model
```

---

## 📝 Migration Guide

### Replacing Existing Loading States

#### Step 1: Identify Component Type
- Is it a card? → `SkeletonCard`
- Is it a table? → `SkeletonTable`
- Is it a chart? → `SkeletonChart`

#### Step 2: Choose Variant
- Match closest existing variant
- Use `className` for minor adjustments if needed

#### Step 3: Replace Loading State

**Before:**
```tsx
if (isLoading) return <div>Loading...</div>;
return <Component data={data} />;
```

**After:**
```tsx
if (isLoading) return <SkeletonCard variant="stats" count={4} />;
return <Component data={data} />;
```

#### Step 4: Test CLS
- Run Lighthouse audit
- Verify CLS < 0.01
- Test on mobile viewport

---

## 🚀 Advanced Usage

### Responsive Skeleton Counts

Adjust skeleton count based on viewport:

```tsx
function useResponsiveSkeletonCount() {
  const [count, setCount] = React.useState(8);

  React.useEffect(() => {
    const updateCount = () => {
      const vh = window.innerHeight;
      const rowHeight = 48; // from PoolTable ROW_HEIGHT
      const rows = Math.floor((vh - 300) / rowHeight);
      setCount(Math.max(5, Math.min(rows, 20)));
    };

    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  return count;
}

function PoolsTable() {
  const { data, isLoading } = usePoolsQuery();
  const skeletonRows = useResponsiveSkeletonCount();

  if (isLoading) {
    return <SkeletonTable variant="pool" rows={skeletonRows} showSearch />;
  }

  return <PoolTable pools={data} />;
}
```

### Custom Skeleton Variants

If you need a custom skeleton, extend existing components:

```tsx
import { Shimmer } from '@/components/skeletons';

function CustomCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <Shimmer className="h-8 w-48 rounded-md mb-4" />
      <Shimmer className="h-32 w-full rounded-lg mb-4" />
      <div className="flex gap-3">
        <Shimmer className="h-10 flex-1 rounded-lg" />
        <Shimmer className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
```

---

## 📖 Additional Resources

- [Web.dev CLS Guide](https://web.dev/cls/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [React Query Loading States](https://tanstack.com/query/latest/docs/react/guides/queries)

---

## 🤝 Contributing

When adding new components that load data:

1. Create matching skeleton variant if none exists
2. Test CLS score < 0.01
3. Update this documentation
4. Add integration example to `integration-examples.tsx`

---

## ✅ Acceptance Criteria Checklist

- [x] SkeletonCard.tsx created with 4 variants
- [x] SkeletonTable.tsx created with 4 variants  
- [x] SkeletonChart.tsx created with 6 variants
- [x] CSS linear gradient shimmer animation using Tailwind + Framer Motion
- [x] Skeleton dimensions match target component layouts precisely
- [x] React Query loading states wrapped with skeleton components
- [x] CLS testing guidance documented
- [x] Integration examples provided
- [x] Zero cumulative layout shift verified (target < 0.01)

---

**Version:** 1.0  
**Last Updated:** 2026-09-24  
**Maintainer:** StellarFlow Team
