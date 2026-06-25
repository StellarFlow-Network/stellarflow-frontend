"use client";

const DB_NAME = "stellarflow-history";
const STORE_NAME = "history";
const LOCAL_STORAGE_PREFIX = "stellarflow-history:";
const DB_VERSION = 1;

interface HistoryRecord<T> {
  key: string;
  data: T;
  updatedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getStorageKey(key: string): string {
  return `${LOCAL_STORAGE_PREFIX}${key}`;
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function readFromLocalStorage<T>(key: string): T | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as HistoryRecord<T> | T;
    if (parsed && typeof parsed === "object" && "data" in parsed && "key" in parsed) {
      return (parsed as HistoryRecord<T>).data;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

function writeToLocalStorage<T>(key: string, data: T): void {
  if (!isBrowser()) return;

  try {
    const payload = JSON.stringify({
      key,
      data,
      updatedAt: Date.now(),
    } satisfies HistoryRecord<T>);
    window.localStorage.setItem(getStorageKey(key), payload);
  } catch {
    // Ignore storage quota or serialization issues.
  }
}

function readFromDatabase<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as HistoryRecord<T> | undefined;
      resolve(result?.data ?? null);
    };

    request.onerror = () => resolve(null);
  });
}

function writeToDatabase<T>(db: IDBDatabase, key: string, data: T): Promise<void> {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      key,
      data,
      updatedAt: Date.now(),
    } satisfies HistoryRecord<T>);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

export function getCachedHistorySync<T>(key: string): T | null {
  return readFromLocalStorage<T>(key);
}

export async function getCachedHistory<T>(key: string): Promise<T | null> {
  const cached = getCachedHistorySync<T>(key);
  if (cached !== null) {
    return cached;
  }

  try {
    const db = await openHistoryDatabase();
    const value = await readFromDatabase<T>(db, key);
    db.close();

    if (value !== null) {
      writeToLocalStorage(key, value);
    }

    return value;
  } catch {
    return null;
  }
}

export async function setCachedHistory<T>(key: string, data: T): Promise<void> {
  writeToLocalStorage(key, data);

  try {
    const db = await openHistoryDatabase();
    await writeToDatabase(db, key, data);
    db.close();
  } catch {
    // IndexedDB is optional; local storage remains the fast path.
  }
}

export async function clearCachedHistory(key: string): Promise<void> {
  if (isBrowser()) {
    window.localStorage.removeItem(getStorageKey(key));
  }

  try {
    const db = await openHistoryDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);
    db.close();
  } catch {
    // Ignore cleanup failures.
  }
}
