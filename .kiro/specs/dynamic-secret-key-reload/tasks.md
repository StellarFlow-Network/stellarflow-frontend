# Implementation Plan: Dynamic Secret Key Reload

## Overview

Implement a centralized `SecretManager` singleton for the StellarFlow Next.js application that holds the Stellar secret key in memory, validates it, supports hot-reloading via a secure admin endpoint, and integrates with AWS Secrets Manager and a local encrypted file fallback — all without breaking existing signing flows.

## Tasks

- [x] 1. Install dependencies and set up project structure
  - Run `npm install --save-dev fast-check` to add the property-based testing library
  - Run `npm install @aws-sdk/client-secrets-manager` to add the AWS SDK client
  - Create directory `src/lib/adapters/` for the adapter modules
  - Create directory `src/app/api/admin/reload-secret/` for the route handler
  - _Requirements: 1.1, 3.1_

- [x] 2. Implement `AsyncMutex` and `Validator`
  - [x] 2.1 Create `src/lib/mutex.ts` with the `AsyncMutex` class
    - Implement promise-chain-based `acquire(): Promise<() => void>` that returns a release function
    - Callers must use `release()` in a `finally` block
    - _Requirements: 5.1, 5.4_

  - [ ]* 2.2 Write unit tests for `AsyncMutex`
    - Test that concurrent acquires are serialized
    - Test that release in `finally` prevents deadlock
    - _Requirements: 5.1, 5.4_

  - [x] 2.3 Create `src/lib/validator.ts` with `validate(candidate: string): ValidationResult`
    - Use `Keypair.fromSecret()` from `@stellar/stellar-sdk` inside a try/catch
    - Return `{ valid: true }` on success; `{ valid: false; reason: string }` on failure
    - The `reason` field must never echo the candidate key value
    - _Requirements: 2.1, 2.2, 7.1_

  - [ ]* 2.4 Write property test for `Validator` — Property 2: Invalid key rejected
    - **Property 2: Invalid key rejected, state preserved**
    - **Validates: Requirements 2.1, 2.2**
    - Use `invalidKeyArbitrary()` to generate non-Stellar strings; assert `validate()` returns `{ valid: false }`
    - Comment: `// Feature: dynamic-secret-key-reload, Property 2`

- [x] 3. Implement `SecretManager` singleton
  - [x] 3.1 Create `src/lib/secretManager.ts` with module-level `inMemoryKey` and `AsyncMutex` instance
    - On module load, read `process.env.STELLAR_SECRET_KEY`, validate it, and store as `inMemoryKey`
    - Throw `SecretManagerInitError` if the env var is absent, empty, or fails validation
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Implement `getSecretKey(): string`
    - Synchronous read of `inMemoryKey` — no locking required
    - _Requirements: 1.1, 6.1, 6.2_

  - [x] 3.3 Implement `updateSecretKey(newKey: string): Promise<UpdateResult>`
    - Validate candidate before acquiring the mutex
    - If candidate equals current key, return `{ success: true }` immediately (no-op)
    - Acquire mutex, overwrite `inMemoryKey`, release mutex in `finally`
    - Emit audit log entry via `auditLogger.ts` after successful update
    - _Requirements: 1.2, 2.2, 2.3, 5.1, 5.3, 7.4_

  - [ ]* 3.4 Write property test for `SecretManager` — Property 1: Key update round-trip
    - **Property 1: Key update round-trip**
    - **Validates: Requirements 1.2, 5.3, 7.4**
    - Use `validStellarKeyArbitrary()`; after `updateSecretKey(k)`, assert `getSecretKey() === k`
    - Comment: `// Feature: dynamic-secret-key-reload, Property 1`

  - [ ]* 3.5 Write property test for `SecretManager` — Property 3: Same-key update is a no-op
    - **Property 3: Same-key update is a no-op**
    - **Validates: Requirements 2.3**
    - Set key to `k`, call `updateSecretKey(k)` again, assert `success === true` and key unchanged
    - Comment: `// Feature: dynamic-secret-key-reload, Property 3`

  - [ ]* 3.6 Write property test for `SecretManager` — Property 9: Concurrent updates produce no partial state
    - **Property 9: Concurrent updates are serialized, no partial state**
    - **Validates: Requirements 5.1, 5.4**
    - Fire `Promise.all` of multiple `updateSecretKey` calls; assert final key is one of the supplied keys
    - Comment: `// Feature: dynamic-secret-key-reload, Property 9`

  - [ ]* 3.7 Write property test for `SecretManager` — Property 10: Reads during update return a valid key
    - **Property 10: Reads during update return a valid key without blocking**
    - **Validates: Requirements 5.2**
    - While `updateSecretKey` is in progress, assert `getSecretKey()` returns a non-empty string
    - Comment: `// Feature: dynamic-secret-key-reload, Property 10`

- [x] 4. Implement `AuditLogger`
  - [x] 4.1 Create `src/lib/auditLogger.ts` with `logReloadEvent(event: AuditEvent): void`
    - Write structured JSON to `console.log`
    - Strip any substring matching the current key before writing
    - Include fields: `event`, `timestamp` (ISO 8601), `adminIdentity`, `outcome`, optional `failureReason`
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 4.2 Write property test for `AuditLogger` — Property 11: Audit log contains required fields
    - **Property 11: Audit log contains required fields, no key value**
    - **Validates: Requirements 8.1, 8.2**
    - For any reload event, assert log entry has `timestamp`, `adminIdentity`, `outcome`, and does not contain the key
    - Comment: `// Feature: dynamic-secret-key-reload, Property 11`

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement key source adapters
  - [x] 6.1 Create `src/lib/adapters/awsAdapter.ts` with `fetchKey(): Promise<FetchResult>`
    - Use `@aws-sdk/client-secrets-manager` `GetSecretValueCommand`
    - Read ARN from `process.env.AWS_SECRET_ARN`
    - Catch all errors and return `{ success: false; error: string }` — never throw to callers
    - Never log the fetched key value
    - _Requirements: 3.1, 7.1, 7.2_

  - [ ]* 6.2 Write unit tests for `awsAdapter`
    - Mock `GetSecretValueCommand`; test success path returns key string
    - Test network/permission failure returns structured error
    - _Requirements: 3.1, 3.4_

  - [x] 6.3 Create `src/lib/adapters/fileAdapter.ts` with `fetchKey(): Promise<FetchResult>`
    - Read encrypted file at `process.env.SECRET_FILE_PATH`
    - Decrypt using AES-256-GCM with key from `process.env.FILE_ENCRYPTION_KEY`
    - File format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
    - Return structured failure on file-not-found or decryption error
    - _Requirements: 3.2, 7.1_

  - [ ]* 6.4 Write unit tests for `fileAdapter`
    - Test successful decrypt returns plaintext key
    - Test missing file returns structured error
    - Test bad auth tag (tampered file) returns structured error
    - _Requirements: 3.2, 3.4_

- [x] 7. Implement `reloadFromSource` in `SecretManager`
  - [x] 7.1 Add `reloadFromSource(): Promise<ReloadResult>` to `src/lib/secretManager.ts`
    - Select adapter: use `awsAdapter` if `AWS_SECRET_ARN` is set, else `fileAdapter`
    - On fetch failure, retain `inMemoryKey` and return structured error
    - On fetch success, pass result through `Validator` before calling `updateSecretKey`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 7.2 Write property test for `SecretManager` — Property 4: Fetch failure preserves existing key
    - **Property 4: Fetch failure preserves existing key**
    - **Validates: Requirements 3.4**
    - Mock adapter to return failure; assert `reloadFromSource()` returns failure and key is unchanged
    - Comment: `// Feature: dynamic-secret-key-reload, Property 4`

  - [ ]* 7.3 Write property test for `SecretManager` — Property 5: Fetched key passes through validator
    - **Property 5: Fetched key passes through validator**
    - **Validates: Requirements 3.3**
    - Mock adapter to return an invalid key string; assert reload fails and key is unchanged
    - Comment: `// Feature: dynamic-secret-key-reload, Property 5`

  - [ ]* 7.4 Write property test for `SecretManager` — Property 6: Caching prevents redundant external calls
    - **Property 6: Caching prevents redundant external calls**
    - **Validates: Requirements 3.5**
    - After a successful reload, call `getSecretKey()` multiple times; assert adapter was called exactly once
    - Comment: `// Feature: dynamic-secret-key-reload, Property 6`

- [x] 8. Implement the admin reload endpoint
  - [x] 8.1 Create `src/app/api/admin/reload-secret/route.ts` with `POST(request: Request): Promise<Response>`
    - Read `Authorization: Bearer <token>` header
    - Compare against `process.env.ADMIN_RELOAD_TOKEN` using `crypto.timingSafeEqual` (Buffer comparison)
    - Return HTTP 401 `{ error: "Unauthorized" }` if token is missing or mismatched — before any key fetch
    - On auth success, call `secretManager.reloadFromSource()`
    - Return HTTP 200 `{ message: "Key reloaded successfully", timestamp }` on success
    - Return HTTP 500 `{ error: "Reload failed: <reason>", timestamp }` on failure
    - Neither response body may contain the key value
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.1_

  - [ ]* 8.2 Write property test for reload endpoint — Property 7: Unauthorized requests rejected
    - **Property 7: Unauthorized requests rejected, key unchanged**
    - **Validates: Requirements 4.2, 4.3**
    - For any token that is not the correct `ADMIN_RELOAD_TOKEN`, assert HTTP 401 and key unchanged
    - Comment: `// Feature: dynamic-secret-key-reload, Property 7`

  - [ ]* 8.3 Write property test for reload endpoint — Property 8: Response body never contains key
    - **Property 8: Response body never contains the key value**
    - **Validates: Requirements 4.5, 4.6, 1.5, 7.1, 8.2, 8.3**
    - For both success and failure outcomes, assert response body does not contain the current key as a substring
    - Comment: `// Feature: dynamic-secret-key-reload, Property 8`

  - [ ]* 8.4 Write adversarial unit tests for the reload endpoint
    - Test: missing `Authorization` header → HTTP 401, no reload triggered
    - Test: wrong token → HTTP 401, no reload triggered
    - Test: malformed key from source → HTTP 500, `inMemoryKey` unchanged
    - _Requirements: 4.3, 9.3, 9.4_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire `SecretManager` into existing signing flows
  - [x] 10.1 Identify all call sites that read `process.env.STELLAR_SECRET_KEY` directly
    - Search the codebase for `process.env.STELLAR_SECRET_KEY` references outside `secretManager.ts`
    - _Requirements: 6.1, 6.3_

  - [x] 10.2 Replace each call site with `import { getSecretKey } from '@/lib/secretManager'`
    - Ensure the call pattern (sync vs. async) matches what the caller expects per Requirement 6.2
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 10.3 Write integration tests for backward compatibility
    - Test that existing signing/drip-execution code returns correct results after migration
    - Test that a key updated mid-operation causes all subsequent operations to use the new key
    - _Requirements: 6.1, 6.2, 9.2_

  - [ ]* 10.4 Write concurrency integration test
    - Simulate simultaneous reload and signing operations; assert no race conditions or partial state
    - _Requirements: 5.2, 9.5_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness invariants; unit tests validate specific examples and edge cases
- The `@stellar/stellar-sdk` package must be available — add it if not already installed
