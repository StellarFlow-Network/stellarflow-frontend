import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const STORAGE_KEY = "stellarflow:query-cache:v1";
const SCHEMA_VERSION = 1;

interface CacheBucket {
  schemaVersion: number;
  updatedAt: string;
  client: PersistedClient;
}

function isCacheBucket(value: unknown): value is CacheBucket {
  if (!value || typeof value !== "object") return false;
  const bucket = value as Partial<CacheBucket>;
  return bucket.schemaVersion === SCHEMA_VERSION && !!bucket.client;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const key = "__sf_storage_test__";
    window.localStorage.setItem(key, key);
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return null;
  }
}

export const localStoragePersister: Persister = {
  persistClient(persistedClient: PersistedClient) {
    const storage = getStorage();
    if (!storage) return;

    const bucket: CacheBucket = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      client: persistedClient,
    };

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(bucket));
    } catch {
      // quota exceeded or storage unavailable — silently skip
    }
  },

  restoreClient(): PersistedClient | undefined {
    const storage = getStorage();
    if (!storage) return undefined;

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return undefined;

      const parsed: unknown = JSON.parse(raw);
      if (!isCacheBucket(parsed)) return undefined;

      return parsed.client;
    } catch {
      return undefined;
    }
  },

  removeClient() {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  },
};
