# Account Switcher Dropdown Component

## Overview

The `AccountSwitcherDropdown` component provides a header dropdown interface that allows users with multi-account wallets to easily switch between active public key accounts without disconnecting from the wallet.

## Features

- **Multi-Account Display**: Shows all available accounts from connected wallet extension
- **Account Labels**: Display custom labels and truncated public keys
- **Balance Display**: Shows primary asset balance and USD equivalent per account
- **Active Account Indicator**: Highlights currently active account with checkmark
- **Quick Actions**: Copy address and view on explorer buttons
- **Add Account**: Trigger wallet key generation for new accounts
- **Instant Updates**: Switching account updates entire application state immediately

## Usage

```typescript
import { AccountSwitcherDropdown } from '@/components/navigation';

function Header() {
  const accounts = [
    {
      publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1',
      label: 'Main Account',
      balance: '1,234.56 XLM',
      balanceUSD: '123.45',
      isActive: true,
    },
    // ... more accounts
  ];

  const handleAccountSwitch = async (publicKey: string) => {
    // Update application state with new active account
    await updateActiveAccount(publicKey);
    // Refresh balances
    await refreshBalances();
  };

  return (
    <AccountSwitcherDropdown
      accounts={accounts}
      activeAccountKey={accounts[0].publicKey}
      onAccountSwitch={handleAccountSwitch}
      onAddAccount={handleAddNewAccount}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `accounts` | `WalletAccount[]` | Yes | Array of available wallet accounts |
| `activeAccountKey` | `string` | Yes | Public key of currently active account |
| `onAccountSwitch` | `(publicKey: string) => void \| Promise<void>` | Yes | Callback when switching accounts |
| `onAddAccount` | `() => void \| Promise<void>` | No | Callback to trigger new account creation |
| `isLoading` | `boolean` | No | Loading state during account operations |
| `className` | `string` | No | Optional CSS classes for styling |

## WalletAccount Interface

```typescript
interface WalletAccount {
  publicKey: string;      // Stellar public key (G...)
  label?: string;         // Custom account label
  balance: string;        // Primary asset balance (formatted)
  balanceUSD?: string;    // USD equivalent (formatted)
  isActive: boolean;      // Whether this is the active account
}
```

## Features in Detail

### Public Key Truncation

Public keys are automatically truncated for display:
- Default: `GXXX...XXXX` (4 chars prefix, 4 chars suffix)
- Hover tooltip shows full address
- Copy button provides one-click address copying

### Account Switching

When a user switches accounts:
1. `onAccountSwitch` callback is invoked with new public key
2. Application state updates to reflect new active account
3. All balance displays refresh automatically
4. Transaction history updates to new account
5. Dropdown closes on successful switch

### Adding New Accounts

The "Add New Account" button:
- Triggers wallet extension to generate new key pair
- Only appears if `onAddAccount` prop is provided
- Automatically refreshes account list after creation
- Closes dropdown on success

### Quick Actions

Each account row includes:
- **Copy Button**: Copies full public key to clipboard
- **Explorer Link**: Opens account on Stellar Expert in new tab
- Visual feedback on successful copy (checkmark animation)

## State Management Integration

### With Context API

```typescript
const { accounts, activeAccount, switchAccount } = useWallet();

<AccountSwitcherDropdown
  accounts={accounts}
  activeAccountKey={activeAccount.publicKey}
  onAccountSwitch={switchAccount}
/>
```

### With React Query

```typescript
const { data: accounts } = useQuery(['wallet-accounts'], fetchAccounts);
const { mutateAsync: switchAccount } = useMutation(updateActiveAccount);

<AccountSwitcherDropdown
  accounts={accounts}
  activeAccountKey={currentAccount}
  onAccountSwitch={async (key) => {
    await switchAccount(key);
    await queryClient.invalidateQueries(['balances']);
  }}
/>
```

## Styling & Theming

The component supports dark mode and uses Tailwind CSS classes:
- Light mode: Clean white backgrounds
- Dark mode: Gray-800/900 backgrounds
- Active account: Blue/Emerald highlights
- Hover states: Subtle gray transitions

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management
- Click-outside detection to close dropdown
- High contrast for active/inactive states

## Acceptance Criteria

✅ Switching account updates entire application state and balance displays instantly  
✅ Dropdown displays active balance per account accurately  
✅ Account labels and truncated public keys displayed clearly  
✅ "Add New Account" action triggers wallet key generation  
✅ Active account highlighted with checkmark icon  
✅ Copy and explorer actions work correctly  
✅ Dropdown closes when clicking outside

## Integration Example: Full Header

```typescript
function AppHeader() {
  const { accounts, activeAccount, switchAccount, addAccount } = useWallet();
  const { data: balances } = useBalances(activeAccount);

  return (
    <header className="flex items-center justify-between p-4">
      <Logo />
      
      <AccountSwitcherDropdown
        accounts={accounts.map(acc => ({
          publicKey: acc.publicKey,
          label: acc.label,
          balance: formatBalance(balances[acc.publicKey]?.xlm),
          balanceUSD: formatUSD(balances[acc.publicKey]?.usd),
          isActive: acc.publicKey === activeAccount,
        }))}
        activeAccountKey={activeAccount}
        onAccountSwitch={async (key) => {
          await switchAccount(key);
          toast.success('Account switched successfully');
        }}
        onAddAccount={async () => {
          await addAccount();
          toast.success('New account created');
        }}
      />
    </header>
  );
}
```

## Testing

Run Storybook to view interactive examples:

```bash
npm run storybook
```

Navigate to: `Navigation/AccountSwitcherDropdown`

## Wallet Extension Support

Compatible with:
- Freighter
- xBull
- Rabet
- Albedo
- Ledger (via account derivation paths)

Each wallet's account structure is normalized to the `WalletAccount` interface.
