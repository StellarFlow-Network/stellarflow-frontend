# Fee Savings Widget - Implementation Guide

## Overview

The **Fee Savings Widget** is an interactive comparison tool that shows real-time remittance fee savings when using StellarFlow versus traditional Money Transfer Operators (MTOs) like Western Union, MoneyGram, Wise, and Remitly.

## Features

### 1. Real-time Comparison Widget
- **Live calculations** based on transfer amount and destination currency
- **Visual comparison cards** showing fees, effective costs, and recipient amounts
- **Interactive provider selection** to compare against specific MTOs
- **Color-coded visual hierarchy** highlighting StellarFlow's advantages

### 2. Interactive Slider
- **Dynamic transfer amount** from $50 to $5,000
- **Real-time updates** as slider moves
- **Visual gradient** showing slider progress
- **Responsive calculations** updating all comparison metrics instantly

### 3. Exportable Fee Breakdown
Two export formats available:

#### CSV Export
- Structured data format for spreadsheet analysis
- Includes all provider comparisons
- Fields: Provider, Send Amount, Flat Fee, Percentage Fee, Total Fee, Recipient Gets, Effective Cost %, Settlement Time
- Filename format: `fee-comparison-{currency}-{amount}-{timestamp}.csv`

#### Receipt Export
- Human-readable text format
- Detailed breakdown of StellarFlow costs
- Complete competitor comparison
- Projected savings calculations
- Formatted for printing or email
- Filename format: `stellarflow-savings-receipt-{timestamp}.txt`

## Component Structure

### FeeSavingsWidget.tsx

Located at: `src/components/remittance/FeeSavingsWidget.tsx`

#### Props Interface
```typescript
interface FeeSavingsWidgetProps {
  className?: string;
  defaultAmount?: number; // Default: 500
}
```

#### Key Internal Types
```typescript
interface MtoProfile {
  provider: string;
  flatFeeUsd: number;
  pctFee: number;
  fxMarginPct: number;
  settlementTime: string;
  isStellarFlow?: boolean;
  color?: string;
}

interface ComparisonResult extends MtoProfile {
  totalFee: number;
  recipientGets: number;
  effectiveFeePct: number;
  savingsVsStellarFlow?: number;
}
```

## Usage

### Basic Usage

```tsx
import { FeeSavingsWidget } from "@/components/remittance";

export default function MyPage() {
  return <FeeSavingsWidget />;
}
```

### With Custom Default Amount

```tsx
<FeeSavingsWidget defaultAmount={1000} />
```

### With Custom Styling

```tsx
<FeeSavingsWidget 
  className="max-w-4xl mx-auto my-8" 
  defaultAmount={250}
/>
```

## Fee Calculation Logic

### Total Fee Calculation
```
totalFee = flatFeeUsd + (sendAmount × pctFee / 100)
```

### Net Send Amount
```
netSendUsd = sendAmount - totalFee
```

### Effective Exchange Rate
```
effectiveRate = midRate × (1 - fxMarginPct)
```

### Recipient Amount
```
recipientGets = netSendUsd × effectiveRate
```

### Effective Fee Percentage
```
effectiveFeePct = (totalFee / sendAmount × 100) + (fxMarginPct × 100)
```

### Savings vs StellarFlow
```
savingsVsStellarFlow = competitorTotalFee - stellarFlowTotalFee
```

## MTO Fee Profiles

Fee structures based on publicly documented rates:

| Provider | Flat Fee | % Fee | FX Margin | Settlement Time |
|----------|----------|-------|-----------|-----------------|
| **StellarFlow** | $0.50 | 0.1% | 0.1% | Seconds |
| Western Union | $4.99 | 1.5% | 2.0% | Minutes – 1 day |
| MoneyGram | $3.99 | 1.2% | 2.5% | Minutes – 1 day |
| Wise | $1.50 | 0.6% | 0.4% | 1 – 2 days |
| Remitly | $2.99 | 0.9% | 1.5% | Minutes – 3 days |

## Supported Currencies

- **EUR** - Euro (Eurozone)
- **NGN** - Nigerian Naira (Nigeria)
- **BRL** - Brazilian Real (Brazil)
- **KES** - Kenyan Shilling (Kenya)

## Savings Projection Periods

The widget calculates projected savings over multiple timeframes:

1. **Per Transfer** - Single transfer savings
2. **Bi-weekly** - 2 transfers
3. **Monthly** - 4 transfers
4. **Quarterly** - 12 transfers
5. **Bi-annually** - 24 transfers
6. **Annually** - 52 transfers (weekly)

## Export Functionality

### CSV Export Function
```typescript
const exportBreakdown = useCallback(() => {
  const rows = [
    ["Provider", "Send Amount (USD)", "Flat Fee", ...],
    ...comparisonResults.map(result => [...])
  ];
  
  const csvContent = rows.map(row => row.join(",")).join("\n");
  // Create blob and trigger download
}, [comparisonResults, sendAmount, currency]);
```

### Receipt Export Function
```typescript
const exportReceipt = useCallback(() => {
  const content = `
  ═══════════════════════════════════════════════
            STELLARFLOW FEE SAVINGS SUMMARY
  ═══════════════════════════════════════════════
  // ... detailed receipt content
  `;
  // Create blob and trigger download
}, [...dependencies]);
```

## Styling & Design

### Color Scheme
- **Primary (StellarFlow)**: Emerald (emerald-400, emerald-500)
- **Comparison Selected**: Blue (blue-500, blue-950)
- **Warning/Cost**: Amber/Orange
- **Savings**: Emerald/Green
- **Expense**: Red
- **Background**: Neutral (900-950)

### Responsive Breakpoints
- **Mobile**: Single column cards, stacked layout
- **Tablet (sm:)**: 2-column comparison grid
- **Desktop (md:)**: 3-column savings projections

### Key Visual Elements
- **Gradient backgrounds** for visual hierarchy
- **Border highlights** for interactive states
- **Icon integration** (Lucide React)
- **Color-coded metrics** for quick scanning
- **Badge indicators** for best rates

## Integration Points

### Required Hooks
```typescript
import { useFxRatesWithFallback } from "@/app/hooks/useFxRates";
```

### Type Dependencies
```typescript
import type { FxCurrencyCode } from "@/types/fxRates";
```

## Testing

### Test IDs
- Main container: `fee-savings-widget`

### Storybook Stories

Located at: `src/components/remittance/FeeSavingsWidget.stories.tsx`

Stories:
1. **Default** - $500 transfer
2. **SmallTransfer** - $100 transfer
3. **LargeTransfer** - $5,000 transfer
4. **TypicalRemittance** - $200 transfer
5. **MidRangeTransfer** - $1,000 transfer

### Manual Testing Checklist

- [ ] Slider moves smoothly from $50 to $5,000
- [ ] All calculations update in real-time
- [ ] Currency selector switches correctly
- [ ] Provider cards highlight on selection
- [ ] CSV export downloads with correct data
- [ ] Receipt export formats properly
- [ ] Savings projections calculate correctly
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Color coding is clear and accessible

## Accessibility

### Features
- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators on all interactive elements
- Sufficient color contrast ratios
- Screen reader friendly text

### Keyboard Navigation
- **Tab** - Navigate between interactive elements
- **Enter/Space** - Select currency or provider
- **Arrow keys** - Adjust slider value

## Performance Considerations

### Optimizations
- `useMemo` for expensive calculations
- `useCallback` for export functions
- Conditional rendering for projections
- Efficient re-renders on state changes

### Calculation Complexity
- O(n) for comparison results (n = number of MTOs)
- O(1) for savings projections (fixed array)
- No expensive operations in render path

## Demo Page

A full demonstration page is available at:
```
/remittance/savings
```

Location: `src/app/remittance/savings/page.tsx`

### Page Features
- Hero section with value proposition
- Integrated FeeSavingsWidget
- Benefits grid (Lightning Fast, Transparent Fees, Real Savings)
- How It Works comparison table
- Call-to-action section

### Metadata
```typescript
export const metadata: Metadata = {
  title: "Fee Savings Calculator | StellarFlow",
  description: "Calculate your savings with StellarFlow vs traditional remittance providers..."
};
```

## Best Practices

### When to Use
- ✅ Marketing pages showing value proposition
- ✅ Remittance flow onboarding
- ✅ Educational content about fees
- ✅ Landing pages for remittance features

### When NOT to Use
- ❌ During actual transaction flow (use simpler summary)
- ❌ In confined mobile spaces (too much information)
- ❌ For non-remittance features

### Customization Tips
1. Adjust `MTO_PROFILES` with current fee data
2. Modify `CURRENCIES` array for additional corridors
3. Update color scheme via Tailwind classes
4. Add new savings projection periods as needed
5. Customize export formats for branding

## Future Enhancements

### Potential Additions
- [ ] Historical fee tracking over time
- [ ] Multi-currency comparison (send from different bases)
- [ ] Integration with user transaction history
- [ ] Personalized savings reports
- [ ] Social sharing of savings
- [ ] Animated transitions for calculations
- [ ] PDF export in addition to CSV/TXT
- [ ] Comparison chart visualization (Chart.js)
- [ ] Email delivery of receipts
- [ ] Bookmark/save custom configurations

## Dependencies

### Core
- React 19.2.3
- Next.js 16.3.3
- TypeScript 5.x

### UI & Icons
- Lucide React 1.6.0 (icons)
- Tailwind CSS 4.x (styling)

### Internal
- `@/app/hooks/useFxRates` (FX rate data)
- `@/types/fxRates` (type definitions)

## Troubleshooting

### Common Issues

#### 1. Calculations Not Updating
- **Cause**: Missing dependencies in `useMemo`
- **Solution**: Verify `sendAmount` and `midRate` are in dependency array

#### 2. Export Not Working
- **Cause**: Browser blocking downloads
- **Solution**: Check browser permissions, ensure blob URLs are created correctly

#### 3. Slider Not Responsive
- **Cause**: CSS styles not applied correctly
- **Solution**: Verify Tailwind classes, check for conflicting styles

#### 4. Currency Rates Showing 0
- **Cause**: FX rates hook not returning data
- **Solution**: Check `useFxRatesWithFallback` implementation, verify API connection

## Support & Maintenance

### Updating Fee Structures
When MTO fees change:
1. Update `MTO_PROFILES` array
2. Update documentation table
3. Run Storybook tests
4. Verify exports contain new data

### Adding New Currencies
1. Add to `FxCurrencyCode` type in `@/types/fxRates`
2. Add to `CURRENCIES` array
3. Add to `CURRENCY_NAMES` mapping
4. Verify FX rates API supports new currency
5. Test calculations with new currency

### Monitoring
- Track export download rates
- Monitor slider interaction patterns
- Analyze most compared MTOs
- Review currency selection distribution

## License & Legal

### Disclaimers
The widget includes appropriate disclaimers about:
- Fee estimates being illustrative
- Third-party fees varying by circumstances
- Not being financial advice
- Using publicly documented fee ranges

### Compliance
- Transparent fee disclosure
- Accurate competitor comparisons
- Clear data sourcing
- No misleading claims

## Related Documentation

- [Remittance Components](./REMITTANCE_COMPONENTS.md)
- [FX Rates System](./FX_RATES_SYSTEM.md)
- [Export Utilities](./EXPORT_UTILITIES.md)
- [Comparison Tables](./COMPARISON_TABLES.md)

---

**Last Updated**: 2026-08-28  
**Version**: 1.0.0  
**Maintainer**: StellarFlow Team
