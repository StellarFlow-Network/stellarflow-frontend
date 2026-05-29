# Error Timeout Management - StellarFlow Frontend

## Overview

This feature implements automatic timeout-based clearing of network error states to prevent stale errors from lingering in the application state and causing unnecessary fallback checks or misleading error displays.

## Problem Statement

Previously, when network errors occurred (WebSocket disconnections, API failures), the error state would persist until:
- A successful connection/request was made
- The component was unmounted/remounted

This caused the UI to display outdated error messages and the application logic to perform unnecessary fallback checks even after the network issue had resolved.

## Solution

### New Hook: `useErrorTimeout`

Located in: [`src/app/hooks/useErrorTimeout.ts`](src/app/hooks/useErrorTimeout.ts)

A custom React hook that manages error state with automatic timeout-based clearing.

#### API

```typescript
interface UseErrorTimeoutOptions {
  /**
   * Timeout in milliseconds before automatically clearing the error.
   * Set to 0 to disable auto-clear (error must be manually cleared).
   * @default 5000
   */
  timeoutMs?: number
}

interface UseErrorTimeoutReturn {
  error: string | null
  setError: (error: string | null) => void
  clearError: () => void
}

function useErrorTimeout(options?: UseErrorTimeoutOptions): UseErrorTimeoutReturn
```

#### Usage Example

```typescript
const { error, setError, clearError } = useErrorTimeout({ timeoutMs: 5000 })

try {
  await fetchData()
} catch (err) {
  setError('Failed to fetch data')  // Auto-clears after 5 seconds
}

// Or manually clear
clearError()
```

#### Features

- **Automatic clearing**: Errors automatically clear after the specified timeout (default: 5000ms)
- **Configurable timeout**: Set `timeoutMs` to any value, or `0` to disable auto-clear
- **Prevents stale errors**: New errors cancel previous timeouts automatically
- **Explicit clearing**: Call `clearError()` to manually clear errors immediately
- **Cleanup on unmount**: Automatically clears pending timeouts when component unmounts

### Updated Components

#### 1. **useSocket Hook**
- **File**: [`src/app/hooks/useSocket.ts`](src/app/hooks/useSocket.ts)
- **Changes**:
  - Added `errorTimeoutMs` option to `UseSocketOptions` (default: 5000ms)
  - Replaced `useState` error with `useErrorTimeout` hook
  - WebSocket errors now auto-clear after 5 seconds if not replaced by a new error or successful connection

#### 2. **Map Component**
- **File**: [`src/app/components/Map.tsx`](src/app/components/Map.tsx)
- **Changes**:
  - Replaced `useState` error with `useErrorTimeout` hook (5000ms timeout)
  - Map loading errors now auto-clear after 5 seconds

#### 3. **PriceFeedCard Component**
- **File**: [`src/app/components/PriceFeedCard.tsx`](src/app/components/PriceFeedCard.tsx)
- **Changes**:
  - Replaced `useState` error with `useErrorTimeout` hook (5000ms timeout)
  - Price feed fetch errors now auto-clear after 5 seconds
  - WebSocket errors in the card now also benefit from auto-clearing

## Configuration

### Default Timeout Values

All components use a **5-second (5000ms)** timeout by default. This can be customized:

```typescript
// In useSocket
const { error } = useSocket({ 
  errorTimeoutMs: 10000  // Clear errors after 10 seconds
})

// In Map component (update the hook call)
const { error, setError } = useErrorTimeout({ timeoutMs: 10000 })

// In PriceFeedCard (update the hook call)
const { error, setError } = useErrorTimeout({ timeoutMs: 10000 })
```

## Error Lifecycle

### When Error is Set
1. Previous timeout (if any) is cancelled
2. Error state is updated
3. New timeout is scheduled (unless `timeoutMs` is 0)

### When Timeout Completes
1. Error is automatically cleared from state
2. Component re-renders with `error === null`
3. UI fallback states are cleared (if conditional on error)

### When New Error Occurs Before Timeout
1. Previous timeout is cancelled
2. New error replaces the old one
3. New timeout is scheduled

### When Connection Succeeds
1. Error is explicitly set to `null` (e.g., `wsRef.current.onopen`)
2. Previous timeout is cancelled
3. No new timeout is scheduled

## Benefits

✅ **Improved UX**: Stale error messages don't linger after network issues resolve
✅ **Reduced API Calls**: Fewer unnecessary fallback/retry attempts
✅ **Cleaner State Management**: Automatic cleanup prevents memory leaks
✅ **Configurable**: Each use case can have its own timeout value
✅ **Reusable**: The `useErrorTimeout` hook can be used throughout the app

## Testing

### Manual Testing

1. **WebSocket errors**: Disconnect network and reconnect; error should clear after 5 seconds
2. **Map errors**: Provide invalid geojson URL; error should clear after 5 seconds
3. **API errors**: Temporarily disable API endpoint; error should clear after 5 seconds

### Example Test Component

```typescript
import { useErrorTimeout } from '../hooks/useErrorTimeout'

export function TestErrorTimeout() {
  const { error, setError, clearError } = useErrorTimeout({ timeoutMs: 3000 })

  return (
    <div>
      {error && <p>Error: {error}</p>}
      <button onClick={() => setError('Test error')}>Set Error</button>
      <button onClick={() => clearError()}>Clear Error</button>
    </div>
  )
}
```

## Related Files

- Core implementation: [`src/app/hooks/useErrorTimeout.ts`](src/app/hooks/useErrorTimeout.ts)
- WebSocket integration: [`src/app/hooks/useSocket.ts`](src/app/hooks/useSocket.ts)
- Map component: [`src/app/components/Map.tsx`](src/app/components/Map.tsx)
- Price feed component: [`src/app/components/PriceFeedCard.tsx`](src/app/components/PriceFeedCard.tsx)

## Future Enhancements

- Add exponential backoff for retries
- Implement error retry buttons with auto-reset
- Create error queue for batch processing
- Add analytics tracking for error occurrences
- Implement different timeout values for different error types
