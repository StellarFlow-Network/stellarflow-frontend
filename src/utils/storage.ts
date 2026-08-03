/**
 * Encrypted Local Storage State Persistence Middleware
 * 
 * Safely serializes UI preferences, custom RPC endpoints, and recent transaction history.
 * Incorporates schema validation, disabled/full storage fallback, and data migrations.
 */

export const APP_STORAGE_VERSION = 1;
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_SECRET || "default_stellar_flow_secret_key";
type StorageEnvelope<T> = {
  version: number;
  data: T;
};

type MigrationHandler = (data: unknown) => unknown | null;

const migrations: Record<number, MigrationHandler> = {
  0: (data) => {
    if (typeof data !== "object" || data === null) {
      return null;
    }

    return data;
  },
};

// Simple XOR & Base64 Obfuscation/Encryption
export function encrypt(data: string): string {
  try {
    let result = "";
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(result);
  } catch (e) {
    console.warn("Storage encryption failed, saving raw data:", e);
    return data;
  }
}

export function decrypt(data: string): string {
  try {
    const raw = atob(data);
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.warn("Storage decryption failed, attempting raw read:", e);
    return data;
  }
}

// Memory Fallback Store
const memoryStore: Record<string, string> = {};

export function __resetStorageForTests() {
  for (const key in memoryStore) {
    delete memoryStore[key];
  }
}

function isLocalStorageSupported(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageSupported = isLocalStorageSupported();

/**
 * Persist item to storage (or memory fallback if full/disabled)
 */
export function setItem<T>(key: string, value: T): boolean {
  try {
    const envelope: StorageEnvelope<T> = {
      version: APP_STORAGE_VERSION,
      data: value,
    };
    const serialized = JSON.stringify(envelope);
    const encrypted = encrypt(serialized);

    if (storageSupported) {
      try {
        window.localStorage.setItem(key, encrypted);
        return true;
      } catch (error: unknown) {
        // Handle QuotaExceededError or write blocks
        console.warn(`localStorage full or blocked for key: ${key}. Falling back to memory storage.`, error);
        memoryStore[key] = encrypted;
        return false;
      }
    } else {
      memoryStore[key] = encrypted;
      return true;
    }
  } catch (e) {
    console.error(`Failed to serialize value for key: ${key}`, e);
    return false;
  }
}

/**
 * Retrieve item from storage with validation and version migration
 */
export function getItem<T>(
  key: string,
  validator?: (val: unknown) => val is T,
  fallbackValue?: T
): T | null {
  try {
    let encryptedValue: string | null = null;

    if (storageSupported) {
      encryptedValue = window.localStorage.getItem(key);
    }

    // Fallback check in memory
    if (encryptedValue === null && key in memoryStore) {
      encryptedValue = memoryStore[key];
    }

    if (encryptedValue === null) {
      return fallbackValue !== undefined ? fallbackValue : null;
    }

    const decrypted = decrypt(encryptedValue);
    const envelope = JSON.parse(decrypted) as Partial<StorageEnvelope<T>> & { data?: T };

    // Schema / Version Migration Check
    if (typeof envelope !== "object" || envelope === null || !("version" in envelope) || !("data" in envelope)) {
      // Legacy data check or unversioned format
      console.warn(`Unversioned storage entry found for key: ${key}. Evicting.`);
      removeItem(key);
      return fallbackValue !== undefined ? fallbackValue : null;
    }

    if (envelope.version < APP_STORAGE_VERSION) {
      // Run migrations (if any migrations exist, or reset outdated storage)
      console.info(`Migrating storage key ${key} from version ${envelope.version} to ${APP_STORAGE_VERSION}`);
      const migratedData = runMigrations(key, envelope.data, envelope.version);
      if (migratedData === null) {
        removeItem(key);
        return fallbackValue !== undefined ? fallbackValue : null;
      }
      setItem(key, migratedData);
      envelope.data = migratedData;
    }

    // Schema Validation Check
    if (validator && !validator(envelope.data)) {
      console.error(`Validation failed for storage key: ${key}. Evicting.`);
      removeItem(key);
      return fallbackValue !== undefined ? fallbackValue : null;
    }

    return envelope.data as T;
  } catch (e) {
    console.error(`Failed to retrieve storage key: ${key}`, e);
    return fallbackValue !== undefined ? fallbackValue : null;
  }
}

/**
 * Remove item from storage
 */
export function removeItem(key: string): boolean {
  let removed = false;
  if (key in memoryStore) {
    delete memoryStore[key];
    removed = true;
  }
  if (storageSupported) {
    try {
      window.localStorage.removeItem(key);
      removed = true;
    } catch (e) {
      console.error(`Failed to remove key: ${key} from localStorage`, e);
    }
  }
  return removed;
}

/**
 * Clear all items from storage
 */
export function clear(): void {
  // Clear memory store
  for (const key in memoryStore) {
    delete memoryStore[key];
  }
  if (storageSupported) {
    try {
      window.localStorage.clear();
    } catch (e) {
      console.error("Failed to clear localStorage", e);
    }
  }
}

/**
 * Migrates data schemas when updating application versions
 */
function runMigrations(key: string, data: unknown, fromVersion: number): unknown | null {
  try {
    let currentData = data;
    for (let version = fromVersion; version < APP_STORAGE_VERSION; version += 1) {
      const migrate = migrations[version];
      if (!migrate) {
        console.warn(`No migration found for storage key: ${key} from version ${version}. Evicting stale data.`);
        return null;
      }

      const nextValue = migrate(currentData);
      if (nextValue === null) {
        return null;
      }

      currentData = nextValue;
    }

    return currentData;
  } catch (e) {
    console.error(`Error during migration of key: ${key}`, e);
    return null;
  }
}
