# Fee Savings Widget - Quick Start Guide

## 🚀 Quick Implementation

```tsx
import { FeeSavingsWidget } from "@/components/remittance";

export default function MyPage() {
  return <FeeSavingsWidget />;
}
```

## 📋 Feature Checklist

✅ **Real-time comparison** - Shows StellarFlow vs 4 major MTOs  
✅ **Interactive slider** - $50 to $5,000 transfer amounts  
✅ **Currency selector** - EUR, NGN, BRL, KES  
✅ **CSV export** - Structured data for analysis  
✅ **Receipt export** - Printable fee breakdown  
✅ **Savings projections** - Up to annual calculations  
✅ **Responsive design** - Mobile to desktop  

## 🎯 Key Features

### 1. Real-time Comparison
- Visual cards for each provider
- Live fee calculations
- Automatic sorting by cost
- Click to select and compare

### 2. Interactive Slider
- Range: $50 - $5,000
- Instant recalculation
- Visual progress gradient
- Accessible keyboard controls

### 3. Export Options

**CSV Export (📊)**
```
Provider, Send Amount, Flat Fee, % Fee, Total Fee, Recipient Gets, Effective Cost %, Settlement
StellarFlow, 500.00, 0.50, 0.10%, 1.00, 743750.00 NGN, 1.20%, Seconds
Western Union, 500.00, 4.99, 1.50%, 12.49, 726375.00 NGN, 4.50%, Minutes - 1 day
...
```

**Receipt Export (📄)**
```
═══════════════════════════════════════════════
          STELLARFLOW FEE SAVINGS SUMMARY
═══════════════════════════════════════════════
Transfer Amount: $500.00 USD
Destination Currency: NGN (Nigerian Naira)
...
Your Savings: $11.49 per transfer
Annual Savings: $597.48 (52 weekly transfers)
```

## 🎨 Component Props

```typescript
interface FeeSavingsWidgetProps {
  className?: string;        // Optional: Custom CSS classes
  defaultAmount?: number;    // Optional: Default slider value (default: 500)
}
```

## 📱 Pages Available

### Standalone Page
```
URL: /remittance/savings
Location: src/app/remittance/savings/page.tsx
```

Full marketing page with:
- Hero section
- Integrated widget
- Benefits grid
- How It Works section
- Call-to-action

## 🧮 Fee Calculations

### Formula Overview
```
Total Fee = Flat Fee + (Send Amount × % Fee / 100)
Net Send = Send Amount - Total Fee
Effective Rate = Mid Rate × (1 - FX Margin)
Recipient Gets = Net Send × Effective Rate
Effective Cost % = (Total Fee / Send Amount × 100) + (FX Margin × 100)
```

## 🏦 Provider Profiles

| Provider | Flat Fee | % Fee | FX Margin | Settlement |
|----------|----------|-------|-----------|------------|
| **StellarFlow** | $0.50 | 0.1% | 0.1% | Seconds |
| Western Union | $4.99 | 1.5% | 2.0% | Mins - 1 day |
| MoneyGram | $3.99 | 1.2% | 2.5% | Mins - 1 day |
| Wise | $1.50 | 0.6% | 0.4% | 1-2 days |
| Remitly | $2.99 | 0.9% | 1.5% | Mins - 3 days |

## 💰 Example Savings

### $500 Transfer to Nigeria (NGN)
- **Western Union**: $12.49 fee (4.50% effective)
- **StellarFlow**: $1.00 fee (1.20% effective)
- **💵 Savings**: $11.49 per transfer
- **📅 Annual**: $597.48 (weekly transfers)

### $200 Transfer to Kenya (KES)
- **MoneyGram**: $6.39 fee (5.19% effective)
- **StellarFlow**: $0.70 fee (1.45% effective)
- **💵 Savings**: $5.69 per transfer
- **📅 Annual**: $295.88 (weekly transfers)

## 🎭 Storybook Examples

```bash
npm run storybook
```

Navigate to: **Remittance → FeeSavingsWidget**

Stories available:
1. **Default** ($500) - Standard use case
2. **SmallTransfer** ($100) - Low-value test
3. **LargeTransfer** ($5000) - High-value test
4. **TypicalRemittance** ($200) - Common amount
5. **MidRangeTransfer** ($1000) - Sweet spot

## 🔧 Customization Examples

### Custom Default Amount
```tsx
<FeeSavingsWidget defaultAmount={1000} />
```

### With Custom Styling
```tsx
<FeeSavingsWidget 
  className="max-w-4xl mx-auto shadow-2xl" 
  defaultAmount={250}
/>
```

### In Modal/Dialog
```tsx
<Dialog>
  <DialogContent>
    <FeeSavingsWidget defaultAmount={500} />
  </DialogContent>
</Dialog>
```

## 📊 User Interactions

### Slider Usage
1. Click/tap slider track to jump to position
2. Drag handle to adjust amount
3. Use arrow keys for fine control (±$50)
4. All calculations update instantly

### Currency Selection
1. Click any currency button (EUR, NGN, BRL, KES)
2. Active currency highlighted in emerald
3. Comparison table recalculates automatically

### Provider Comparison
1. Click any competitor card (not StellarFlow)
2. Selected card highlighted in blue
3. Savings projection panel appears below
4. Shows projected savings across 6 time periods

### Exporting Data
1. **CSV Export**: Click download icon (top-right)
2. **Receipt Export**: Click "Export Receipt" button
3. Files download automatically to browser default location

## 🎨 Visual Design

### Color Coding
- 🟢 **Emerald** - StellarFlow (best option)
- 🔵 **Blue** - Selected competitor
- 🟡 **Amber** - Warning/cost indicators
- 🔴 **Red** - Expensive/loss indicators
- ⚫ **Neutral** - Background/secondary

### Key Visual Elements
- Gradient backgrounds for depth
- Border highlights for interactivity
- Badge indicators for "Best" rates
- Icon integration (Lucide React)
- Smooth transitions and animations

## ♿ Accessibility

### Features
- ✅ Semantic HTML structure
- ✅ ARIA labels on controls
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ Screen reader support
- ✅ High contrast colors

### Keyboard Shortcuts
- `Tab` - Navigate elements
- `Enter/Space` - Select currency/provider
- `Arrow Keys` - Adjust slider
- `Escape` - Deselect (if in modal)

## 🐛 Troubleshooting

### Widget not showing
```tsx
// ✅ Correct import
import { FeeSavingsWidget } from "@/components/remittance";

// ❌ Wrong import
import FeeSavingsWidget from "@/components/remittance/FeeSavingsWidget";
```

### Calculations showing 0
- Check FX rates hook is returning data
- Verify `useFxRatesWithFallback` is implemented
- Ensure currency has rate in quotes array

### Exports not downloading
- Check browser download permissions
- Verify popup blocker settings
- Test in different browser

### Slider not responsive
- Verify Tailwind CSS is loaded
- Check for conflicting CSS
- Test in different viewport sizes

## 📦 File Structure

```
src/
├── components/
│   └── remittance/
│       ├── FeeSavingsWidget.tsx           # Main component
│       ├── FeeSavingsWidget.stories.tsx   # Storybook stories
│       └── index.ts                       # Export barrel
├── app/
│   └── remittance/
│       └── savings/
│           └── page.tsx                   # Demo page
└── types/
    └── fxRates.ts                         # Type definitions

docs/
└── FEE_SAVINGS_WIDGET.md                  # Full documentation
```

## 🔗 Related Components

- `FxComparisonTable` - Tabular fee comparison
- `FxRateTicker` - Live rate updates
- `ReceiptModal` - Transaction receipts
- `RemittanceHistoryModal` - Past transfers

## 📈 Analytics Events

Consider tracking:
- Widget mount/view
- Slider interactions
- Currency selections
- Provider comparisons
- Export actions (CSV/Receipt)
- CTA click-throughs

## 🚢 Deployment Checklist

Before deploying:
- [ ] Test all currencies
- [ ] Verify calculations
- [ ] Test exports on multiple browsers
- [ ] Check mobile responsiveness
- [ ] Validate accessibility
- [ ] Review disclaimer text
- [ ] Test with real FX data
- [ ] Verify Storybook builds

## 📞 Support

For issues or questions:
1. Check [Full Documentation](./docs/FEE_SAVINGS_WIDGET.md)
2. Review Storybook examples
3. Inspect browser console for errors
4. Verify dependencies are installed

## 🎯 Next Steps

1. **Basic Integration**
   ```tsx
   <FeeSavingsWidget />
   ```

2. **Add to Navigation**
   ```tsx
   <Link href="/remittance/savings">See Savings</Link>
   ```

3. **Customize Styling**
   ```tsx
   <FeeSavingsWidget className="custom-class" />
   ```

4. **Monitor Usage**
   - Track user interactions
   - Analyze export patterns
   - Measure conversion impact

---

**Ready to implement?** Start with the basic integration and customize as needed! 🚀
