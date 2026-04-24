# Design Document: Dynamic Secret Key Reload

## Overview

This feature introduces a centralized `SecretManager` module to the StellarFlow Next.js application. Currently, the Stellar Secret Key is read directly from `process.env.STELLAR_SECRET_KEY` at the call site. This design replaces that pattern with a singleton module that holds the key in memory, validates it, and supports hot-reloading via a secure admin HTTP endpoint — without restarting the server.

The design targets Next.js 16 (App Router) with TypeScript. It introduces no new runtime dependencies beyond the AWS SDK v3 client (optional, tree-shaken when unused) and a property-based testing library for correctness verification.

### Key Design Goals

- Single source of truth for the secret key in the Node.js process
- Atomic, race-condition-free key updates using a promise-based mutex
- Two key sources: AWS Secrets Manager (primary) and local encrypted file (fallback)
- Secure admin endpoint with bearer-token authorization
- Zero breaking changes to existing signing/transaction code

---

## Architecture

### High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js App Router (Node.js process)                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  secretManager.ts  (singleton)                           │   │
│  │                                                          │   │
│  │   inMemoryKey: string  ◄──── atomic swap on update       │   │
│  │   mutex: AsyncMutex                                      │   │
│  │                                                          │   │
│  │   getSecretKey()  ──► returns inMemoryKey (sync)         │   │
│  │   updateSecretKey(key)  ──► validate → lock → swap       │   │
│  │   reloadFromSource()  ──► fetch → validate → update      │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │                                               │
│        ┌────────┴────────┐                                      │
│        ▼                 ▼                                      │
│  ┌───────────┐   ┌──────────────────┐                          │
│  │ awsAdapter│   │ fileAdapter.ts   │                          │
│  │   .ts     │   │ (AES-256-GCM)    │                          │
│  └─────┬─────┘   └────────┬─────────┘                          │
│        │                  │                                     │
│        ▼                  ▼                                     │
│  AWS Secrets Mgr    Encrypted local file                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  POST /admin/reload-secret  (Route Handler)              │   │
│  │  verifyAdminToken() → secretManager.reloadFromSource()   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Existing signing / drip-execution code                  │   │
│  │  import { getSecretKey } from '@/lib/secretManager'      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Initialization

```
Server start
    │
    ▼
secretManager.ts module evaluated
    │
    ├─ read process.env.STELLAR_SECRET_KEY
    │       │
    │       ├─ absent/empty ──► throw StartupError (descriptive, no key value)
    │       │
    │       └─ present ──► validate via Validator
    │                           │
    │                           ├─ invalid ──► throw StartupError
    │                           │
    │                           └─ valid ──► store as inMemoryKey
    │
    └─ module ready; getSecretKey() available
```

### Data Flow: Hot Reload

```
POST /admin/reload-secret
    │
    ├─ verifyAdminToken(request)
    │       │
    │       ├─ missing/invalid ──► HTTP 401 (no key fetch)
    │       │
    │       └─ valid ──► continue
    │
    ▼
secretManager.reloadFromSource()
    │
    ├─ AWS_SECRET_ARN set?
    │       ├─ yes ──► awsAdapter.fetchKey()
    │       │               │
    │       │               ├─ success ──► rawKey
    │       │               └─ failure ──► retain inMemoryKey, return error
    │       │
    │       └─ no ──► fileAdapter.fetchKey()
    │                       │
    │                       ├─ success ──► rawKey
    │                       └─ failure ──► retain inMemoryKey, return error
    │
    ▼
Validator.validate(rawKey)
    │
    ├─ invalid ──► retain inMemoryKey, log failure (no key), return error
    │
    └─ valid ──► secretManager.updateSecretKey(rawKey)
                        │
                        ├─ acquire mutex
                        ├─ overwrite inMemoryKey
                        ├─ release mutex
                        └─ emit audit log (timestamp, adminId, "success")
    │
    └─ HTTP 200 { message: "Key reloaded successfully" }
```

---

## Components and Interfaces

### `src/lib/secretManager.ts`

The singleton module. Initialized once when the module is first imported.

```typescript
// Public interface
export function getSecretKey(): string
export async function updateSecretKey(newKey: string): Promise<UpdateResult>
export async function reloadFromSource(): Promise<ReloadResult>

// Internal
type UpdateResult = { success: true } | { success: false; error: string }
type ReloadResult = { success: true } | { success: false; error: string }
```

**Initialization behavior:**
- On module load, reads `process.env.STELLAR_SECRET_KEY`
- Validates via `Validator.validate()`
- Throws `SecretManagerInitError` if absent, empty, or invalid

**`getSecretKey()`:**
- Synchronous — reads the current `inMemoryKey` reference
- No locking needed (JS single-threaded reads; atomic reference swap on write)

**`updateSecretKey(newKey)`:**
- Validates the candidate key first (before acquiring the lock)
- If same as current key → returns `{ success: true }` immediately (no-op)
- Acquires the async mutex
- Overwrites `inMemoryKey`
- Releases mutex
- Emits audit log entry

**`reloadFromSource()`:**
- Selects adapter based on env vars
- Fetches raw key
- Calls `updateSecretKey()` with the result

---

### `src/lib/validator.ts`

```typescript
import { Keypair } from '@stellar/stellar-sdk'

export function validate(candidate: string): ValidationResult

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }  // reason never contains the key value
```

Uses `Keypair.fromSecret(candidate)` inside a try/catch. A valid Stellar secret key starts with `S` and passes the SDK's internal checksum. The `reason` field in failure results describes the structural problem (e.g., "does not begin with 'S'", "checksum failed") without echoing the candidate value.

---

### `src/lib/adapters/awsAdapter.ts`

```typescript
export async function fetchKey(): Promise<FetchResult>

type FetchResult =
  | { success: true; key: string }
  | { success: false; error: string }
```

- Uses `@aws-sdk/client-secrets-manager` (`GetSecretValueCommand`)
- Secret ARN read from `process.env.AWS_SECRET_ARN`
- Expects the secret value to be a plain string (the raw Stellar key)
- Errors are caught and returned as structured failures — never thrown to callers
- The fetched key is never logged

---

### `src/lib/adapters/fileAdapter.ts`

```typescript
export async function fetchKey(): Promise<FetchResult>
```

- Reads the encrypted file at `process.env.SECRET_FILE_PATH`
- Decrypts using AES-256-GCM with key material from `process.env.FILE_ENCRYPTION_KEY`
- File format: `<12-byte IV hex>:<16-byte auth tag hex>:<ciphertext hex>`
- Returns the decrypted plaintext Stellar key
- Errors (file not found, decryption failure) returned as structured failures

---

### `src/lib/mutex.ts`

A minimal promise-based async mutex for Node.js (no external dependency needed):

```typescript
export class AsyncMutex {
  acquire(): Promise<() => void>  // returns a release function
}
```

Internally maintains a promise chain. `acquire()` returns a promise that resolves to a `release` function. Callers must call `release()` in a `finally` block.

---

### `src/app/api/admin/reload-secret/route.ts`

Next.js App Router route handler.

```typescript
export async function POST(request: Request): Promise<Response>
```

**Auth verification:**
- Reads `Authorization: Bearer <token>` header
- Compares against `process.env.ADMIN_RELOAD_TOKEN` using `crypto.timingSafeEqual` to prevent timing attacks
- Returns `Response` with status 401 if missing or mismatched

**Success response:**
```json
{ "message": "Key reloaded successfully", "timestamp": "2024-01-01T00:00:00.000Z" }
```

**Failure response:**
```json
{ "error": "Reload failed: <reason>", "timestamp": "2024-01-01T00:00:00.000Z" }
```

Neither response includes the key value.

---

### `src/lib/auditLogger.ts`

```typescript
export function logReloadEvent(event: AuditEvent): void

interface AuditEvent {
  timestamp: string       // ISO 8601
  adminIdentity: string   // from token or request header
  outcome: 'success' | 'failure'
  failureReason?: string  // never contains key value
}
```

Writes structured JSON to `console.log` (captured by the hosting platform's log aggregator). The implementation explicitly strips any string that matches the current key before writing.

---

## Data Models

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STELLAR_SECRET_KEY` | Yes (startup) | Fallback/initial key; used if no source fetch has occurred |
| `AWS_SECRET_ARN` | No | If set, AWS adapter is used as primary source |
| `SECRET_FILE_PATH` | No | Path to local encrypted key file (fallback) |
| `FILE_ENCRYPTION_KEY` | If `SECRET_FILE_PATH` set | Hex-encoded 32-byte AES-256 key |
| `ADMIN_RELOAD_TOKEN` | Yes | Bearer token for reload endpoint authorization |

### In-Memory State (secretManager.ts)

```typescript
let inMemoryKey: string          // current active key
const mutex = new AsyncMutex()   // serializes writes
```

### Audit Log Entry (JSON)

```json
{
  "event": "secret_key_reload",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "adminIdentity": "admin-token-prefix-****",
  "outcome": "success" | "failure",
  "failureReason": "optional, no key value"
}
```

---

## Concurrency and Locking Strategy

JavaScript's event loop is single-threaded, so simple variable reads are inherently atomic. However, `updateSecretKey` involves an async fetch-then-write sequence that must be serialized.

**Strategy: Copy-on-write with async mutex**

1. `getSecretKey()` reads `inMemoryKey` synchronously — no lock needed. It always returns the last fully committed value.
2. `updateSecretKey()` acquires the mutex before writing. If two concurrent calls arrive:
   - The first acquires the mutex and proceeds
   - The second awaits the mutex; when released, it runs with the latest state
3. The mutex is released in a `finally` block to prevent deadlocks on error
4. The key reference is replaced atomically (single assignment) — no partial state is possible

```
Timeline:
  t=0  reload-A acquires mutex, begins fetch
  t=1  reload-B arrives, awaits mutex
  t=2  reload-A completes, writes keyA, releases mutex
  t=3  reload-B acquires mutex, begins fetch (sees keyA as current)
  t=4  reload-B completes, writes keyB, releases mutex

  getSecretKey() at any point returns: initial → keyA → keyB
  Never returns a partial/undefined value.
```

---

## AWS Secrets Manager Integration

### IAM Permissions (minimum required)

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:<secret-name>-*"
}
```

No `DescribeSecret`, `ListSecrets`, `RotateSecret`, or write permissions are needed.

### Key Rotation Handling

AWS Secrets Manager supports automatic rotation. When rotation occurs, the new version is tagged `AWSCURRENT`. The `GetSecretValueCommand` without a `VersionStage` parameter always returns `AWSCURRENT`. The reload endpoint triggers a fresh `GetSecretValueCommand` call, so the next reload after rotation will pick up the new key automatically — no special rotation event handling is needed.

### Local Encrypted File Fallback

Used when `AWS_SECRET_ARN` is not set. The file is encrypted at rest using AES-256-GCM:

```
File format (text):
<iv_hex>:<authTag_hex>:<ciphertext_hex>

Example:
a1b2c3d4e5f6a7b8c9d0e1f2:deadbeef...:<encrypted_key_hex>
```

The encryption key (`FILE_ENCRYPTION_KEY`) must be stored separately from the file (e.g., in a secrets vault or environment variable injected at deploy time).

---

## Admin Auth for the Reload Endpoint

The endpoint uses a static bearer token stored in `ADMIN_RELOAD_TOKEN`. This is appropriate for internal/ops tooling where a full OAuth flow would be over-engineered.

**Security properties of the auth check:**
- `crypto.timingSafeEqual` prevents timing-based token enumeration
- Token is compared as `Buffer` (byte-level), not string equality
- A missing `Authorization` header returns 401 before any key fetch occurs
- The token value is never logged

**Hardening recommendations (noted in design, not implemented here):**
- Rotate `ADMIN_RELOAD_TOKEN` on a schedule
- Restrict the `/admin/*` path at the infrastructure level (e.g., ALB rule, VPC-only)
- Consider adding IP allowlisting at the reverse proxy layer

---

## Security Considerations

1. **Key never in logs**: `auditLogger.ts` scrubs the key from all output. `validator.ts` returns structural error descriptions, not the candidate value. All error types are designed to carry context without carrying the key.

2. **Timing-safe comparison**: The admin token check uses `crypto.timingSafeEqual` to prevent oracle attacks.

3. **Minimal AWS permissions**: The IAM policy grants only `GetSecretValue` on the specific secret ARN.

4. **Encrypted file at rest**: The local fallback file is AES-256-GCM encrypted. The decryption key is never stored alongside the file.

5. **No key in HTTP responses**: Both success and failure responses from the reload endpoint are templated to contain only status messages and timestamps.

6. **Startup validation**: An invalid or missing key at startup causes a hard crash with a descriptive error — preventing the server from running in a broken state silently.

7. **Mutex prevents partial state**: The async mutex ensures no consumer ever reads a half-written key value.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `STELLAR_SECRET_KEY` missing at startup | Throw `SecretManagerInitError` with descriptive message (no key value) |
| Invalid key at startup | Throw `SecretManagerInitError` with validation failure reason |
| `updateSecretKey` called with invalid key | Return `{ success: false, error: "Invalid key format: ..." }`, key unchanged |
| AWS fetch fails (network, permissions) | Return `{ success: false, error: "AWS fetch failed: ..." }`, key unchanged |
| File read/decrypt fails | Return `{ success: false, error: "File fetch failed: ..." }`, key unchanged |
| Reload endpoint: missing/invalid token | HTTP 401 `{ error: "Unauthorized" }` |
| Reload endpoint: reload fails | HTTP 500 `{ error: "Reload failed: <reason>" }` |
| Mutex deadlock (should not occur) | `finally` block guarantees release; if mutex is never acquired, request times out at the HTTP layer |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Key update round-trip

*For any* valid Stellar secret key `k`, after calling `updateSecretKey(k)` successfully, `getSecretKey()` must return `k`.

**Validates: Requirements 1.2, 5.3, 7.4**

---

### Property 2: Invalid key rejected, state preserved

*For any* string that is not a valid Stellar secret key, calling `updateSecretKey` must return a failure result, and `getSecretKey()` must return the same value it returned before the call.

**Validates: Requirements 2.1, 2.2**

---

### Property 3: Same-key update is a no-op

*For any* valid Stellar secret key `k` already stored as the current key, calling `updateSecretKey(k)` must return a success result and `getSecretKey()` must still return `k`.

**Validates: Requirements 2.3**

---

### Property 4: Fetch failure preserves existing key

*For any* key source that returns a failure, calling `reloadFromSource()` must return a failure result and `getSecretKey()` must return the same key it returned before the reload attempt.

**Validates: Requirements 3.4**

---

### Property 5: Fetched key passes through validator

*For any* key source that returns an invalid Stellar key string, calling `reloadFromSource()` must return a failure result and `getSecretKey()` must be unchanged.

**Validates: Requirements 3.3**

---

### Property 6: Caching prevents redundant external calls

*For any* sequence of `getSecretKey()` calls after a successful fetch, the external key source adapter must be called at most once per `reloadFromSource()` invocation.

**Validates: Requirements 3.5**

---

### Property 7: Unauthorized requests rejected, key unchanged

*For any* HTTP request to `POST /admin/reload-secret` that carries an absent or incorrect authorization token, the response status must be 401 and `getSecretKey()` must return the same value it returned before the request.

**Validates: Requirements 4.2, 4.3**

---

### Property 8: Response body never contains the key value

*For any* outcome of a reload request (success or failure), the HTTP response body must not contain the current or previous secret key value as a substring.

**Validates: Requirements 4.5, 4.6, 1.5, 7.1, 8.2, 8.3**

---

### Property 9: Concurrent updates are serialized, no partial state

*For any* set of concurrent `updateSecretKey` calls with distinct valid keys, after all calls complete, `getSecretKey()` must return exactly one of the supplied keys — never `undefined`, never a concatenation, never an empty string.

**Validates: Requirements 5.1, 5.4**

---

### Property 10: Reads during update return a valid key without blocking

*For any* `updateSecretKey` call in progress, concurrent `getSecretKey()` calls must return a non-empty string (either the previous key or the new key) and must not block indefinitely.

**Validates: Requirements 5.2**

---

### Property 11: Audit log contains required fields

*For any* reload event (success or failure), the emitted audit log entry must contain a valid ISO 8601 timestamp, an admin identity string, and an outcome field — and must not contain the secret key value as a substring.

**Validates: Requirements 8.1, 8.2**

---

## Testing Strategy

### Dual Testing Approach

Both unit/integration tests and property-based tests are required. They are complementary:

- **Unit/integration tests** verify specific examples, edge cases, and integration points (e.g., "given this exact env var, the module initializes correctly")
- **Property-based tests** verify universal invariants across randomly generated inputs (e.g., "for any invalid string, the key is never corrupted")

### Property-Based Testing Library

**Library**: [`fast-check`](https://github.com/dubzzz/fast-check) — the standard PBT library for TypeScript/JavaScript.

Install: `npm install --save-dev fast-check`

Each property test must run a minimum of **100 iterations** (fast-check default is 100; set explicitly via `{ numRuns: 100 }`).

Each test must include a comment referencing the design property it validates:
```
// Feature: dynamic-secret-key-reload, Property N: <property text>
```

### Unit / Integration Tests

Framework: **Jest** (already standard in Next.js projects) or **Vitest**.

| Test | Type | Covers |
|---|---|---|
| Init with valid env var → `getSecretKey()` returns it | example | Req 1.3, 6.1 |
| Init with missing env var → throws `SecretManagerInitError` | edge-case | Req 1.4 |
| Init with empty string env var → throws | edge-case | Req 1.4 |
| `reloadFromSource()` with AWS adapter mock → calls `GetSecretValueCommand` | example | Req 3.1 |
| `reloadFromSource()` with AWS failure → falls back to file adapter | example | Req 3.2 |
| `POST /admin/reload-secret` with valid token → HTTP 200 | example | Req 4.1, 4.4 |
| `POST /admin/reload-secret` with no token → HTTP 401 | adversarial | Req 4.3 |
| `POST /admin/reload-secret` with wrong token → HTTP 401 | adversarial | Req 4.3 |
| Reload with malformed key from source → key unchanged | adversarial | Req 9.4 |
| AWS rotation: mock returns new key on second call → reload picks it up | example | Req 7.3 |
| Concurrent reload + signing: final key is consistent | concurrency | Req 9.5 |

### Property-Based Tests

Each property below maps to a design property and must be implemented as a single `fast-check` test.

```typescript
// Property 1: Key update round-trip
// Feature: dynamic-secret-key-reload, Property 1: key update round-trip
fc.assert(fc.asyncProperty(validStellarKeyArbitrary(), async (key) => {
  await updateSecretKey(key)
  return getSecretKey() === key
}), { numRuns: 100 })

// Property 2: Invalid key rejected, state preserved
// Feature: dynamic-secret-key-reload, Property 2: invalid key rejected
fc.assert(fc.asyncProperty(invalidKeyArbitrary(), async (badKey) => {
  const before = getSecretKey()
  const result = await updateSecretKey(badKey)
  return result.success === false && getSecretKey() === before
}), { numRuns: 100 })

// Property 3: Same-key update is a no-op
// Feature: dynamic-secret-key-reload, Property 3: same-key no-op
fc.assert(fc.asyncProperty(validStellarKeyArbitrary(), async (key) => {
  await updateSecretKey(key)
  const result = await updateSecretKey(key)
  return result.success === true && getSecretKey() === key
}), { numRuns: 100 })

// Property 4: Fetch failure preserves existing key
// Feature: dynamic-secret-key-reload, Property 4: fetch failure preserves key
fc.assert(fc.asyncProperty(fc.anything(), async () => {
  const before = getSecretKey()
  mockAdapterToFail()
  const result = await reloadFromSource()
  return result.success === false && getSecretKey() === before
}), { numRuns: 100 })

// Property 7: Unauthorized requests rejected
// Feature: dynamic-secret-key-reload, Property 7: unauthorized rejected
fc.assert(fc.asyncProperty(fc.string(), async (token) => {
  fc.pre(token !== process.env.ADMIN_RELOAD_TOKEN)
  const before = getSecretKey()
  const res = await POST(makeRequest(token))
  return res.status === 401 && getSecretKey() === before
}), { numRuns: 100 })

// Property 8: Response body never contains key
// Feature: dynamic-secret-key-reload, Property 8: response never leaks key
fc.assert(fc.asyncProperty(fc.boolean(), async (shouldSucceed) => {
  setupMock(shouldSucceed)
  const res = await POST(makeAuthorizedRequest())
  const body = await res.text()
  return !body.includes(getSecretKey())
}), { numRuns: 100 })

// Property 9: Concurrent updates produce no partial state
// Feature: dynamic-secret-key-reload, Property 9: concurrent updates serialized
fc.assert(fc.asyncProperty(
  fc.array(validStellarKeyArbitrary(), { minLength: 2, maxLength: 10 }),
  async (keys) => {
    await Promise.all(keys.map(k => updateSecretKey(k)))
    const final = getSecretKey()
    return keys.includes(final)
  }
), { numRuns: 100 })

// Property 11: Audit log contains required fields, no key value
// Feature: dynamic-secret-key-reload, Property 11: audit log fields
fc.assert(fc.asyncProperty(validStellarKeyArbitrary(), async (key) => {
  const logs: AuditEvent[] = []
  captureAuditLogs(logs)
  await updateSecretKey(key)
  const entry = logs[logs.length - 1]
  return (
    typeof entry.timestamp === 'string' &&
    typeof entry.adminIdentity === 'string' &&
    (entry.outcome === 'success' || entry.outcome === 'failure') &&
    !JSON.stringify(entry).includes(key)
  )
}), { numRuns: 100 })
```

### Arbitraries

```typescript
// Generates valid Stellar secret keys using the SDK
function validStellarKeyArbitrary() {
  return fc.nat().map(() => Keypair.random().secret())
}

// Generates strings that are NOT valid Stellar keys
function invalidKeyArbitrary() {
  return fc.oneof(
    fc.string(),                          // random strings
    fc.constant(''),                      // empty
    fc.constant('GNOTASECRETKEY'),        // starts with G (public key)
    fc.hexaString({ minLength: 56 })      // wrong format
  ).filter(s => {
    try { Keypair.fromSecret(s); return false } catch { return true }
  })
}
```
