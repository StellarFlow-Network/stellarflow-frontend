# Requirements Document

## Introduction

This feature adds dynamic runtime reloading of the Stellar Secret Key in the StellarFlow application. Currently the key is loaded once from `.env` at server startup. The goal is to allow the key to be updated without restarting the server, while preserving security, consistency, and backward compatibility with all existing signing and transaction flows.

## Glossary

- **Secret_Manager**: The centralized module (`secretManager.ts`) responsible for storing, retrieving, and updating the Stellar Secret Key in memory.
- **Secret_Key**: The Stellar secret key (seed) used to sign transactions, formatted as a Stellar-compatible base58-encoded string beginning with `S`.
- **Reload_Endpoint**: The HTTP API endpoint (`POST /admin/reload-secret`) that triggers a runtime key refresh.
- **Key_Source**: The origin from which the Secret_Key is fetched — either AWS Secrets Manager or a local encrypted file fallback.
- **Admin_Client**: An authenticated caller with admin-level authorization permitted to trigger key reloads.
- **Validator**: The component responsible for verifying that a candidate Secret_Key is well-formed and valid before it is applied.
- **Lock**: A mutual-exclusion mechanism that prevents concurrent reads and writes to the in-memory Secret_Key during an update.

---

## Requirements

### Requirement 1: Centralized Secret Manager

**User Story:** As a backend developer, I want all secret key access to go through a single module, so that key management logic is not scattered across the codebase.

#### Acceptance Criteria

1. THE Secret_Manager SHALL expose a `getSecretKey()` function that returns the current in-memory Secret_Key.
2. THE Secret_Manager SHALL expose an `updateSecretKey(newKey: string)` function that replaces the in-memory Secret_Key.
3. THE Secret_Manager SHALL initialize the in-memory Secret_Key from the `STELLAR_SECRET_KEY` environment variable on first load.
4. IF `STELLAR_SECRET_KEY` is absent or empty at initialization, THEN THE Secret_Manager SHALL throw a descriptive startup error.
5. THE Secret_Manager SHALL never expose the raw Secret_Key value in log output, error messages, or serialized responses.

---

### Requirement 2: Secret Key Validation

**User Story:** As a security engineer, I want every candidate key to be validated before it is applied, so that malformed or invalid keys never enter the system.

#### Acceptance Criteria

1. WHEN `updateSecretKey` is called, THE Validator SHALL verify that the candidate key is a valid Stellar secret key (begins with `S`, passes Stellar SDK key-pair validation).
2. IF the candidate key fails validation, THEN THE Secret_Manager SHALL reject the update and return a structured error without modifying the current in-memory Secret_Key.
3. IF the candidate key is identical to the current in-memory Secret_Key, THEN THE Secret_Manager SHALL accept the call as a no-op and return a success response.

---

### Requirement 3: Key Source Integration

**User Story:** As an operator, I want the secret key to be fetchable from a secure external source, so that key rotation can happen without manual file edits.

#### Acceptance Criteria

1. THE Secret_Manager SHALL support fetching the Secret_Key from AWS Secrets Manager when the `AWS_SECRET_ARN` environment variable is set.
2. WHERE AWS Secrets Manager is unavailable, THE Secret_Manager SHALL fall back to reading the Secret_Key from a local encrypted file whose path is specified by the `SECRET_FILE_PATH` environment variable.
3. WHEN a fetch from the Key_Source succeeds, THE Secret_Manager SHALL pass the retrieved value through the Validator before applying it.
4. IF a fetch from the Key_Source fails, THEN THE Secret_Manager SHALL retain the existing in-memory Secret_Key and return a structured error describing the failure.
5. THE Secret_Manager SHALL cache the fetched Secret_Key in memory to avoid redundant external calls on every signing operation.

---

### Requirement 4: Hot Reload API Endpoint

**User Story:** As an admin operator, I want a secure HTTP endpoint to trigger a key reload, so that I can rotate the secret key at runtime without restarting the server.

#### Acceptance Criteria

1. THE Reload_Endpoint SHALL accept `POST /admin/reload-secret` requests.
2. WHEN a request is received at `POST /admin/reload-secret`, THE Reload_Endpoint SHALL verify that the request carries a valid admin authorization token before proceeding.
3. IF the authorization token is absent or invalid, THEN THE Reload_Endpoint SHALL return HTTP 401 and SHALL NOT trigger a key reload.
4. WHEN authorization succeeds, THE Reload_Endpoint SHALL instruct the Secret_Manager to fetch the latest Secret_Key from the Key_Source and apply it.
5. WHEN the reload completes successfully, THE Reload_Endpoint SHALL return HTTP 200 with a confirmation message that does not include the Secret_Key value.
6. IF the reload fails for any reason, THEN THE Reload_Endpoint SHALL return HTTP 500 with a structured error message that does not include the Secret_Key value.

---

### Requirement 5: Concurrency and Atomic Updates

**User Story:** As a backend developer, I want key updates to be atomic and race-condition-free, so that no transaction is signed with a partially updated or inconsistent key.

#### Acceptance Criteria

1. THE Secret_Manager SHALL use a Lock to serialize concurrent calls to `updateSecretKey`.
2. WHILE a key update is in progress, THE Secret_Manager SHALL allow concurrent `getSecretKey()` calls to return the previous valid Secret_Key without blocking.
3. WHEN the Lock is released after a successful update, THE Secret_Manager SHALL guarantee that all subsequent `getSecretKey()` calls return the new Secret_Key.
4. IF two concurrent reload requests arrive simultaneously, THEN THE Secret_Manager SHALL process them sequentially and SHALL NOT produce a partial state.

---

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want existing transaction signing and drip execution flows to continue working without modification, so that the feature introduces no breaking changes.

#### Acceptance Criteria

1. THE Secret_Manager SHALL provide a `getSecretKey()` interface that is a drop-in replacement for direct `process.env.STELLAR_SECRET_KEY` access.
2. WHEN existing signing or drip-execution code calls `getSecretKey()`, THE Secret_Manager SHALL return the current valid Secret_Key synchronously or via a resolved Promise, matching the call pattern used by the caller.
3. THE Secret_Manager SHALL not alter any public API signatures, route handlers, or exported types that are consumed outside the secret management module.

---

### Requirement 7: Security Constraints

**User Story:** As a security engineer, I want the secret key to be handled securely in memory and never exposed through observable channels, so that the risk of key leakage is minimized.

#### Acceptance Criteria

1. THE Secret_Manager SHALL never write the Secret_Key to any log, console output, HTTP response body, or error stack trace.
2. WHERE AWS Secrets Manager is used, THE Secret_Manager SHALL use an IAM role or policy that grants only the minimum permissions required to read the target secret.
3. WHEN a key rotation event occurs in AWS Secrets Manager, THE Secret_Manager SHALL handle the rotation gracefully by fetching the new version without service interruption.
4. THE Secret_Manager SHALL overwrite the previous in-memory Secret_Key value immediately after a successful update to minimize the window during which both values coexist in memory.

---

### Requirement 8: Observability and Audit Logging

**User Story:** As an operator, I want reload events to be logged with enough detail to audit who triggered them and whether they succeeded, so that I can investigate incidents.

#### Acceptance Criteria

1. WHEN a reload is triggered via the Reload_Endpoint, THE Secret_Manager SHALL emit a structured log entry containing: timestamp, triggering admin identity, and outcome (success or failure reason).
2. THE Secret_Manager SHALL never include the Secret_Key value or any portion of it in audit log entries.
3. IF a reload attempt fails validation, THEN THE Secret_Manager SHALL log the failure reason without including the rejected key value.

---

### Requirement 9: Testing Coverage

**User Story:** As a developer, I want comprehensive tests for the secret management feature, so that regressions are caught early and the implementation is trustworthy.

#### Acceptance Criteria

1. THE Secret_Manager SHALL have unit tests covering: successful `getSecretKey()` retrieval, successful `updateSecretKey()` with a valid key, rejection of an invalid key, and no-op behavior when the same key is supplied.
2. THE Secret_Manager SHALL have integration tests verifying that a key updated during active signing operations causes all subsequent operations to use the new key.
3. THE Reload_Endpoint SHALL have adversarial tests verifying that requests without valid authorization tokens are rejected with HTTP 401.
4. THE Reload_Endpoint SHALL have adversarial tests verifying that supplying a malformed key via the reload flow does not corrupt the in-memory Secret_Key.
5. THE Secret_Manager SHALL have concurrency tests verifying that simultaneous reload and signing operations do not produce race conditions or partial state.
