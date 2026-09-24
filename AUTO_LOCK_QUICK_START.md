# Auto-Lock Security Timer - Quick Start Guide

> **TL;DR**: Auto-lock security timer is already integrated. Users can configure timeout in Settings. Developers can reset timer after sensitive operations.

## For End Users 👤

### Configuring Auto-Lock

1. Go to **Settings** page
2. Find **Auto-Lock Security** section
3. Choose your timeout:
   - **15 minutes** - Maximum security (shared computers)
   - **30 minutes** - Balanced (recommended) ⭐
   - **1 hour** - Extended sessions
   - **Never** - Disabled (not recommended)

### What Happens When Inactive?

1. **After [timeout - 60s]**: Warning modal appears with countdown
2. **User Options**:
   - Click **"Extend Session"** to continue
   - Click **"Dismiss"** to hide modal (still disconnects)
   - Do nothing - auto-disconnect after 60 seconds
3. **On Disconnect**:
   - Wallet disconnects automatically
   - All tokens and session data cleared
   - Must reconnect wallet to continue

### Activity Detection

These actions reset the timer:
- ✅ Moving the mouse
- ✅ Typing on keyboard
- ✅ Clicking anywhere
- ✅ Touching screen (mobile)

These do NOT reset during warning:
- ❌ Activity after warning appears
- ❌ Mouse movement during countdown
- 💡 Must click "Extend Session" button

## For Developers 👨‍💻

### Quick Integration (Already Done!)

The SessionTimeoutManager is already integrated in `src/app/layout.tsx`:

```tsx
<WalletSessionProvider>
  <SessionTimeoutManager>
    <ScreenLockProvider>
      {children}
    </ScreenLockProvider>
  </SessionTimeoutManager>
</WalletSessionProvider>
```

### Resetting Timer After Sensitive Actions

```typescript
import { useSessionTimeout } from '@/components/security/SessionTimeoutManager';

function TransactionComponent() {
  const { resetTimer } = useSessionTimeout();

  const handleSignTransaction = async () => {
    await signTransaction();
    resetTimer(); // ✅ Reset inactivity timer
  };

  return <button onClick={handleSignTransaction}>Sign</button>;
}
```

### Checking Current Configuration

```typescript
import { useSessionTimeout } from '@/components/security/SessionTimeoutManager';

function SecurityStatus() {
  const { autoLockDuration, isWarningActive } = useSessionTimeout();

  return (
    <div>
      <p>Auto-lock: {autoLockDuration} minutes</p>
      {isWarningActive && <p>⚠️ Session expiring soon!</p>}
    </div>
  );
}
```

### Programmatic Configuration

```typescript
const { setAutoLockDuration } = useSessionTimeout();

// Set to 15 minutes
setAutoLockDuration(15);

// Disable auto-lock
setAutoLockDuration("never");
```

## File Structure 📁

```
src/
├── components/security/
│   ├── SessionTimeoutManager.tsx    # Main timeout logic
│   ├── AutoLockSettings.tsx         # Settings UI component
│   ├── index.ts                     # Barrel exports
│   └── ScreenLockModal.tsx          # PIN-based screen lock
├── context/
│   └── WalletContext.tsx            # Base wallet session provider
├── app/
│   ├── layout.tsx                   # Integration point ⚠️
│   └── settings/
│       └── page.tsx                 # Settings page with AutoLockSettings
└── docs/
    └── AUTO_LOCK_SECURITY.md        # Full documentation
```

## Common Use Cases 🎯

### Use Case 1: Transaction Signing

```typescript
const { resetTimer } = useSessionTimeout();

await freighter.signTransaction(xdr);
resetTimer(); // Keep session alive after signing
```

### Use Case 2: Conditional Security Enforcement

```typescript
const { autoLockDuration, setAutoLockDuration } = useSessionTimeout();

if (isSharedComputer) {
  setAutoLockDuration(15); // Force 15-minute timeout
}
```

### Use Case 3: Warning Detection

```typescript
const { isWarningActive, warningSecondsRemaining } = useSessionTimeout();

if (isWarningActive) {
  showNotification(`Session expires in ${warningSecondsRemaining}s`);
}
```

## Customizing Token Purge 🔧

Update `purgeAuthTokens()` in `SessionTimeoutManager.tsx`:

```typescript
function purgeAuthTokens(): void {
  // Add your custom token cleanup
  window.localStorage.removeItem('your-jwt-key');
  window.sessionStorage.clear();
  
  // Clear cookies
  document.cookie.split(";").forEach((cookie) => {
    const [name] = cookie.split("=");
    if (name.includes("auth")) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  });
  
  // Clear your state management
  authStore.clear();
}
```

## Testing Checklist ✅

- [ ] Warning modal appears at correct time
- [ ] Countdown displays accurate seconds
- [ ] "Extend Session" button resets timer
- [ ] Session disconnects after warning expires
- [ ] JWT tokens are cleared
- [ ] Wallet disconnects properly
- [ ] Preference persists after reload
- [ ] "Never" option disables auto-lock

## Acceptance Criteria (from Spec) ✨

- [x] Inactivity timer triggers warning modal accurately after configured timeout duration
- [x] Session disconnect purges private session memory and updates UI wallet header badge
- [x] 60-second warning countdown modal displayed before disconnect
- [x] "Extend Session" button resets inactivity timer
- [x] JWT tokens automatically purged on disconnect
- [x] User preferences saved (15m, 30m, 1h, Never)
- [x] Mouse and keyboard activity detection with throttling

## Quick Troubleshooting 🔍

| Issue | Solution |
|-------|----------|
| Timer not resetting | Check if `useSessionTimeout()` is inside `SessionTimeoutManager` |
| Tokens not cleared | Update `purgeAuthTokens()` with your JWT keys |
| Warning not showing | Verify `isWarningActive` state in component tree |
| Preference not saving | Check localStorage permissions (private browsing?) |

## Security Recommendations 🛡️

| Environment | Recommended Setting |
|-------------|---------------------|
| Public/Shared Computer | 15 minutes |
| Personal Workstation | 30 minutes |
| Private Device | 1 hour |
| Development | Never (testing only) |

## Next Steps 📚

- Read full documentation: `docs/AUTO_LOCK_SECURITY.md`
- Review wallet context: `src/context/WalletContext.tsx`
- Check security settings: `/settings` page
- Test disconnect flow in staging

---

**Quick Links:**
- 📖 [Full Documentation](./docs/AUTO_LOCK_SECURITY.md)
- 🔐 [Settings Page](/settings)
- 🧪 [Testing Guide](./docs/AUTO_LOCK_SECURITY.md#testing)
- 🐛 [Troubleshooting](./docs/AUTO_LOCK_SECURITY.md#troubleshooting)
