# IndexedDB Cache Manager

## Cache policy

| Store | Default TTL | Typical contents |
|---|---:|---|
| `price_history` | 1 hour | Historical candles and price points |
| `pool_data` | 5 minutes | Pool metadata, reserves, and snapshots |
| `token_lists` | 24 hours | Token metadata and supported asset lists |

TTL values are defaults. Callers may provide a per-write or per-revalidation TTL override.

## Stale-while-revalidate flow

1. Read the record from IndexedDB.
2. Return a fresh record immediately without making a network request.
3. If the record is missing or stale, return the stale value when available.
4. Start a background request.
5. Persist the fresh response.
6. Invoke `onUpdate` so the existing application state can update in place.
7. Deduplicate simultaneous requests for the same store/key pair.

The cache should not replace the UI's in-memory state. It is a persistence layer that can fail, be cleared, or be evicted by the browser.

## Avoiding visual shifts

The cache manager does not directly mutate React state. Integrating hooks should:

- Keep the cached value as the initial data.
- Preserve the existing data shape when fresh data arrives.
- Update data in place rather than resetting loading state.
- Avoid replacing layout-affecting metadata during background refresh.
- Use stable list keys.
- Use React Query's placeholder/initial-data mechanisms if React Query is the existing data layer.

## Quota inspection

`getStorageQuota()` uses `navigator.storage.estimate()` and returns approximate usage, quota, available bytes, and percentage used. These values are browser estimates, not exact physical database sizes.

## Failure handling

IndexedDB may be unavailable, blocked, cleared, evicted, or unable to write because of quota pressure. Callers should keep an in-memory/network fallback and should not treat IndexedDB as the authoritative source of financial or market data.

## Performance validation

Measure:

- Time from route navigation to first cached value.
- IndexedDB read duration.
- Revalidation duration.
- Main-thread long tasks.
- Layout shift score.
- Number of duplicate revalidation requests.
- Cache hit, stale-hit, miss, and error rates.

The 10 ms requirement must be verified on representative devices and browsers. Do not claim compliance based only on unit tests.
