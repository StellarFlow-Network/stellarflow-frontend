const DB_NAME = 'stellarflow-cache';
const DB_VERSION = 1;

export const STORES = {
  priceHistory: 'priceHistory',
  logs: 'logs',
  validatorMetrics: 'validatorMetrics',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

interface StoreSchema {
  name: StoreName;
  keyPath: string;
  indexes?: { name: string; keyPath: string; options?: IDBIndexParameters }[];
}

const STORE_SCHEMAS: StoreSchema[] = [
  {
    name: STORES.priceHistory,
    keyPath: 'id',
    indexes: [
      { name: 'assetPair', keyPath: 'assetPair' },
      { name: 'timestamp', keyPath: 'timestamp' },
    ],
  },
  {
    name: STORES.logs,
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'type', keyPath: 'type' },
    ],
  },
  {
    name: STORES.validatorMetrics,
    keyPath: 'id',
    indexes: [
      { name: 'address', keyPath: 'address' },
      { name: 'timestamp', keyPath: 'timestamp' },
    ],
  },
];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      for (const schema of STORE_SCHEMAS) {
        if (!db.objectStoreNames.contains(schema.name)) {
          const store = db.createObjectStore(schema.name, {
            keyPath: schema.keyPath,
          });
          if (schema.indexes) {
            for (const index of schema.indexes) {
              store.createIndex(index.name, index.keyPath, index.options);
            }
          }
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<unknown> | IDBRequest<unknown>[],
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const results = fn(store);

    const requests = Array.isArray(results) ? results : [results];

    if (requests.length === 1) {
      requests[0].onsuccess = () => resolve(requests[0].result as T);
      requests[0].onerror = () => reject(requests[0].error);
    } else {
      let completed = 0;
      const allResults: unknown[] = [];
      for (let i = 0; i < requests.length; i++) {
        const idx = i;
        requests[idx].onsuccess = () => {
          allResults[idx] = requests[idx].result;
          completed++;
          if (completed === requests.length) resolve(allResults as T);
        };
        requests[idx].onerror = () => reject(requests[idx].error);
      }
    }

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAll<T>(
  storeName: StoreName,
  query?: IDBValidKey | IDBKeyRange | null,
  count?: number,
): Promise<T[]> {
  return withStore<T[]>(storeName, 'readonly', (store) => {
    const request = store.getAll(query, count);
    return request as IDBRequest<T[]>;
  });
}

export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: IDBValidKey | IDBKeyRange,
  limit?: number,
): Promise<T[]> {
  return withStore<T[]>(storeName, 'readonly', (store) => {
    const index = store.index(indexName);
    const range = IDBKeyRange.bound(value, value);
    const request = index.getAll(range, limit);
    return request as IDBRequest<T[]>;
  });
}

export async function getByTimeRange<T>(
  storeName: StoreName,
  startTime: number,
  endTime: number,
  limit?: number,
): Promise<T[]> {
  return withStore<T[]>(storeName, 'readonly', (store) => {
    const index = store.index('timestamp');
    const range = IDBKeyRange.bound(startTime, endTime);
    const request = index.getAll(range, limit);
    return request as IDBRequest<T[]>;
  });
}

export async function getLatest<T extends { timestamp: number }>(
  storeName: StoreName,
  count: number = 1,
): Promise<T[]> {
  try {
    const all = await getAll<T>(storeName);
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  } catch {
    return [];
  }
}

export async function put<T>(
  storeName: StoreName,
  value: T,
): Promise<IDBValidKey> {
  return withStore<IDBValidKey>(storeName, 'readwrite', (store) => {
    return store.put(value);
  });
}

export async function putMany<T>(
  storeName: StoreName,
  values: T[],
): Promise<IDBValidKey[]> {
  return withStore<IDBValidKey[]>(storeName, 'readwrite', (store) => {
    const requests: IDBRequest<IDBValidKey>[] = [];
    for (const value of values) {
      requests.push(store.put(value));
    }
    return requests as IDBRequest<IDBValidKey>[];
  });
}

export async function deleteRecord(
  storeName: StoreName,
  key: IDBValidKey | IDBKeyRange,
): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    const request = store.delete(key);
    return request as IDBRequest<void>;
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    const request = store.clear();
    return request as IDBRequest<void>;
  });
}

export async function count(
  storeName: StoreName,
  query?: IDBValidKey | IDBKeyRange,
): Promise<number> {
  return withStore<number>(storeName, 'readonly', (store) => {
    return store.count(query);
  });
}

export async function evictOldRecords(
  storeName: StoreName,
  maxAgeMs: number,
): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const oldRecords = await getByTimeRange(storeName, 0, cutoff);
  if (oldRecords.length === 0) return 0;

  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    let deleted = 0;

    for (const record of oldRecords) {
      const req = store.delete((record as Record<string, unknown>).id as IDBValidKey);
      req.onsuccess = () => deleted++;
    }

    transaction.oncomplete = () => resolve(deleted);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getFirst<T>(
  storeName: StoreName,
  query?: IDBValidKey | IDBKeyRange,
): Promise<T | null> {
  const results = await getAll<T>(storeName, query, 1);
  return results[0] ?? null;
}
