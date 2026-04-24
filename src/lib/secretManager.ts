import { AsyncMutex } from './mutex';
import { validate } from './validator';

// ── Types ────────────────────────────────────────────────────────────────────

export type UpdateResult =
  | { success: true }
  | { success: false; reason: string };

export type ReloadResult =
  | { success: true }
  | { success: false; reason: string };

// ── Custom error ─────────────────────────────────────────────────────────────

export class SecretManagerInitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretManagerInitError';
  }
}

// ── Module-level state (Task 3.1) ─────────────────────────────────────────────

const mutex = new AsyncMutex();

// Initialize inMemoryKey from the environment variable on module load.
// Throws SecretManagerInitError if the env var is absent, empty, or invalid.
function initKey(): string {
  const raw = process.env.STELLAR_SECRET_KEY;

  if (!raw || raw.trim() === '') {
    throw new SecretManagerInitError(
      'STELLAR_SECRET_KEY environment variable is absent or empty. ' +
        'The server cannot start without a valid Stellar secret key.'
    );
  }

  const result = validate(raw);
  if (!result.valid) {
    throw new SecretManagerInitError(
      `STELLAR_SECRET_KEY failed validation at startup: ${result.reason}`
    );
  }

  return raw;
}

let inMemoryKey: string = initKey();

// ── getSecretKey (Task 3.2) ───────────────────────────────────────────────────

/**
 * Returns the current in-memory Stellar secret key synchronously.
 * No locking is required — JS reads are atomic and the key reference is
 * replaced atomically on update (Requirements 1.1, 6.1, 6.2).
 */
export function getSecretKey(): string {
  return inMemoryKey;
}

// ── updateSecretKey (Task 3.3) ────────────────────────────────────────────────

/**
 * Validates and atomically replaces the in-memory secret key.
 *
 * - Validates the candidate before acquiring the mutex (fail-fast).
 * - If the candidate equals the current key, returns success immediately (no-op).
 * - Acquires the mutex, overwrites inMemoryKey, releases in finally.
 * - Emits an audit log entry after a successful update.
 *
 * Requirements: 1.2, 2.2, 2.3, 5.1, 5.3, 7.4
 */
export async function updateSecretKey(newKey: string): Promise<UpdateResult> {
  // Validate before acquiring the lock (fail-fast, no contention on bad input)
  const validation = validate(newKey);
  if (!validation.valid) {
    return { success: false, reason: `Invalid key format: ${validation.reason}` };
  }

  // No-op: candidate is identical to the current key (Requirement 2.3)
  if (newKey === inMemoryKey) {
    return { success: true };
  }

  // Acquire mutex → overwrite → release (Requirements 5.1, 7.4)
  const release = await mutex.acquire();
  try {
    inMemoryKey = newKey; // atomic reference swap (Requirement 5.3)
  } finally {
    release();
  }

  // Emit audit log after successful update (Requirement 8.1)
  // Dynamic import so that auditLogger.ts can be created independently (Task 4)
  try {
    const { logReloadEvent } = await import('./auditLogger');
    logReloadEvent({
      timestamp: new Date().toISOString(),
      adminIdentity: 'system',
      outcome: 'success',
    });
  } catch {
    // auditLogger not yet available or failed — do not block the update
  }

  return { success: true };
}

// ── reloadFromSource (Task 7.1) ───────────────────────────────────────────────

/**
 * Fetches the latest key from the configured key source (AWS Secrets Manager
 * if `AWS_SECRET_ARN` is set, otherwise the local encrypted file adapter),
 * passes the result through the Validator via `updateSecretKey`, and atomically
 * replaces the in-memory key on success.
 *
 * On any failure (fetch error or validation error) the existing `inMemoryKey`
 * is retained unchanged and a structured error is returned.
 *
 * Emits an audit log entry for both success and failure outcomes.
 * The `adminIdentity` for system-triggered reloads is 'system'.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export async function reloadFromSource(): Promise<ReloadResult> {
  const { AWS_SECRET_ARN } = process.env;

  // ── Step 1: Fetch raw key from the appropriate adapter ──────────────────────
  let rawKey: string;

  if (AWS_SECRET_ARN) {
    const { fetchKey } = await import('./adapters/awsAdapter');
    const result = await fetchKey();
    if (!result.success) {
      await emitReloadAuditLog('failure', result.error);
      return { success: false, reason: result.error };
    }
    rawKey = result.key;
  } else {
    const { fetchKey } = await import('./adapters/fileAdapter');
    const result = await fetchKey();
    if (!result.success) {
      await emitReloadAuditLog('failure', result.error);
      return { success: false, reason: result.error };
    }
    rawKey = result.key;
  }

  // ── Step 2: Validate and apply via updateSecretKey ──────────────────────────
  // updateSecretKey runs the Validator before acquiring the mutex (Req 3.3).
  // On validation failure it returns a structured error without touching inMemoryKey (Req 3.4).
  const updateResult = await updateSecretKey(rawKey);
  if (!updateResult.success) {
    await emitReloadAuditLog('failure', updateResult.reason);
    return { success: false, reason: updateResult.reason };
  }

  // ── Step 3: Emit success audit log ─────────────────────────────────────────
  // updateSecretKey already emits a log entry; we emit an additional one here
  // scoped to the reload operation so operators can distinguish reload-triggered
  // updates from direct updateSecretKey calls.
  await emitReloadAuditLog('success');

  return { success: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Emits a structured audit log entry for a reloadFromSource event.
 * Silently swallows errors so that a logging failure never blocks the caller.
 */
async function emitReloadAuditLog(
  outcome: 'success' | 'failure',
  failureReason?: string
): Promise<void> {
  try {
    const { logReloadEvent } = await import('./auditLogger');
    logReloadEvent(
      {
        timestamp: new Date().toISOString(),
        adminIdentity: 'system',
        outcome,
        ...(failureReason !== undefined && { failureReason }),
      },
      inMemoryKey
    );
  } catch {
    // Logging failure must never block or corrupt the reload result
  }
}
