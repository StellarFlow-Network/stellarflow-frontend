# Voting Power Calculator

## Overview

The Voting Power Calculator is an interactive component that allows users to preview their governance voting power and yield multiplier boost based on locked FLOW token amounts and lock durations.

## Features

### 1. **Interactive Sliders**
- **FLOW Token Amount Slider**: Adjustable from 0 to 100,000 FLOW
  - Step increment: 100 FLOW
  - Real-time balance validation
  - Visual indication of user's available balance
  
- **Lock Duration Slider**: Adjustable from 1 week to 4 years (208 weeks)
  - Continuous adjustment with live preview
  - Human-readable duration formatting (weeks, months, years)
  - Quick preset buttons for common durations

### 2. **Visual Gauge**
- **Circular Progress Gauge**: Real-time visualization of voting power percentage
  - Gradient stroke effect (purple → blue → cyan)
  - Animated transitions on value changes
  - Shows voting power as percentage of total veFLOW supply
  - Displays percentage value with precision handling (< 0.01% for very small amounts)

### 3. **Calculated Metrics**
The calculator displays three key metrics:

#### veFLOW Balance
- Calculated as: `FLOW Amount × Multiplier`
- Shows the effective veFLOW tokens received
- Updates in real-time as sliders change

#### Power Multiplier
- Linear scaling from **1x** (1 week) to **4x** (4 years)
- Formula: `1 + (weeks / 208) × 3`
- Determines both voting power and yield boost

#### Yield Boost
- Same multiplier applied to vault rewards
- Range: 1x to 4x
- Incentivizes longer lock periods

### 4. **Smart Validations**
- Balance checking when `userBalance` prop is provided
- Visual warning when amount exceeds available balance
- Disabled lock button for invalid states
- Clear error messaging

### 5. **Quick Duration Presets**
Convenient buttons for common lock periods:
- 1 Month (4 weeks)
- 6 Months (26 weeks)
- 1 Year (52 weeks)
- 2 Years (104 weeks)
- Max - 4 Years (208 weeks)

## Usage

### Basic Usage

```tsx
import { VotingPowerCalculator } from '@/components/governance';

function GovernancePage() {
  return (
    <VotingPowerCalculator
      totalVeSupply={10_000_000}
      onLockTokens={(amount, weeks) => {
        console.log(`Locking ${amount} FLOW for ${weeks} weeks`);
      }}
    />
  );
}
```

### With User Balance Validation

```tsx
import { VotingPowerCalculator } from '@/components/governance';
import { useWallet } from '@/hooks/useWallet';

function GovernancePage() {
  const { balance } = useWallet();
  
  const handleLock = async (amount: number, durationWeeks: number) => {
    // Call smart contract to lock tokens
    await lockTokensInContract(amount, durationWeeks);
  };
  
  return (
    <VotingPowerCalculator
      totalVeSupply={10_000_000}
      userBalance={balance}
      onLockTokens={handleLock}
    />
  );
}
```

### Read-Only Mode (No Lock Action)

```tsx
import { VotingPowerCalculator } from '@/components/governance';

function GovernanceInfoPage() {
  // Without onLockTokens prop, the lock button won't render
  return (
    <VotingPowerCalculator
      totalVeSupply={10_000_000}
      userBalance={50_000}
    />
  );
}
```

## Props

### VotingPowerCalculatorProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `totalVeSupply` | `number` | No | `10_000_000` | Total veFLOW supply in the system (for calculating voting power %) |
| `userBalance` | `number` | No | `undefined` | User's current FLOW balance (enables validation) |
| `onLockTokens` | `(amount: number, durationWeeks: number) => void` | No | `undefined` | Callback when user confirms token lock. If omitted, lock button won't render |

## Calculations

### Multiplier Formula

The veFLOW multiplier scales linearly from 1x to 4x:

```typescript
multiplier = 1 + (lockWeeks / 208) × 3
```

Examples:
- 1 week: 1.01x multiplier
- 52 weeks (1 year): 2.00x multiplier
- 104 weeks (2 years): 3.00x multiplier
- 208 weeks (4 years): 4.00x multiplier

### veFLOW Balance

```typescript
veFlowBalance = flowAmount × multiplier
```

### Voting Power Percentage

```typescript
votingPowerPercent = (veFlowBalance / totalVeSupply) × 100
```

### Yield Boost

The yield boost multiplier is identical to the voting power multiplier and is applied to vault rewards:

```typescript
yieldBoost = multiplier
```

## Styling

The component uses Tailwind CSS with custom slider styles defined in `globals.css`:

### Custom Slider Thumb
- Gradient background (blue → purple)
- Glow effect on hover
- Smooth transitions
- Accessible focus states

### Color Scheme
- Background: Dark theme (`#0d1117`)
- Accents: Blue, purple, cyan gradients
- Borders: Gray with subtle opacity
- Text: High contrast white/gray

## Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigable sliders
- Clear visual feedback for interactions
- Color contrast meets WCAG AA standards
- Focus visible indicators

## Performance Optimizations

- **Memoized calculations** using `useMemo` to prevent unnecessary recalculations
- **Callback memoization** with `useCallback` for stable function references
- **CSS containment** for animation isolation
- **GPU-accelerated animations** via CSS transforms
- **Debounced slider updates** (native browser behavior)

## Responsive Design

The component is fully responsive:
- Desktop: Two-column layout (sliders | gauge)
- Mobile: Stacked single-column layout
- Metrics grid adapts from 3 columns to 1 column
- Touch-friendly slider controls

## Testing

Comprehensive test coverage includes:
- Slider interactions
- Preset button functionality
- Balance validation
- Callback invocation
- Metric calculations
- Conditional rendering
- Error states

Run tests:
```bash
npm test -- VotingPowerCalculator
```

## Storybook

Interactive Storybook stories are available for development and design review:

```bash
npm run storybook
```

Available stories:
- Default configuration
- With user balance validation
- Whale scenario (high token amounts)
- Low supply scenario
- Read-only mode
- High competition scenario

## Integration Example

Complete integration with governance system:

```tsx
import { VotingPowerCalculator } from '@/components/governance';
import { useGovernance } from '@/hooks/useGovernance';
import { useWallet } from '@/hooks/useWallet';
import { toast } from '@/lib/toast';

export function GovernanceCalculatorPage() {
  const { totalVeSupply, lockTokens } = useGovernance();
  const { balance, isConnected } = useWallet();
  
  const handleLockTokens = async (amount: number, weeks: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }
    
    try {
      toast.loading('Locking tokens...');
      await lockTokens(amount, weeks);
      toast.success(`Successfully locked ${amount} FLOW for ${weeks} weeks`);
    } catch (error) {
      toast.error('Failed to lock tokens');
      console.error(error);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <VotingPowerCalculator
        totalVeSupply={totalVeSupply}
        userBalance={balance}
        onLockTokens={handleLockTokens}
      />
    </div>
  );
}
```

## Related Components

- **VeLockForm**: Full form for creating and managing token locks
- **HealthFactorGauge**: Similar gauge visualization for vault health
- **ProposalList**: Display governance proposals to vote on
- **VoteModal**: Modal for casting votes with veFLOW power

## Future Enhancements

Potential improvements:
- Historical voting power chart
- Expected decay visualization over time
- Comparison with other users' voting power
- APY calculator integration
- Auto-relock option
- Mobile app integration
- Push notifications for lock expiry

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Part of StellarFlow Frontend - see LICENSE file for details.
