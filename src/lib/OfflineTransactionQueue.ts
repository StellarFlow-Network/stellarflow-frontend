/**
 * Offline Transaction Draft Storage & Auto-Sync Engine (#995)
 *
 * IndexedDB-backed draft storage that lets users on weak mobile networks
 * compose a transaction while offline, keep the composed parameters on-device,
 * and submit the queued drafts once connectivity is restored.
 *
 * Design notes
 * ------------
 * - Framework-free. This module imports nothing (no React, no SDKs) so it can be
 *   unit-tested with `node --test`, reused from a web worker, and bundled
 *   without pulling the Stellar SDK into the initial payload.
 * - Persistence first. The IndexedDB record is the source of truth; the
 *   in-memory {@link OfflineDraftQueueState} is only a projection used for
 *   rendering. Nothing is ever "queued in memory only".
 * - Transport-agnostic submission. The queue cannot know how a given compose
 *   flow signs/submits (Freighter, xBull, Ledger, ...), so submission is a
 *   pluggable {@link OfflineDraftSubmitHandler} registered per draft kind by the
 *   compose flow. Unhandled kinds are reported as `no-handler` and left
 *   untouched instead of being burned through retry attempts.
 * - Auto-sync is user-confirmed. Drafts are never broadcast silently; restoring
 *   connectivity opens a prompt and the user chooses what to submit.
 *
 * Storage layout
 * --------------
 * Database: `stellarflow-offline-queue` (v1)
 * Store:    `transaction_drafts`, keyPath `id`
 * Indexes:  `by-created-at` (createdAt) and `by-status` (status)
 *
 * React binding lives in `src/app/hooks/useOfflineDraftQueue.ts` and the
 * banner / prompt / drawer UI in `src/components/offline/`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const OFFLINE_QUEUE_DB_NAME = "stellarflow-offline-queue";
export const OFFLINE_QUEUE_DB_VERSION = 1;
export const OFFLINE_QUEUE_STORE = "transaction_drafts";
export const OFFLINE_QUEUE_CREATED_AT_INDEX = "by-created-at";
export const OFFLINE_QUEUE_STATUS_INDEX = "by-status";

/** Drafts older than this are garbage-collected on hydrate / refresh / sync. */
export const DEFAULT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A draft stops auto-retrying (and flips to `failed`) after this many attempts. */
export const MAX_DRAFT_ATTEMPTS = 5;

/** Default network tag for composed drafts when the compose flow omits one. */
export const DEFAULT_OFFLINE_DRAFT_NETWORK = "testnet";

export const OFFLINE_DRAFT_KINDS = [
  "swap",
  "liquidity",
  "remittance",
  "staking",
  "payment",
  "generic",
] as const;

export type OfflineDraftKind = (typeof OFFLINE_DRAFT_KINDS)[number];

export const OFFLINE_DRAFT_KIND_LABELS: Record<OfflineDraftKind, string> = {
  swap: "Swap",
  liquidity: "Liquidity",
  remittance: "Remittance",
  staking: "Staking",
  payment: "Payment",
  generic: "Transaction",
};

export const OFFLINE_DRAFT_STATUSES = ["pending", "syncing", "failed"] as const;

export type OfflineDraftStatus = (typeof OFFLINE_DRAFT_STATUSES)[number];

/** Composed transaction parameters, exactly as serialized for the wallet. */
export type OfflineDraftParams = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A persisted offline transaction draft. Every field is JSON/structured-clone
 * safe so the record round-trips through IndexedDB unchanged.
 */
export interface OfflineTransactionDraft {
  /** Stable draft id (`draft_<uuid>`), also the IndexedDB primary key. */
  id: string;
  /** Which compose flow produced the draft. */
  kind: OfflineDraftKind;
  /** Retry state of the draft. */
  status: OfflineDraftStatus;
  /** Stellar network the parameters were composed for. */
  network: string;
  /** Source account (G...) the draft was composed for, when known. */
  sourceAccount: string | null;
  /** Composed transaction parameters. */
  params: OfflineDraftParams;
  /** Optional human label shown in the queue drawer. */
  label: string | null;
  /** Epoch ms the draft was created. */
  createdAt: number;
  /** Epoch ms the draft record was last mutated. */
  updatedAt: number;
  /** Epoch ms after which the draft is considered stale and is purged. */
  expiresAt: number;
  /** Number of submission attempts that threw. */
  attempts: number;
  /** Epoch ms of the most recent submission attempt. */
  lastAttemptAt: number | null;
  /** Message from the most recent failed submission attempt. */
  lastError: string | null;
  /** Transaction hash when the draft was submitted successfully. */
  submittedHash: string | null;
}

/** Caller-supplied draft payload; the queue fills id/status/timestamps in. */
export interface OfflineDraftInput {
  id?: string;
  kind: OfflineDraftKind;
  network?: string;
  sourceAccount?: string | null;
  params: OfflineDraftParams;
  label?: string | null;
  ttlMs?: number;
  createdAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested without IndexedDB)
// ─────────────────────────────────────────────────────────────────────────────

export class OfflineDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineDraftValidationError";
  }
}

function isPlainRecord(value: unknown): value is OfflineDraftParams {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDraft(draft: OfflineTransactionDraft): OfflineTransactionDraft {
  if (typeof structuredClone === "function") {
    return structuredClone(draft);
  }
  return JSON.parse(JSON.stringify(draft)) as OfflineTransactionDraft;
}

/** Stable, collision-resistant draft id that does not depend on `uuid`. */
export function generateOfflineDraftId(): string {
  const globalCrypto = typeof crypto !== "undefined" ? crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `draft_${globalCrypto.randomUUID()}`;
  }
  return `draft_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Human-readable message from anything a submit handler may throw. */
export function describeDraftError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : "Unknown error";
  } catch {
    return "Unknown error";
  }
}

/** Title shown for a draft in the banner / prompt / drawer. */
export function formatDraftKindLabel(kind: OfflineDraftKind): string {
  return OFFLINE_DRAFT_KIND_LABELS[kind] ?? OFFLINE_DRAFT_KIND_LABELS.generic;
}

export function formatDraftLabel(
  draft: Pick<OfflineTransactionDraft, "label" | "kind">,
): string {
  const label = draft.label?.trim();
  return label && label.length > 0 ? label : formatDraftKindLabel(draft.kind);
}

function formatDraftParamValue(value: unknown, maxLength = 28): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.length} items]`;
  return "[object]";
}

/** One-line preview of the stored parameters, e.g. `amount=100, asset=XLM`. */
export function describeDraftParams(
  draft: Pick<OfflineTransactionDraft, "params">,
  maxKeys = 3,
): string {
  const entries = Object.entries(draft.params ?? {});
  if (entries.length === 0) return "no parameters";

  const shown = entries
    .slice(0, Math.max(maxKeys, 1))
    .map(([key, value]) => `${key}=${formatDraftParamValue(value)}`);
  const hidden = entries.length - shown.length;

  return hidden > 0 ? `${shown.join(", ")} (+${hidden} more)` : shown.join(", ");
}

/** Coarse relative age used in the draft list (no dependency on a date lib). */
export function formatDraftAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 45_000) return "just now";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isDraftExpired(
  draft: Pick<OfflineTransactionDraft, "expiresAt">,
  now: number = Date.now(),
): boolean {
  return draft.expiresAt <= now;
}

/** A draft may be (re)submitted only while pending and under the attempt cap. */
export function isDraftRetryable(
  draft: Pick<OfflineTransactionDraft, "status" | "attempts" | "expiresAt">,
  now: number = Date.now(),
  maxAttempts: number = MAX_DRAFT_ATTEMPTS,
): boolean {
  if (draft.status === "failed" || draft.status === "syncing") return false;
  if (draft.attempts >= maxAttempts) return false;
  return !isDraftExpired(draft, now);
}

export function sortDraftsNewestFirst(
  drafts: readonly OfflineTransactionDraft[],
): OfflineTransactionDraft[] {
  return [...drafts].sort(
    (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  );
}

export function sortDraftsOldestFirst(
  drafts: readonly OfflineTransactionDraft[],
): OfflineTransactionDraft[] {
  return [...drafts].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}

export interface OfflineDraftQueueCounts {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
  expired: number;
  oldestCreatedAt: number | null;
}

export function summarizeDraftQueue(
  drafts: readonly OfflineTransactionDraft[],
  now: number = Date.now(),
): OfflineDraftQueueCounts {
  const counts: OfflineDraftQueueCounts = {
    total: drafts.length,
    pending: 0,
    syncing: 0,
    failed: 0,
    expired: 0,
    oldestCreatedAt: null,
  };

  for (const draft of drafts) {
    if (isDraftExpired(draft, now)) {
      // Expired drafts are not submittable, so they are counted only once —
      // in their own bucket — and never inflate `pending`/`failed`.
      counts.expired += 1;
      continue;
    }

    if (draft.status === "pending") counts.pending += 1;
    else if (draft.status === "syncing") counts.syncing += 1;
    else if (draft.status === "failed") counts.failed += 1;

    if (counts.oldestCreatedAt === null || draft.createdAt < counts.oldestCreatedAt) {
      counts.oldestCreatedAt = draft.createdAt;
    }
  }

  return counts;
}

export interface OfflineDraftNormalizeOptions {
  now?: number;
  idFactory?: () => string;
}

/**
 * Validates a caller payload and produces the durable record that is written to
 * IndexedDB. Throws {@link OfflineDraftValidationError} on bad input so a
 * malformed draft can never reach storage.
 */
export function normalizeDraftInput(
  input: OfflineDraftInput,
  options: OfflineDraftNormalizeOptions = {},
): OfflineTransactionDraft {
  if (!isPlainRecord(input)) {
    throw new OfflineDraftValidationError("Draft input must be an object.");
  }

  const kind = input.kind;
  if (
    typeof kind !== "string" ||
    !(OFFLINE_DRAFT_KINDS as readonly string[]).includes(kind)
  ) {
    throw new OfflineDraftValidationError(
      `Unsupported draft kind: ${String(kind)}. Expected one of ${OFFLINE_DRAFT_KINDS.join(", ")}.`,
    );
  }

  if (!isPlainRecord(input.params)) {
    throw new OfflineDraftValidationError(
      "Draft params must be a plain object of composed transaction parameters.",
    );
  }

  if (Object.keys(input.params).length === 0) {
    throw new OfflineDraftValidationError(
      "Draft params must contain at least one transaction parameter.",
    );
  }

  const now = options.now ?? Date.now();
  const ttlMs = input.ttlMs ?? DEFAULT_DRAFT_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new OfflineDraftValidationError(
      `Draft ttl must be a positive number of milliseconds, received ${String(ttlMs)}.`,
    );
  }

  const createdAt =
    typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
      ? input.createdAt
      : now;

  const explicitId = typeof input.id === "string" ? input.id.trim() : "";
  const id = explicitId || options.idFactory?.() || generateOfflineDraftId();

  const sourceAccount =
    typeof input.sourceAccount === "string" && input.sourceAccount.trim().length > 0
      ? input.sourceAccount.trim()
      : null;

  const label =
    typeof input.label === "string" && input.label.trim().length > 0
      ? input.label.trim()
      : null;

  const network =
    typeof input.network === "string" && input.network.trim().length > 0
      ? input.network.trim()
      : DEFAULT_OFFLINE_DRAFT_NETWORK;

  return {
    id,
    kind: kind as OfflineDraftKind,
    status: "pending",
    network,
    sourceAccount,
    params: { ...input.params },
    label,
    createdAt,
    updatedAt: now,
    expiresAt: createdAt + ttlMs,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    submittedHash: null,
  };
}

/** True when the browser reports that it has no connectivity. */
export function isBrowserOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.onLine !== "boolean") return false;
  return navigator.onLine === false;
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage drivers
// ─────────────────────────────────────────────────────────────────────────────

export type OfflineQueueDriverKind = "indexeddb" | "memory";

/** Minimal persistence contract; swapped for an in-memory driver in tests/SSR. */
export interface OfflineQueueDriver {
  readonly kind: OfflineQueueDriverKind;
  getAll(): Promise<OfflineTransactionDraft[]>;
  put(draft: OfflineTransactionDraft): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

interface OfflineQueueSchemaStore {
  keyPath: string;
}

const OFFLINE_QUEUE_STORE_SCHEMA: OfflineQueueSchemaStore = { keyPath: "id" };

class IndexedDbOfflineQueueDriver implements OfflineQueueDriver {
  readonly kind: OfflineQueueDriverKind = "indexeddb";

  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this environment."));
        return;
      }

      const request = indexedDB.open(
        OFFLINE_QUEUE_DB_NAME,
        OFFLINE_QUEUE_DB_VERSION,
      );

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
          const store = db.createObjectStore(
            OFFLINE_QUEUE_STORE,
            OFFLINE_QUEUE_STORE_SCHEMA,
          );
          store.createIndex(OFFLINE_QUEUE_CREATED_AT_INDEX, "createdAt");
          store.createIndex(OFFLINE_QUEUE_STATUS_INDEX, "status");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to open the offline queue database."));
      request.onblocked = () =>
        reject(
          new Error(
            "Offline queue database upgrade is blocked by another open tab.",
          ),
        );
    });

    this.dbPromise = promise;
    void promise.catch(() => {
      if (this.dbPromise === promise) this.dbPromise = null;
    });

    return promise;
  }

  private withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return this.open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(OFFLINE_QUEUE_STORE, mode);
          const request = run(transaction.objectStore(OFFLINE_QUEUE_STORE));

          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () =>
            reject(request.error ?? new Error("Offline queue request failed."));
          transaction.onabort = () =>
            reject(
              transaction.error ?? new Error("Offline queue transaction aborted."),
            );
        }),
    );
  }

  async getAll(): Promise<OfflineTransactionDraft[]> {
    const records = await this.withStore<OfflineTransactionDraft[]>(
      "readonly",
      (store) =>
        store.getAll() as unknown as IDBRequest<OfflineTransactionDraft[]>,
    );
    return Array.isArray(records) ? records : [];
  }

  async put(draft: OfflineTransactionDraft): Promise<void> {
    await this.withStore<IDBValidKey>("readwrite", (store) =>
      store.put(cloneDraft(draft)),
    );
  }

  async remove(id: string): Promise<void> {
    await this.withStore<undefined>("readwrite", (store) => store.delete(id));
  }

  async clear(): Promise<void> {
    await this.withStore<undefined>("readwrite", (store) => store.clear());
  }
}

/**
 * In-memory driver. Used by unit tests and as the graceful fallback when the
 * page is rendered in an environment without IndexedDB (SSR, private-mode
 * browsers, embedded webviews).
 */
export function createMemoryOfflineQueueDriver(
  seed: readonly OfflineTransactionDraft[] = [],
): OfflineQueueDriver {
  const records = new Map<string, OfflineTransactionDraft>();
  for (const draft of seed) {
    records.set(draft.id, cloneDraft(draft));
  }

  return {
    kind: "memory",
    async getAll() {
      return [...records.values()].map(cloneDraft);
    },
    async put(draft) {
      records.set(draft.id, cloneDraft(draft));
    },
    async remove(id) {
      records.delete(id);
    },
    async clear() {
      records.clear();
    },
  };
}

/** IndexedDB when the browser has it, in-memory otherwise. */
export function createDefaultOfflineQueueDriver(): OfflineQueueDriver {
  if (isIndexedDbAvailable()) {
    return new IndexedDbOfflineQueueDriver();
  }
  return createMemoryOfflineQueueDriver();
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submission callback registered by a compose flow. Receives the persisted
 * draft (with `params` exactly as composed) and resolves with the transaction
 * hash when the submission succeeded. Throwing keeps the draft queued.
 */
export type OfflineDraftSubmitHandler = (
  draft: OfflineTransactionDraft,
) => Promise<string | void> | string | void;

export interface OfflineDraftSyncResult {
  id: string;
  status: "submitted" | "failed" | "no-handler";
  hash?: string;
  error?: string;
}

export interface OfflineDraftSyncSummary {
  results: OfflineDraftSyncResult[];
  submitted: OfflineDraftSyncResult[];
  failed: OfflineDraftSyncResult[];
  skipped: OfflineDraftSyncResult[];
  submittedCount: number;
  failedCount: number;
  skippedCount: number;
}

export function buildOfflineDraftSyncSummary(
  results: readonly OfflineDraftSyncResult[],
): OfflineDraftSyncSummary {
  const submitted = results.filter((result) => result.status === "submitted");
  const failed = results.filter((result) => result.status === "failed");
  const skipped = results.filter((result) => result.status === "no-handler");

  return {
    results: [...results],
    submitted,
    failed,
    skipped,
    submittedCount: submitted.length,
    failedCount: failed.length,
    skippedCount: skipped.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineTransactionQueueOptions {
  driver?: OfflineQueueDriver;
  now?: () => number;
  idFactory?: () => string;
  maxAttempts?: number;
}

/**
 * Durable transaction draft queue.
 *
 * All mutations go through the driver first and only then update the caller, so
 * a draft is never reported as saved unless it is actually persisted.
 */
export class OfflineTransactionQueue {
  private readonly injectedDriver: OfflineQueueDriver | undefined;
  private readonly nowFn: () => number;
  private readonly idFactory: (() => string) | undefined;
  private readonly maxAttempts: number;
  private resolvedDriver: OfflineQueueDriver | null = null;

  constructor(options: OfflineTransactionQueueOptions = {}) {
    this.injectedDriver = options.driver;
    this.nowFn = options.now ?? (() => Date.now());
    this.idFactory = options.idFactory;
    this.maxAttempts = options.maxAttempts ?? MAX_DRAFT_ATTEMPTS;
  }

  private driver(): OfflineQueueDriver {
    if (this.injectedDriver) return this.injectedDriver;
    this.resolvedDriver ??= createDefaultOfflineQueueDriver();
    return this.resolvedDriver;
  }

  get driverKind(): OfflineQueueDriverKind {
    return this.driver().kind;
  }

  get attemptLimit(): number {
    return this.maxAttempts;
  }

  private now(): number {
    return this.nowFn();
  }

  /**
   * Current time according to the queue's clock. Exposed so the store computes
   * expiry/`syncedAt` timestamps from the same source as the persistence layer.
   */
  timestamp(): number {
    return this.nowFn();
  }

  private newDraft(input: OfflineDraftInput): OfflineTransactionDraft {
    return normalizeDraftInput(input, {
      now: this.now(),
      idFactory: this.idFactory,
    });
  }

  /**
   * Loads every persisted draft, purging expired records and recovering drafts
   * left in the transient `syncing` state by an interrupted page unload.
   */
  async hydrate(): Promise<OfflineTransactionDraft[]> {
    const driver = this.driver();
    const records = await driver.getAll();
    const now = this.now();
    const drafts: OfflineTransactionDraft[] = [];

    for (const record of records) {
      if (isDraftExpired(record, now)) {
        await driver.remove(record.id);
        continue;
      }

      if (record.status === "syncing") {
        // The tab was closed/reloaded mid-submission; the draft is still on
        // device so put it back into the retryable pending state.
        const recovered: OfflineTransactionDraft = {
          ...record,
          status: record.attempts >= this.maxAttempts ? "failed" : "pending",
          updatedAt: now,
        };
        await driver.put(recovered);
        drafts.push(recovered);
        continue;
      }

      drafts.push(record);
    }

    return sortDraftsNewestFirst(drafts);
  }

  async listAll(): Promise<OfflineTransactionDraft[]> {
    return sortDraftsNewestFirst(await this.driver().getAll());
  }

  async listPending(): Promise<OfflineTransactionDraft[]> {
    const drafts = await this.driver().getAll();
    const now = this.now();
    return sortDraftsOldestFirst(
      drafts.filter((draft) => isDraftRetryable(draft, now, this.maxAttempts)),
    );
  }

  async get(id: string): Promise<OfflineTransactionDraft | null> {
    const drafts = await this.driver().getAll();
    return drafts.find((draft) => draft.id === id) ?? null;
  }

  async count(): Promise<number> {
    return (await this.driver().getAll()).length;
  }

  /** Persists a new draft. Resolves with the stored record. */
  async enqueue(input: OfflineDraftInput): Promise<OfflineTransactionDraft> {
    const draft = this.newDraft(input);
    await this.driver().put(draft);
    return draft;
  }

  /** Persists a draft only when the browser is offline (or `force` is set). */
  async enqueueIfOffline(
    input: OfflineDraftInput,
    options: { force?: boolean } = {},
  ): Promise<OfflineTransactionDraft | null> {
    if (!options.force && !isBrowserOffline()) return null;
    return this.enqueue(input);
  }

  async remove(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) return false;
    await this.driver().remove(id);
    return true;
  }

  async clear(): Promise<void> {
    await this.driver().clear();
  }

  /** Deletes drafts past their TTL and resolves with the number removed. */
  async purgeExpired(): Promise<number> {
    const driver = this.driver();
    const now = this.now();
    const drafts = await driver.getAll();
    let purged = 0;

    for (const draft of drafts) {
      if (isDraftExpired(draft, now)) {
        await driver.remove(draft.id);
        purged += 1;
      }
    }

    return purged;
  }

  /**
   * Submits one draft through `handler`.
   *
   * - success → the draft is deleted from IndexedDB and the hash returned;
   * - thrown error → `attempts` is incremented and the draft stays `pending`
   *   until {@link MAX_DRAFT_ATTEMPTS} is reached, then flips to `failed`;
   * - expired or missing → removed / reported without submitting.
   */
  async syncDraft(
    id: string,
    handler: OfflineDraftSubmitHandler,
  ): Promise<OfflineDraftSyncResult> {
    const draft = await this.get(id);

    if (!draft) {
      return { id, status: "failed", error: "Offline draft no longer exists." };
    }

    if (typeof handler !== "function") {
      return {
        id,
        status: "no-handler",
        error: `No submit handler registered for "${draft.kind}" drafts.`,
      };
    }

    const now = this.now();
    if (isDraftExpired(draft, now)) {
      await this.driver().remove(id);
      return {
        id,
        status: "failed",
        error: "Offline draft expired before it could be submitted.",
      };
    }

    const syncing: OfflineTransactionDraft = {
      ...draft,
      status: "syncing",
      updatedAt: now,
      lastAttemptAt: now,
    };
    await this.driver().put(syncing);

    try {
      const result = await handler(syncing);
      const hash = typeof result === "string" && result.length > 0 ? result : undefined;
      await this.driver().remove(id);
      return { id, status: "submitted", hash };
    } catch (error) {
      const attempts = draft.attempts + 1;
      const message = describeDraftError(error);
      const failedRecord: OfflineTransactionDraft = {
        ...draft,
        status: attempts >= this.maxAttempts ? "failed" : "pending",
        attempts,
        updatedAt: now,
        lastAttemptAt: now,
        lastError: message,
      };
      await this.driver().put(failedRecord);
      return { id, status: "failed", error: message };
    }
  }

  /** Submits the given drafts in FIFO order and aggregates the outcome. */
  async syncDrafts(
    ids: readonly string[],
    handler: OfflineDraftSubmitHandler,
  ): Promise<OfflineDraftSyncSummary> {
    const results: OfflineDraftSyncResult[] = [];
    for (const id of ids) {
      results.push(await this.syncDraft(id, handler));
    }
    return buildOfflineDraftSyncSummary(results);
  }

  /** Submits every retryable `pending` draft (oldest first). */
  async syncPendingDrafts(
    handler: OfflineDraftSubmitHandler,
  ): Promise<OfflineDraftSyncSummary> {
    const pending = await this.listPending();
    return this.syncDrafts(
      pending.map((draft) => draft.id),
      handler,
    );
  }
}

/** Process-wide queue used by the UI layer. */
export const offlineTransactionQueue = new OfflineTransactionQueue();

// ─────────────────────────────────────────────────────────────────────────────
// External store (React binding via `useSyncExternalStore`)
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineDraftQueueState {
  /** Newest-first projection of what is persisted in IndexedDB. */
  drafts: OfflineTransactionDraft[];
  counts: OfflineDraftQueueCounts;
  /** True once the first IndexedDB read has completed. */
  hydrated: boolean;
  /** True while an IndexedDB operation is in flight. */
  busy: boolean;
  /** True while drafts are being submitted. */
  submitting: boolean;
  /** Draft queue management drawer visibility. */
  drawerOpen: boolean;
  /** "Connection restored — submit your drafts?" prompt visibility. */
  promptOpen: boolean;
  /** True when the user dismissed the reconnect prompt for this session. */
  promptDismissed: boolean;
  /** Id of the most recently saved draft (drives the saved banner). */
  lastSavedDraftId: string | null;
  /** Epoch ms of the most recent successful save. */
  lastSavedAt: number | null;
  /** Epoch ms of the most recent successful submission. */
  lastSyncedAt: number | null;
  /** Outcome of the most recent batch submission. */
  lastSummary: OfflineDraftSyncSummary | null;
  /** Last user-facing error. */
  error: string | null;
  /** Which persistence driver is active (`indexeddb` / `memory`). */
  storageDriver: OfflineQueueDriverKind;
}

export interface OfflineDraftStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): OfflineDraftQueueState;
  getServerSnapshot(): OfflineDraftQueueState;
  hydrate(): Promise<void>;
  refresh(): Promise<void>;
  saveDraft(input: OfflineDraftInput): Promise<OfflineTransactionDraft>;
  saveDraftIfOffline(
    input: OfflineDraftInput,
    options?: { force?: boolean },
  ): Promise<OfflineTransactionDraft | null>;
  deleteDraft(id: string): Promise<void>;
  clearDrafts(): Promise<void>;
  submitDraft(id: string): Promise<OfflineDraftSyncResult>;
  submitAllDrafts(): Promise<OfflineDraftSyncSummary>;
  registerSubmitHandler(
    kind: OfflineDraftKind | "*",
    handler: OfflineDraftSubmitHandler,
  ): () => void;
  openDrawer(): void;
  closeDrawer(): void;
  openPrompt(): void;
  closePrompt(): void;
  dismissPrompt(): void;
  resetPromptDismissal(): void;
  acknowledgeSavedBanner(): void;
  setError(message: string | null): void;
}

const EMPTY_COUNTS: OfflineDraftQueueCounts = {
  total: 0,
  pending: 0,
  syncing: 0,
  failed: 0,
  expired: 0,
  oldestCreatedAt: null,
};

const SERVER_SNAPSHOT: OfflineDraftQueueState = {
  drafts: [],
  counts: EMPTY_COUNTS,
  hydrated: false,
  busy: false,
  submitting: false,
  drawerOpen: false,
  promptOpen: false,
  promptDismissed: false,
  lastSavedDraftId: null,
  lastSavedAt: null,
  lastSyncedAt: null,
  lastSummary: null,
  error: null,
  storageDriver: "memory",
};

function resolveSubmitHandler(
  handlers: Map<string, OfflineDraftSubmitHandler>,
  kind: OfflineDraftKind,
): OfflineDraftSubmitHandler | undefined {
  return handlers.get(kind) ?? handlers.get("*");
}

/**
 * Creates an isolated queue store. The module-level {@link offlineDraftStore}
 * is the instance the app uses; tests build their own with an in-memory driver.
 */
export function createOfflineDraftStore(
  queue: OfflineTransactionQueue = offlineTransactionQueue,
): OfflineDraftStore {
  const listeners = new Set<() => void>();
  const handlers = new Map<string, OfflineDraftSubmitHandler>();

  let state: OfflineDraftQueueState = {
    ...SERVER_SNAPSHOT,
    storageDriver: queue.driverKind,
  };

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const setState = (patch: Partial<OfflineDraftQueueState>) => {
    state = { ...state, ...patch };
    emit();
  };

  const publishDrafts = (
    drafts: readonly OfflineTransactionDraft[],
    patch: Partial<OfflineDraftQueueState> = {},
  ) => {
    setState({
      drafts: sortDraftsNewestFirst(drafts),
      counts: summarizeDraftQueue(drafts, queue.timestamp()),
      ...patch,
    });
  };

  const saveDraft = async (
    input: OfflineDraftInput,
  ): Promise<OfflineTransactionDraft> => {
    try {
      await queue.purgeExpired();
      const draft = await queue.enqueue(input);
      publishDrafts(await queue.listAll(), {
        hydrated: true,
        lastSavedDraftId: draft.id,
        lastSavedAt: draft.createdAt,
        error: null,
      });
      return draft;
    } catch (error) {
      const message = describeDraftError(error);
      setState({ error: message });
      throw error;
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return state;
    },

    getServerSnapshot() {
      return SERVER_SNAPSHOT;
    },

    async hydrate() {
      if (state.hydrated || state.busy) return;
      setState({ busy: true, error: null });
      try {
        const drafts = await queue.hydrate();
        publishDrafts(drafts, { hydrated: true, busy: false });
      } catch (error) {
        setState({ busy: false, error: describeDraftError(error) });
      }
    },

    async refresh() {
      try {
        const drafts = await queue.listAll();
        publishDrafts(drafts, { hydrated: true, error: null });
      } catch (error) {
        setState({ error: describeDraftError(error) });
      }
    },

    saveDraft,

    async saveDraftIfOffline(input, options = {}) {
      if (!options.force && !isBrowserOffline()) return null;
      return saveDraft(input);
    },

    async deleteDraft(id) {
      try {
        await queue.remove(id);
        publishDrafts(await queue.listAll(), { error: null });
      } catch (error) {
        setState({ error: describeDraftError(error) });
      }
    },

    async clearDrafts() {
      try {
        await queue.clear();
        publishDrafts([], {
          error: null,
          lastSummary: null,
          lastSavedDraftId: null,
          lastSavedAt: null,
        });
      } catch (error) {
        setState({ error: describeDraftError(error) });
      }
    },

    async submitDraft(id) {
      const draft =
        state.drafts.find((candidate) => candidate.id === id) ?? (await queue.get(id));

      if (!draft) {
        const message = "Offline draft no longer exists.";
        setState({ error: message });
        return { id, status: "failed", error: message };
      }

      const handler = resolveSubmitHandler(handlers, draft.kind);
      if (!handler) {
        const message = `No submit handler registered for "${draft.kind}" drafts. Register one with offlineDraftStore.registerSubmitHandler().`;
        setState({ error: message });
        return { id, status: "no-handler", error: message };
      }

      setState({ submitting: true, error: null });
      const result = await queue.syncDraft(id, handler);
      const drafts = await queue.listAll();

      publishDrafts(drafts, {
        submitting: false,
        lastSyncedAt: result.status === "submitted" ? queue.timestamp() : state.lastSyncedAt,
        error: result.status === "failed" ? result.error ?? "Submission failed." : null,
        promptOpen:
          drafts.some((candidate) => candidate.status === "pending") && state.promptOpen,
      });

      return result;
    },

    async submitAllDrafts() {
      // Read the retryable drafts from storage rather than from the render
      // projection so a stale snapshot can never re-submit a deleted draft.
      const pending = await queue.listPending();

      if (pending.length === 0) {
        setState({ promptOpen: false, error: null });
        return buildOfflineDraftSyncSummary([]);
      }

      const runnable: string[] = [];
      const results: OfflineDraftSyncResult[] = [];

      for (const draft of pending) {
        if (resolveSubmitHandler(handlers, draft.kind)) {
          runnable.push(draft.id);
        } else {
          results.push({
            id: draft.id,
            status: "no-handler",
            error: `No submit handler registered for "${draft.kind}" drafts.`,
          });
        }
      }

      setState({ submitting: true, error: null });

      const summary =
        runnable.length > 0
          ? await queue.syncDrafts(runnable, (draft) => {
              const handler = resolveSubmitHandler(handlers, draft.kind);
              if (!handler) {
                throw new Error(
                  `No submit handler registered for "${draft.kind}" drafts.`,
                );
              }
              return handler(draft);
            })
          : buildOfflineDraftSyncSummary([]);

      const merged = buildOfflineDraftSyncSummary([
        ...summary.results,
        ...results,
      ]);
      const drafts = await queue.listAll();
      const stillPending = drafts.some((draft) => draft.status === "pending");

      publishDrafts(drafts, {
        submitting: false,
        lastSummary: merged,
        lastSyncedAt: merged.submittedCount > 0 ? queue.timestamp() : state.lastSyncedAt,
        error:
          merged.failedCount > 0
            ? merged.failed[0]?.error ?? "Submission failed."
            : merged.submittedCount === 0 && merged.skippedCount > 0
              ? merged.skipped[0]?.error ?? null
              : null,
        promptOpen: stillPending ? state.promptOpen : false,
      });

      return merged;
    },

    registerSubmitHandler(kind, handler) {
      const previous = handlers.get(kind);
      handlers.set(kind, handler);
      return () => {
        if (previous) handlers.set(kind, previous);
        else handlers.delete(kind);
      };
    },

    openDrawer() {
      setState({ drawerOpen: true });
    },

    closeDrawer() {
      setState({ drawerOpen: false });
    },

    openPrompt() {
      setState({ promptOpen: true, promptDismissed: false });
    },

    closePrompt() {
      setState({ promptOpen: false });
    },

    dismissPrompt() {
      setState({ promptOpen: false, promptDismissed: true });
    },

    resetPromptDismissal() {
      setState({ promptDismissed: false, promptOpen: false });
    },

    acknowledgeSavedBanner() {
      setState({ lastSavedDraftId: null, lastSavedAt: null });
    },

    setError(message) {
      setState({ error: message });
    },
  };
}

/** App-wide singleton wired to the IndexedDB queue. */
export const offlineDraftStore: OfflineDraftStore = createOfflineDraftStore();
