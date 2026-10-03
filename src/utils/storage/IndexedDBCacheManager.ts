import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const CACHE_DB_NAME = "stellarflow-cache";
export const CACHE_DB_VERSION = 1;

export const CACHE_STORES = {
  priceHistory: "price_history",
  poolData: "pool_data",
  tokenLists: "token_lists",
} as const;

export type CacheStoreName =
  (typeof CACHE_STORES)[keyof typeof CACHE_STORES];

export const DEFAULT_TTL_MS: Record<CacheStoreName, number> = {
  [CACHE_STORES.priceHistory]: 60 * 60 * 1000,
  [CACHE_STORES.poolData]: 5 * 60 * 1000,
  [CACHE_STORES.tokenLists]: 24 * 60 * 60 * 1000,
};

export interface CacheRecord<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  version: number;
}

interface StellarFlowCacheSchema extends DBSchema {
  price_history: {
    key: string;
    value: CacheRecord;
    indexes: {
      "by-expires-at": number;
      "by-updated-at": number;
    };
  };
  pool_data: {
    key: string;
    value: CacheRecord;
    indexes: {
      "by-expires-at": number;
      "by-updated-at": number;
    };
  };
  token_lists: {
    key: string;
    value: CacheRecord;
    indexes: {
      "by-expires-at": number;
      "by-updated-at": number;
    };
  };
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  percentUsed: number | null;
  supported: boolean;
}

export interface StaleWhileRevalidateOptions<T> {
  ttlMs?: number;
  forceRevalidate?: boolean;
  onUpdate?: (value: T) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export interface StaleWhileRevalidateResult<T> {
  value: T | undefined;
  isFresh: boolean;
  isStale: boolean;
  revalidationStarted: boolean;
}

type CacheValue = StellarFlowCacheSchema[CacheStoreName]["value"];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function createDatabase(): Promise<IDBPDatabase<StellarFlowCacheSchema>> {
  return openDB<StellarFlowCacheSchema>(CACHE_DB_NAME, CACHE_DB_VERSION, {
    upgrade(db) {
      for (const storeName of Object.values(CACHE_STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "key" });
          store.createIndex("by-expires-at", "expiresAt");
          store.createIndex("by-updated-at", "updatedAt");
        }
      }
    },
  });
}

export class IndexedDBCacheManager {
  private readonly ttlMs: Record<CacheStoreName, number>;
  private dbPromise?: Promise<IDBPDatabase<StellarFlowCacheSchema>>;
  private readonly revalidation = new Map<string, Promise<unknown>>();

  constructor(
    ttlOverrides: Partial<Record<CacheStoreName, number>> = {},
  ) {
    this.ttlMs = {
      ...DEFAULT_TTL_MS,
      ...ttlOverrides,
    };
  }

  private getDatabase(): Promise<IDBPDatabase<StellarFlowCacheSchema>> {
    if (!isBrowser()) {
      return Promise.reject(
        new Error("IndexedDB is only available in a browser environment"),
      );
    }

    this.dbPromise ??= createDatabase();
    return this.dbPromise;
  }

  private getTtl(storeName: CacheStoreName, ttlMs?: number): number {
    const ttl = ttlMs ?? this.ttlMs[storeName];

    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error(`Invalid TTL for cache store: ${storeName}`);
    }

    return ttl;
  }

  async set<T>(
    storeName: CacheStoreName,
    key: string,
    value: T,
    options: { ttlMs?: number } = {},
  ): Promise<void> {
    const now = Date.now();
    const ttlMs = this.getTtl(storeName, options.ttlMs);

    const record: CacheRecord<T> = {
      key,
      value,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttlMs,
      version: 1,
    };

    const db = await this.getDatabase();
    await db.put(storeName, record as CacheValue);
  }

  async getRecord<T>(
    storeName: CacheStoreName,
    key: string,
  ): Promise<CacheRecord<T> | undefined> {
    const db = await this.getDatabase();
    return (await db.get(storeName, key)) as CacheRecord<T> | undefined;
  }

  async get<T>(
    storeName: CacheStoreName,
    key: string,
  ): Promise<T | undefined> {
    const record = await this.getRecord<T>(storeName, key);

    if (!record) {
      return undefined;
    }

    if (record.expiresAt <= Date.now()) {
      await this.delete(storeName, key);
      return undefined;
    }

    return record.value;
  }

  async delete(storeName: CacheStoreName, key: string): Promise<void> {
    const db = await this.getDatabase();
    await db.delete(storeName, key);
  }

  async getStaleWhileRevalidate<T>(
    storeName: CacheStoreName,
    key: string,
    revalidate: () => Promise<T>,
    options: StaleWhileRevalidateOptions<T> = {},
  ): Promise<StaleWhileRevalidateResult<T>> {
    const record = await this.getRecord<T>(storeName, key);
    const now = Date.now();
    const hasValue = record !== undefined;
    const isFresh = Boolean(record && record.expiresAt > now);
    const isStale = Boolean(record && record.expiresAt <= now);
    const shouldRevalidate =
      options.forceRevalidate === true || !record || !isFresh;

    if (isStale) {
      // Remove stale data asynchronously. The stale value can still be
      // returned to the caller for immediate rendering.
      void this.delete(storeName, key).catch(() => undefined);
    }

    if (!shouldRevalidate) {
      return {
        value: record?.value,
        isFresh,
        isStale,
        revalidationStarted: false,
      };
    }

    const revalidationKey = `${storeName}:${key}`;
    let request = this.revalidation.get(revalidationKey) as
      | Promise<T>
      | undefined;

    if (!request) {
      request = revalidate()
        .then(async (freshValue) => {
          await this.set(storeName, key, freshValue, {
            ttlMs: options.ttlMs,
          });
          await options.onUpdate?.(freshValue);
          return freshValue;
        })
        .catch((error: unknown) => {
          options.onError?.(error);
          throw error;
        })
        .finally(() => {
          this.revalidation.delete(revalidationKey);
        });

      this.revalidation.set(revalidationKey, request);
    }

    // Do not block the initial page render on revalidation.
    void request.catch(() => undefined);

    return {
      value: hasValue ? record?.value : undefined,
      isFresh,
      isStale,
      revalidationStarted: true,
    };
  }

  async purgeStore(storeName: CacheStoreName): Promise<void> {
    const db = await this.getDatabase();
    await db.clear(storeName);
  }

  async purgeAll(): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction(
      Object.values(CACHE_STORES),
      "readwrite",
    );

    await Promise.all(
      Object.values(CACHE_STORES).map((storeName) =>
        transaction.objectStore(storeName).clear(),
      ),
    );

    await transaction.done;
  }

  async purgeExpired(now = Date.now()): Promise<number> {
    const db = await this.getDatabase();
    let deleted = 0;

    for (const storeName of Object.values(CACHE_STORES)) {
      const transaction = db.transaction(storeName, "readwrite");
      const index = transaction.store.index("by-expires-at");
      let cursor = await index.openCursor(IDBKeyRange.upperBound(now));

      while (cursor) {
        await cursor.delete();
        deleted += 1;
        cursor = await cursor.continue();
      }

      await transaction.done;
    }

    return deleted;
  }

  async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage?.estimate
    ) {
      return {
        usageBytes: 0,
        quotaBytes: 0,
        availableBytes: 0,
        percentUsed: null,
        supported: false,
      };
    }

    const estimate = await navigator.storage.estimate();
    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;
    const availableBytes = Math.max(quotaBytes - usageBytes, 0);

    return {
      usageBytes,
      quotaBytes,
      availableBytes,
      percentUsed:
        quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : null,
      supported: true,
    };
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db?.close();
    this.dbPromise = undefined;
    this.revalidation.clear();
  }
}

export const indexedDBCacheManager = new IndexedDBCacheManager();
