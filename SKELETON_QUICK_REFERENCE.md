# Skeleton Components - Quick Reference

> **TL;DR**: Use skeletons instead of spinners to eliminate layout shift (CLS) during data loading.

## 🚀 Quick Start

```tsx
import { SkeletonCard, SkeletonTable, SkeletonChart } from '@/components/skeletons';

// Cards
{isLoading ? <SkeletonCard variant="vault" count={3} /> : <VaultCard vault={vault} />}

// Tables  
{isLoading ? <SkeletonTable variant="pool" rows={10} showSearch /> : <PoolTable pools={pools} />}

// Charts
{isLoading ? <SkeletonChart variant="price" height={400} showTimeframes /> : <TokenPriceChart {...props} />}
```

---

## 📦 Component Cheat Sheet

| Component | Variants | Props |
|-----------|----------|-------|
| **SkeletonCard** | `vault`, `pool`, `farm`, `stats` | `count`, `variant`, `className` |
| **SkeletonTable** | `pool`, `transaction`, `corridor`, `relayer` | `rows`, `variant`, `showSearch`, `className` |
| **SkeletonChart** | `price`, `liquidity`, `portfolio`, `allocation`, `orderbook`, `apy` | `variant`, `height`, `showTimeframes`, `showIndicators`, `className` |

---

## 🎯 When to Use What

```tsx
// Vault cards, farm cards, stat cards
<SkeletonCard variant="vault" count={6} />

// Pool tables, transaction tables
<SkeletonTable variant="pool" rows={10} showSearch />

// Price charts with controls
<SkeletonChart variant="price" height={400} showTimeframes showIndicators />

// Simple trend charts (in cards)
<SkeletonChart variant="apy" height={200} />

// Portfolio pie/donut charts
<SkeletonChart variant="allocation" height={300} />
```

---

## ✅ Best Practices

### DO ✓
- Show skeleton on **initial load only** (not refetch)
- Match **exact dimensions** of loaded component
- Use **count/rows** that fit viewport (8-12 typical)
- Test **CLS score < 0.01** with Lighthouse
- Wrap skeleton + content in **same container**

### DON'T ✗
- Don't use spinners for data grids
- Don't show skeleton during refetch
- Don't guess dimensions (measure real component)
- Don't render 100+ skeleton rows
- Don't forget error states

---

## 🧪 Quick CLS Test

```bash
1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" 
4. Click "Analyze page load"
5. Check CLS score < 0.01 ✅
```

---

## 📋 Common Patterns

### Pattern 1: React Query
```tsx
const { data, isLoading } = useQuery({ queryKey: ['pools'], queryFn: fetchPools });
if (isLoading) return <SkeletonTable variant="pool" rows={10} />;
return <PoolTable pools={data} />;
```

### Pattern 2: Conditional
```tsx
{isLoading ? (
  <SkeletonCard variant="vault" count={3} />
) : (
  <div className="grid gap-6 md:grid-cols-3">
    {vaults.map(v => <VaultCard key={v.id} vault={v} />)}
  </div>
)}
```

### Pattern 3: Suspense
```tsx
<Suspense fallback={<SkeletonTable variant="pool" rows={10} />}>
  <PoolTableAsync />
</Suspense>
```

### Pattern 4: Mixed Loading
```tsx
<div className="space-y-6">
  {statsLoading ? <SkeletonCard variant="stats" count={4} /> : <StatsRow />}
  {poolsLoading ? <SkeletonTable variant="pool" rows={8} /> : <PoolTable />}
  {chartsLoading ? <SkeletonChart variant="portfolio" height={300} /> : <Chart />}
</div>
```

---

## 🔧 Props at a Glance

### SkeletonCard
```tsx
<SkeletonCard 
  variant="vault"    // "vault" | "pool" | "farm" | "stats"
  count={3}          // number of cards
  className=""       // additional classes
/>
```

### SkeletonTable  
```tsx
<SkeletonTable 
  variant="pool"     // "pool" | "transaction" | "corridor" | "relayer"
  rows={10}          // number of rows
  showSearch={true}  // show search bar
  className=""       // additional classes
/>
```

### SkeletonChart
```tsx
<SkeletonChart 
  variant="price"         // "price" | "liquidity" | "portfolio" | "allocation" | "orderbook" | "apy"
  height={400}            // height in pixels
  showTimeframes={true}   // show timeframe controls
  showIndicators={false}  // show indicator toggles
  className=""            // additional classes
/>
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Content jumps on load | Match skeleton dimensions exactly to real component |
| High CLS score (>0.1) | Add `contain: "layout paint"` (already in skeletons) |
| Skeleton too small/large | Inspect real component, adjust skeleton variant |
| Flash of blank screen | Show skeleton immediately when `isLoading=true` |
| Skeleton shows during refetch | Only show on initial load: `if (isLoading) return <Skeleton />` |

---

## 📖 Full Documentation

See **[SKELETON_LOADING_GUIDE.md](./SKELETON_LOADING_GUIDE.md)** for:
- Detailed API reference
- Advanced patterns
- CLS testing guide
- Performance tips
- Migration guide

---

## 📞 Quick Help

```tsx
// Import all skeletons
import { SkeletonCard, SkeletonTable, SkeletonChart } from '@/components/skeletons';

// Location
// src/components/skeletons/SkeletonCard.tsx
// src/components/skeletons/SkeletonTable.tsx
// src/components/skeletons/SkeletonChart.tsx

// Examples
// src/components/skeletons/integration-examples.tsx

// Real integration
// src/components/analytics/PortfolioSummary.tsx (live example)
```

---

**Target:** CLS < 0.01 | **Animation:** 1.4s Shimmer | **Performance:** GPU-accelerated
