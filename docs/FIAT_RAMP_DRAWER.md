# Fiat Ramp Drawer Component

## Overview

The `FiatRampDrawer` component provides a unified interface for users to choose their preferred fiat on-ramp provider (MoonPay, Transak, Local Anchors) based on payment method preferences and fee structures.

## Features

- **Payment Method Filters**: Support for Credit Card, Bank Transfer, Apple Pay, and Mobile Money
- **Provider Comparison**: Real-time fee calculation and net received amount display
- **Smart Ranking**: Providers ranked by best net value for selected payment method
- **Secure Redirect**: Pre-filled Stellar wallet public key passed to provider widget
- **Persistent Preferences**: User's preferred payment method saved to local storage
- **Responsive Design**: Slide-out drawer interface optimized for all screen sizes

## Usage

```typescript
import { FiatRampDrawer } from '@/components/remittance';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const walletAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

  return (
    <FiatRampDrawer
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      walletAddress={walletAddress}
      defaultCurrency="USDC"
      defaultAmount={100}
      onProviderSelected={(provider, method) => {
        console.log(`User selected ${provider} with ${method}`);
      }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls drawer visibility |
| `onClose` | `() => void` | Yes | Callback when drawer is closed |
| `walletAddress` | `string` | Yes | Stellar public key for deposit destination |
| `defaultCurrency` | `string` | No | Pre-selected asset code (default: 'USDC') |
| `defaultAmount` | `number` | No | Pre-filled purchase amount (default: 100) |
| `onProviderSelected` | `(provider, method) => void` | No | Callback when provider is selected |

## Payment Methods

- **Credit/Debit Card**: Fast processing, higher fees (3.5-4.5%)
- **Bank Transfer**: Lower fees (0.5-1.0%), slower processing
- **Apple Pay**: Instant, similar fees to credit cards
- **Mobile Money**: Regional support, competitive fees (1.5-2.5%)

## Provider Options

### MoonPay
- **Best For**: Global availability, credit card purchases
- **Processing Fee**: 4.5% (card), 1.0% (bank)
- **Network Fee**: $2.99-$3.99
- **Delivery Time**: 5-10 minutes
- **Trust Score**: 4.8/5

### Transak
- **Best For**: Local payment methods, lower fees
- **Processing Fee**: 3.5% (card), 0.99% (bank)
- **Network Fee**: $1.99-$2.99
- **Delivery Time**: 10-30 minutes
- **Trust Score**: 4.6/5

### Local Anchors
- **Best For**: Community-powered, lowest fees
- **Processing Fee**: 0.5% (bank), 1.5% (mobile)
- **Network Fee**: $0.50-$1.00
- **Delivery Time**: 30-60 minutes
- **Trust Score**: 4.3/5

## Fee Calculation

The component automatically calculates:
- Processing fee (percentage-based)
- Network fee (fixed amount)
- Total fee
- Net received amount

Providers are ranked by highest net received amount for optimal user value.

## Local Storage

The component persists the user's preferred payment method:

```javascript
localStorage.setItem('fiat_ramp_preferred_payment_method', 'credit_card');
```

This preference is automatically loaded on subsequent sessions.

## Security

- All redirects open in new windows with `noopener,noreferrer`
- Wallet addresses are validated before redirect
- Provider widgets run in sandboxed iframes
- No custody of user funds

## Acceptance Criteria

✅ Provider drawer displays accurate ranking based on selected currency and payment method  
✅ Redirect URL includes valid user Stellar public key target parameter  
✅ Payment method preference saved to local application settings  
✅ Fee calculations update dynamically based on amount and method  
✅ Clean, responsive UI with accessibility support

## Integration Examples

### With Wallet Connection
```typescript
const { publicKey } = useWallet();

<FiatRampDrawer
  isOpen={showFiatRamp}
  walletAddress={publicKey}
  onClose={() => setShowFiatRamp(false)}
/>
```

### With Custom Amount
```typescript
<FiatRampDrawer
  isOpen={true}
  walletAddress={address}
  defaultAmount={500}
  defaultCurrency="XLM"
  onClose={handleClose}
/>
```

## Testing

Run Storybook to view interactive examples:

```bash
npm run storybook
```

Navigate to: `Remittance/FiatRampDrawer`
