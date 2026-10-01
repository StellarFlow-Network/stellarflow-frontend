/**
 * storageSanitizer.ts
 *
 * Local storage & application state auto-cleanup utility.
 *
 * Runs once during React initialization (see
 * `src/components/providers/StorageSanitizer.tsx`) and prunes three classes of
 * stale browser state before it can degrade the app:
 *
 *  1. **Version tags** — every managed key carries a schema version. Entries
 *     written by an older build are migrated forward when a migration path
 *     exists and dropped when it does not. Entries written by a *newer* build
 *     are always dropped, because a downgrade must never read data whose shape
 *     the running build does not understand.
 *  2. **Transaction history** — records older than
 *     {@link TRANSACTION_RETENTION_MS} (30 days) are removed from the local
 *     history caches, which otherwise grow without bound across a session
 *     lifetime.
 *  3. **Quota pressure** — when total local storage usage exceeds
 *     {@link MAX_STORAGE_QUOTA_BYTES}, the largest disposable entries are
 *     evicted until usage is back under the headroom target, so the next write
 *     is far less likely to surface a `QuotaExceededError`.
 *
 * Design constraints
 * ──────────────────
 * - **Never throws.** This runs on every boot; a hostile or full storage area
 *   must not be able to take the application down with it. Failures are
 *   collected onto {@link SanitizerReport.errors} instead of being rethrown.
 * - **Never destroys non-disposable state.** Only entries explicitly flagged
 *   `disposable: true` (caches and derived history) may be evicted, so the
 *   sanitizer can never log a user out or discard their address book.
 * - **SSR safe.** Returns a "skipped" report when `window` is unavailable.
 *
 * Relationship to `QuotaExceededError`
 * ───────────────────────────────────
 * The quota pass is defence in depth, not the only line of defence:
 * {@link file://./storage.ts} already falls back to an in-memory store when a
 * write is rejected. Reclaiming space proactively means that fallback is the
 * rare path rather than the common one.
 *
 * @example
 * ```ts
 * const report = sanitizeLocalStorage();
 * if (report.evictedKeys.length > 0) console.debug(report.evictedKeys);
 * ```
 */

import { APP_STORAGE_VERSION, decrypt, migrateStorageData, setItem } from "./storage";

// ─── Constants ──────────────────────────────────────────────────────────────────

/** localStorage is capped at roughly 5 MiB per origin in every major engine. */
export const DEFAULT_BROWSER_QUOTA_BYTES = 5 * 1024 * 1024;

/**
 * Soft ceiling for this origin's local storage. Deliberately below
 * {@link DEFAULT_BROWSER_QUOTA_BYTES} so the eviction pass starts reclaiming
 * space *before* a write can hit the hard browser limit.
 */
export const MAX_STORAGE_QUOTA_BYTES = 4 * 1024 * 1024;

/** Free space the eviction pass restores before it stops deleting. */
export const QUOTA_HEADROOM_BYTES = 256 * 1024;

/** Transaction records older than this are removed from local history caches. */
export const TRANSACTION_RETENTION_DAYS = 30;
export const TRANSACTION_RETENTION_MS =
  TRANSACTION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Minimum gap between two automatic passes. The boot hook is cheap but not
 * free — it reads every key — so repeat visits inside a short window are
 * skipped and the previous result reused.
 */
export const SANITIZER_MIN_INTERVAL_MS = 15 * 60 * 1000;

/** Bookkeeping key holding the last-run timestamp. Never evicted. */
export const SANITIZER_STATE_KEY = "stellarflow:storage-sanitizer";

/** TanStack Query persisted client cache, written by `app/lib/persister.ts`. */
export const QUERY_CACHE_KEY = "stellarflow:query-cache:v1";

/** Trade fill analytics, written by `lib/tradeAnalytics.ts`. */
export const TRADE_ANALYTICS_KEY = "stellarflow:trade-analytics-history";

/** History cache family, written by `app/lib/historySync.ts`. */
export const HISTORY_KEY_PREFIX = "stellarflow-history:";

/**
 * Fields inspected, in order, to date an otherwise unlabelled record. Anything
 * carrying none of these is kept — the sanitizer deletes what it can prove is
 * stale, never what it merely failed to understand.
 */
const TIMESTAMP_FIELDS = [
  "date",
  "timestamp",
  "createdAt",
  "updatedAt",
  "completedAt",
] as const;

/** Epoch values below this are second-precision (1e12 ms is 2001-09-09). */
const SECONDS_EPOCH_CEILING = 1e12;

// ─── Types ──────────────────────────────────────────────────────────────────────

/**
 * How a managed key stores its payload.
 *
 * - `enveloped` — `{ version, data }`, XOR/base64 obfuscated by `./storage`.
 * - `plain` — raw JSON carrying its own `schemaVersion` field.
 */
export type StorageEncoding = "enveloped" | "plain";

export interface ManagedSchema {
  /** Exact localStorage key. */
  readonly key: string;
  /** Envelope shape written by the owning module. */
  readonly encoding: StorageEncoding;
  /** Schema version the running build writes. */
  readonly version: number;
  /**
   * True when the entry only holds re-derivable data. Disposable entries are
   * the only ones the eviction pass and the manual cache clear may delete.
   */
  readonly disposable: boolean;
  /**
   * True when an older payload can be lifted to the current version by the
   * shared migration ladder, which only round-trips `enveloped` entries. When
   * false, an out-of-date entry is evicted instead: a cache that cannot be
   * migrated is worth less than a cache miss, and a stale cache is actively
   * misleading.
   */
  readonly migratable: boolean;
  /** Human-readable label used in reports. */
  readonly description: string;
}

export type SanitizerSkipReason =
  | "server"
  | "storage-unavailable"
  | "throttled";

export interface SanitizerReport {
  /** Epoch ms the pass started. */
  readonly ranAt: number;
  /** True when no pass was performed. */
  readonly skipped: boolean;
  readonly skipReason: SanitizerSkipReason | null;
  /** Keys rewritten to the current schema version. */
  readonly migratedKeys: readonly string[];
  /** Keys deleted (unmigratable, corrupt, or reclaimed for quota). */
  readonly evictedKeys: readonly string[];
  /** Number of transaction records dropped by the retention pass. */
  readonly transactionsRemoved: number;
  readonly bytesBefore: number;
  readonly bytesAfter: number;
  /** True when the eviction pass actually deleted something for quota. */
  readonly quotaEnforced: boolean;
  /** Human-readable failures. The pass itself still succeeded. */
  readonly errors: readonly string[];
}

export interface SanitizeOptions {
  /** Bypass the {@link SANITIZER_MIN_INTERVAL_MS} throttle. */
  readonly force?: boolean;
  /** Clock override, for deterministic tests. */
  readonly now?: number;
  /** Soft ceiling override, in bytes. */
  readonly maxBytes?: number;
  /** Transaction retention window override, in ms. */
  readonly retentionMs?: number;
}

export interface ClearCacheResult {
  readonly clearedKeys: readonly string[];
  /** Disposable-but-retained keys that were deliberately left alone. */
  readonly preservedKeys: readonly string[];
  readonly bytesFreed: number;
  readonly errors: readonly string[];
}

export interface StorageEntrySize {
  readonly key: string;
  readonly bytes: number;
}

export interface StorageFootprint {
  readonly entries: readonly StorageEntrySize[];
  readonly totalBytes: number;
  /** Ceiling the eviction pass enforces. */
  readonly maxBytes: number;
  readonly percentUsed: number | null;
  /** Bytes held by entries the sanitizer is allowed to delete. */
  readonly evictableBytes: number;
}

// ─── Schema registry ────────────────────────────────────────────────────────────

/**
 * Keys that carry an explicit version tag and are therefore eligible for the
 * version-validation pass.
 *
 * Transaction history is deliberately absent: it has no version envelope and
 * is governed by the retention pass instead, so the sanitizer never has to
 * reshape a payload another module is responsible for reading.
 */
export const VERSIONED_SCHEMAS: readonly ManagedSchema[] = Object.freeze([
  {
    key: QUERY_CACHE_KEY,
    encoding: "plain",
    version: 1,
    disposable: true,
    // The persisted react-query blob is tied to the library's own serializer;
    // there is no ladder that lifts it across versions, and
    // `app/lib/persister.ts` already refuses to restore a mismatched bucket.
    migratable: false,
    description: "TanStack Query persisted client cache",
  },
  {
    key: "stellarflow.beneficiaries.v1",
    encoding: "enveloped",
    version: APP_STORAGE_VERSION,
    disposable: false,
    migratable: true,
    description: "Remittance beneficiaries",
  },
  {
    key: "stellarflow.customTokens.v1",
    encoding: "enveloped",
    version: APP_STORAGE_VERSION,
    disposable: false,
    migratable: true,
    description: "User-registered custom tokens",
  },
  {
    key: "stellarflow.chart.preferences",
    encoding: "enveloped",
    version: APP_STORAGE_VERSION,
    disposable: false,
    migratable: true,
    description: "Chart rendering preferences",
  },
]);

// ─── Module state ───────────────────────────────────────────────────────────────

let lastReport: SanitizerReport | null = null;

/** Most recent report, or `null` if the sanitizer has not run in this page. */
export function getLastSanitizerReport(): SanitizerReport | null {
  return lastReport;
}

// ─── Storage access ─────────────────────────────────────────────────────────────

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    // Reading `length` forces Safari private mode to throw here rather than at
    // an arbitrary later call site.
    void storage.length;
    return storage;
  } catch {
    return null;
  }
}

function readRaw(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Removes a key. Returns `false` when the storage refused, so callers never
 * credit a reclaim that did not happen.
 */
function deleteKey(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Byte cost of a stored string. Browsers meter localStorage in UTF-16 code
 * units, so `length * 2` is the number that actually competes for quota.
 */
function byteLengthOf(raw: string): number {
  return raw.length * 2;
}

// ─── Version validation ─────────────────────────────────────────────────────────

interface DecodedEntry {
  /** Version tag found in the payload, or `null` when absent/unparseable. */
  readonly version: number | null;
  /** Parsed payload body, or `null` when the entry could not be decoded. */
  readonly payload: unknown;
}

function decodeEntry(schema: ManagedSchema, raw: string): DecodedEntry {
  let parsed: unknown;
  try {
    parsed =
      schema.encoding === "enveloped" ? JSON.parse(decrypt(raw)) : JSON.parse(raw);
  } catch {
    return { version: null, payload: null };
  }

  if (!parsed || typeof parsed !== "object") {
    return { version: null, payload: parsed ?? null };
  }

  const container = parsed as Record<string, unknown>;
  const tag = container.version ?? container.schemaVersion;
  const version =
    typeof tag === "number" && Number.isFinite(tag) ? tag : null;

  const body = schema.encoding === "enveloped" ? container.data : parsed;

  return { version, payload: body ?? null };
}

interface VersionOutcome {
  /** "migrate" keeps the entry, "evict" drops it, "keep" leaves it alone. */
  readonly action: "keep" | "migrate" | "evict";
}

function resolveVersionAction(
  schema: ManagedSchema,
  entry: DecodedEntry,
  errors: string[],
): VersionOutcome {
  const { version } = entry;

  // Unparseable, or stored without any version tag: the owning module would
  // reject it on read anyway, so keeping it only burns quota.
  if (version === null) {
    errors.push(`${schema.key}: unreadable or unversioned payload`);
    return { action: "evict" };
  }

  // Written by a newer build. There is no ladder that walks backwards, and
  // reading it would mean trusting a shape this build cannot describe.
  if (version > schema.version) {
    errors.push(
      `${schema.key}: schema v${version} is newer than supported v${schema.version}`,
    );
    return { action: "evict" };
  }

  if (version === schema.version) {
    return { action: "keep" };
  }

  return { action: "migrate" };
}

/**
 * Rewrites an out-of-date `enveloped` entry to the current version.
 *
 * Returns the outcome so the caller can record the key accurately — a failed
 * write must not be reported as a successful migration.
 */
function migrateEntry(
  schema: ManagedSchema,
  entry: DecodedEntry,
  errors: string[],
): { outcome: "migrated" | "evicted" | "left-in-place" } {
  // `setItem` always re-stamps an `{ version, data }` envelope, so only
  // `enveloped` entries can round-trip through the shared ladder. Anything else
  // — the query cache included — must be evicted rather than rewritten into a
  // shape its reader does not expect.
  if (!schema.migratable || schema.encoding !== "enveloped") {
    errors.push(
      `${schema.key}: schema v${entry.version} has no migration path; evicted`,
    );
    return { outcome: "evicted" };
  }

  if (entry.version === null || entry.payload === null) {
    errors.push(`${schema.key}: migration skipped, payload body missing`);
    return { outcome: "left-in-place" };
  }

  // Delegated to the same ladder `./storage` applies on read, so a boot-time
  // migration cannot diverge from a lazy one.
  const migrated = migrateStorageData(schema.key, entry.payload, entry.version);

  if (migrated === null) {
    errors.push(
      `${schema.key}: no migration path from v${entry.version}; evicted`,
    );
    return { outcome: "evicted" };
  }

  // `setItem` re-encrypts and stamps the current version for us.
  if (!setItem(schema.key, migrated)) {
    errors.push(`${schema.key}: migration write failed; entry left in place`);
    return { outcome: "left-in-place" };
  }

  return { outcome: "migrated" };
}

// ─── Transaction retention ──────────────────────────────────────────────────────

function readTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < SECONDS_EPOCH_CEILING ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function readRecordTimestamp(record: unknown): number | null {
  if (!record || typeof record !== "object") return null;
  const candidate = record as Record<string, unknown>;
  for (const field of TIMESTAMP_FIELDS) {
    const parsed = readTimestamp(candidate[field]);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Drops every record dated before `cutoff`. Undated records are kept — a
 * record we cannot age is not a record we can call stale.
 */
function pruneDatedArray<T>(items: readonly T[], cutoff: number): { items: T[]; removed: number } {
  const kept: T[] = [];
  let removed = 0;

  for (const item of items) {
    const at = readRecordTimestamp(item);
    if (at !== null && at < cutoff) {
      removed += 1;
      continue;
    }
    kept.push(item);
  }

  return { items: kept, removed };
}

interface PruneOutcome {
  /** Rewritten payload, or `null` when there is nothing to write back. */
  readonly value: string | null;
  readonly removed: number;
  /** True when the payload was corrupt and should be evicted outright. */
  readonly corrupt: boolean;
}

/**
 * Applies the retention window to one history entry, understanding the three
 * shapes written across the codebase: a bare array (`tradeAnalytics`), a
 * `{ key, data, updatedAt }` record (`historySync`), and a `{ items }` bucket.
 */
function pruneTransactionPayload(raw: string, cutoff: number): PruneOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: null, removed: 0, corrupt: true };
  }

  if (Array.isArray(parsed)) {
    const { items, removed } = pruneDatedArray(parsed, cutoff);
    if (removed === 0) return { value: null, removed: 0, corrupt: false };
    return { value: JSON.stringify(items), removed, corrupt: false };
  }

  if (!parsed || typeof parsed !== "object") {
    return { value: null, removed: 0, corrupt: false };
  }

  const container = parsed as Record<string, unknown>;

  for (const field of ["data", "items"]) {
    const nested = container[field];
    if (!Array.isArray(nested)) continue;

    const { items, removed } = pruneDatedArray(nested, cutoff);
    if (removed === 0) return { value: null, removed: 0, corrupt: false };

    // `updatedAt` is intentionally preserved: `historySync` treats it as the
    // write stamp, and rewriting it would misrepresent when the record landed.
    return {
      value: JSON.stringify({ ...container, [field]: items }),
      removed,
      corrupt: false,
    };
  }

  return { value: null, removed: 0, corrupt: false };
}

// ─── Quota accounting ───────────────────────────────────────────────────────────

function isEvictableKey(key: string): boolean {
  if (key === QUERY_CACHE_KEY || key === TRADE_ANALYTICS_KEY) return true;
  if (key.startsWith(HISTORY_KEY_PREFIX)) return true;
  return VERSIONED_SCHEMAS.find((schema) => schema.key === key)?.disposable ?? false;
}

export function getStorageFootprint(
  maxBytes: number = MAX_STORAGE_QUOTA_BYTES,
): StorageFootprint {
  const storage = getStorage();
  if (!storage) {
    return {
      entries: [],
      totalBytes: 0,
      maxBytes,
      percentUsed: null,
      evictableBytes: 0,
    };
  }

  const entries: StorageEntrySize[] = [];
  let totalBytes = 0;
  let evictableBytes = 0;

  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;

      const bytes = byteLengthOf(storage.getItem(key) ?? "");
      entries.push({ key, bytes });
      totalBytes += bytes;
      if (isEvictableKey(key)) evictableBytes += bytes;
    }
  } catch {
    // Partial measurement is still better than none; the ceiling check below
    // simply becomes less precise.
  }

  entries.sort((a, b) => b.bytes - a.bytes);

  return {
    entries,
    totalBytes,
    maxBytes,
    percentUsed: maxBytes > 0 ? (totalBytes / maxBytes) * 100 : null,
    evictableBytes,
  };
}

/**
 * Real origin quota from the Storage API, for display only. Returns `null`
 * where `navigator.storage.estimate()` is unavailable (Safari < 17, Firefox).
 */
export async function getOriginQuotaBytes(): Promise<number | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    return typeof estimate.quota === "number" && estimate.quota > 0
      ? estimate.quota
      : null;
  } catch {
    return null;
  }
}

// ─── Passes ─────────────────────────────────────────────────────────────────────

function runVersionPass(
  storage: Storage,
  migratedKeys: string[],
  evictedKeys: string[],
  errors: string[],
): void {
  for (const schema of VERSIONED_SCHEMAS) {
    const raw = readRaw(storage, schema.key);
    if (raw === null) continue;

    const entry = decodeEntry(schema, raw);
    const outcome = resolveVersionAction(schema, entry, errors);

    if (outcome.action === "evict") {
      if (deleteKey(storage, schema.key)) {
        evictedKeys.push(schema.key);
      } else {
        errors.push(`${schema.key}: stale entry could not be removed`);
      }
      continue;
    }

    if (outcome.action === "migrate") {
      const result = migrateEntry(schema, entry, errors);

      if (result.outcome === "migrated") {
        migratedKeys.push(schema.key);
        continue;
      }

      if (result.outcome === "evicted" && deleteKey(storage, schema.key)) {
        evictedKeys.push(schema.key);
      }
      // "left-in-place" keeps the existing value; nothing to report beyond the
      // error already recorded.
    }
  }
}

function runRetentionPass(
  storage: Storage,
  cutoff: number,
  evictedKeys: string[],
  errors: string[],
): number {
  let removedTotal = 0;

  let keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && (key === TRADE_ANALYTICS_KEY || key.startsWith(HISTORY_KEY_PREFIX))) {
        keys.push(key);
      }
    }
  } catch (error) {
    errors.push(`retention pass: unable to enumerate keys (${describeError(error)})`);
    return 0;
  }

  for (const key of keys) {
    const raw = readRaw(storage, key);
    if (raw === null) continue;

    const outcome = pruneTransactionPayload(raw, cutoff);
    removedTotal += outcome.removed;

    if (outcome.corrupt) {
      if (deleteKey(storage, key)) {
        errors.push(`${key}: unparseable history payload; evicted`);
        evictedKeys.push(key);
      } else {
        errors.push(`${key}: unparseable history payload, but could not be removed`);
      }
      continue;
    }

    if (outcome.value === null) continue;

    try {
      storage.setItem(key, outcome.value);
    } catch (error) {
      errors.push(`${key}: retention write rejected (${describeError(error)})`);
    }
  }

  return removedTotal;
}

function runQuotaPass(
  storage: Storage,
  maxBytes: number,
  evictedKeys: string[],
  errors: string[],
): { bytesBefore: number; bytesAfter: number; enforced: boolean } {
  const before = getStorageFootprint(maxBytes);

  if (before.totalBytes <= maxBytes) {
    return { bytesBefore: before.totalBytes, bytesAfter: before.totalBytes, enforced: false };
  }

  const target = Math.max(maxBytes - QUOTA_HEADROOM_BYTES, 0);
  let runningTotal = before.totalBytes;
  let enforced = false;

  // Largest first: the fewest possible deletions to get back under the ceiling.
  const candidates = before.entries.filter((entry) => isEvictableKey(entry.key));

  for (const entry of candidates) {
    if (runningTotal <= target) break;

    if (!deleteKey(storage, entry.key)) {
      errors.push(`${entry.key}: could not be removed to reclaim quota`);
      continue;
    }

    runningTotal -= entry.bytes;
    enforced = true;
    if (!evictedKeys.includes(entry.key)) evictedKeys.push(entry.key);
  }

  if (!enforced) {
    errors.push(
      `quota pass: ${before.totalBytes} bytes exceeds ${maxBytes} but no disposable entries remain`,
    );
  }

  return { bytesBefore: before.totalBytes, bytesAfter: runningTotal, enforced };
}

// ─── Throttle state ─────────────────────────────────────────────────────────────

function readLastRunAt(storage: Storage): number | null {
  const raw = readRaw(storage, SANITIZER_STATE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const at = (parsed as Record<string, unknown>).lastRunAt;
    return typeof at === "number" && Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

function writeLastRunAt(storage: Storage, now: number): void {
  try {
    storage.setItem(
      SANITIZER_STATE_KEY,
      JSON.stringify({ version: 1, lastRunAt: now }),
    );
  } catch {
    // Bookkeeping is best-effort; a miss only costs an extra pass next boot.
  }
}

function skip(ranAt: number, reason: SanitizerSkipReason): SanitizerReport {
  return {
    ranAt,
    skipped: true,
    skipReason: reason,
    migratedKeys: [],
    evictedKeys: [],
    transactionsRemoved: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    quotaEnforced: false,
    errors: [],
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.name;
  return String(error);
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Runs a single cleanup pass over local storage.
 *
 * Synchronous and total: it either returns a report describing what it did, or
 * a report describing why it did nothing. It never throws.
 */
export function sanitizeLocalStorage(options: SanitizeOptions = {}): SanitizerReport {
  const now = options.now ?? Date.now();
  const maxBytes = options.maxBytes ?? MAX_STORAGE_QUOTA_BYTES;
  const retentionMs = options.retentionMs ?? TRANSACTION_RETENTION_MS;
  const cutoff = now - retentionMs;

  let report: SanitizerReport;
  try {
    const storage = getStorage();
    if (!storage) {
      report = skip(now, typeof window === "undefined" ? "server" : "storage-unavailable");
      lastReport = report;
      return report;
    }

    if (!options.force) {
      const lastRunAt = readLastRunAt(storage);
      if (lastRunAt !== null && now - lastRunAt < SANITIZER_MIN_INTERVAL_MS) {
        report = skip(now, "throttled");
        lastReport = report;
        return report;
      }
    }

    const errors: string[] = [];
    const migratedKeys: string[] = [];
    const evictedKeys: string[] = [];

    const before = getStorageFootprint(maxBytes);

    runVersionPass(storage, migratedKeys, evictedKeys, errors);
    const transactionsRemoved = runRetentionPass(
      storage,
      cutoff,
      evictedKeys,
      errors,
    );
    const quota = runQuotaPass(storage, maxBytes, evictedKeys, errors);

    writeLastRunAt(storage, now);

    report = {
      ranAt: now,
      skipped: false,
      skipReason: null,
      migratedKeys,
      evictedKeys,
      transactionsRemoved,
      bytesBefore: before.totalBytes,
      bytesAfter: quota.bytesAfter,
      quotaEnforced: quota.enforced,
      errors,
    };
  } catch (error) {
    // Defence in depth: the inner passes already guard themselves, so reaching
    // here means something unforeseen. Swallow it — boot must continue.
    report = {
      ranAt: now,
      skipped: true,
      skipReason: "storage-unavailable",
      migratedKeys: [],
      evictedKeys: [],
      transactionsRemoved: 0,
      bytesBefore: 0,
      bytesAfter: 0,
      quotaEnforced: false,
      errors: [`unhandled sanitizer failure: ${describeError(error)}`],
    };
  }

  lastReport = report;
  return report;
}

/**
 * Manual "Clear Local Data Cache" used by the settings screen.
 *
 * Deletes every disposable entry — the query cache and all local transaction
 * history — and leaves identity-bearing state (wallet session, theme, address
 * book, custom tokens) untouched, so clearing the cache never signs a user out.
 */
export function clearLocalDataCache(): ClearCacheResult {
  const clearedKeys: string[] = [];
  const preservedKeys: string[] = [];
  const errors: string[] = [];

  try {
    const storage = getStorage();
    if (!storage) {
      return { clearedKeys, preservedKeys, bytesFreed: 0, errors: ["storage-unavailable"] };
    }

    let freed = 0;

    const keys: string[] = [];
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key) keys.push(key);
      }
    } catch (error) {
      errors.push(`unable to enumerate keys (${describeError(error)})`);
    }

    for (const key of keys) {
      if (isEvictableKey(key)) {
        const bytes = byteLengthOf(readRaw(storage, key) ?? "");
        if (!deleteKey(storage, key)) {
          errors.push(`${key}: could not be removed`);
          continue;
        }
        freed += bytes;
        clearedKeys.push(key);
      } else if (key !== SANITIZER_STATE_KEY) {
        preservedKeys.push(key);
      }
    }

    // Drop the throttle marker too, so the next boot re-runs the full pass
    // against the space that was just reclaimed.
    deleteKey(storage, SANITIZER_STATE_KEY);

    return { clearedKeys, preservedKeys, bytesFreed: Math.max(freed, 0), errors };
  } catch (error) {
    errors.push(`cache clear failed: ${describeError(error)}`);
    return { clearedKeys, preservedKeys, bytesFreed: 0, errors };
  }
}
