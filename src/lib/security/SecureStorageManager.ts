/**
 * SecureStorageManager.ts — AES-GCM encrypted local storage wrapper
 *
 * Provides secure browser storage for sensitive user preferences (custom RPC endpoints,
 * watchlists, and other local settings) using the Web Crypto API's AES-GCM encryption.
 *
 * Features:
 *   • AES-GCM-256 encryption with unique IV per write (authenticated encryption)
 *   • PBKDF2 key derivation from environment secret with 100,000 iterations
 *   • Graceful fallback on decryption failures (clears corrupted data)
 *   • Memory fallback when localStorage is disabled or full
 *   • Version-aware data envelopes for future migrations
 *
 * Security notes:
 *   • Each encryption operation uses a fresh random IV (never reused)
 *   • IV is stored alongside ciphertext (no additional storage overhead)
 *   • Uses Web Crypto API (native browser crypto, no external dependencies)
 *   • Falls back to raw storage only if crypto API is unavailable (SSR/legacy)
 */

export const SECURE_STORAGE_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StorageEnvelope<T> = {
  version: number;
  iv: string; // Base64-encoded initialization vector
  ciphertext: string; // Base64-encoded AES-GCM ciphertext
};

type MigrationHandler = (data: unknown) => unknown | null;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const ENCRYPTION_KEY_SOURCE = process.env.NEXT_PUBLIC_STORAGE_SECRET || 'default_stellar_flow_secret_key';
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)

// ─────────────────────────────────────────────────────────────────────────────
// Crypto Key Management
// ─────────────────────────────────────────────────────────────────────────────

let cachedCryptoKey: CryptoKey | null = null;

/**
 * Derives a stable AES-GCM key from the configured secret using PBKDF2.
 * The key is cached for the session to avoid repeated derivation overhead.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }

  // Use a fixed salt for deterministic key derivation (same secret = same key)
  // In production, consider rotating this with app version updates
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(ENCRYPTION_KEY_SOURCE);
  const salt = encoder.encode('stellarflow-secure-storage-salt-v1');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  cachedCryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedCryptoKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encryption/Decryption
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encrypts data using AES-GCM-256 with a fresh random IV.
 * Returns a base64-encoded envelope containing IV and ciphertext.
 */
export async function encryptData(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Generate fresh random IV for each encryption (never reuse IVs in GCM)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      dataBytes
    );

    // Pack envelope: version + IV (base64) + ciphertext (base64)
    const envelope: StorageEnvelope<string> = {
      version: SECURE_STORAGE_VERSION,
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(new Uint8Array(ciphertext)),
    };

    return JSON.stringify(envelope);
  } catch (error) {
    console.warn('SecureStorage encryption failed, falling back to raw data:', error);
    // Fallback: return raw data if crypto fails (SSR, legacy browsers)
    return JSON.stringify({ version: 0, data });
  }
}

/**
 * Decrypts data from a secure storage envelope.
 * Returns the original plaintext string, or null if decryption fails.
 */
export async function decryptData(encryptedData: string): Promise<string | null> {
  try {
    const envelope = JSON.parse(encryptedData) as StorageEnvelope<string> | { version: number; data?: string };

    // Handle legacy unencrypted data (version 0)
    if (envelope.version === 0 && 'data' in envelope) {
      return envelope.data || '';
    }

    // Validate envelope structure
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('version' in envelope) ||
      !('iv' in envelope) ||
      !('ciphertext' in envelope)
    ) {
      console.warn('Invalid secure storage envelope structure');
      return null;
    }

    const secureEnvelope = envelope as StorageEnvelope<string>;
    const key = await getEncryptionKey();

    const iv = base64ToBuffer(secureEnvelope.iv);
    const ciphertext = base64ToBuffer(secureEnvelope.ciphertext);

    const decryptedBytes = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBytes);
  } catch (error) {
    console.warn('SecureStorage decryption failed, data may be corrupted:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buffer Helpers
// ─────────────────────────────────────────────────────────────────────────────

function bufferToBase64(buffer: Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Operations
// ─────────────────────────────────────────────────────────────────────────────

// Memory fallback store for when localStorage is disabled or full
const memoryStore: Record<string, string> = {};

function isLocalStorageSupported(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__secure_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageSupported = isLocalStorageSupported();

/**
 * Stores a value securely with AES-GCM encryption.
 * Falls back to memory storage if localStorage is full or disabled.
 */
export async function setSecureItem<T>(key: string, value: T): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);
    const encrypted = await encryptData(serialized);

    if (storageSupported) {
      try {
        window.localStorage.setItem(key, encrypted);
        return true;
      } catch (error) {
        // Handle QuotaExceededError or write blocks
        console.warn(`localStorage full or blocked for key: ${key}. Falling back to memory storage.`, error);
        memoryStore[key] = encrypted;
        return false;
      }
    } else {
      memoryStore[key] = encrypted;
      return true;
    }
  } catch (error) {
    console.error(`Failed to encrypt/store value for key: ${key}`, error);
    return false;
  }
}

/**
 * Retrieves and decrypts a value from secure storage.
 * Returns null if the key doesn't exist or decryption fails.
 * On decryption failure, the corrupted key is automatically removed.
 */
export async function getSecureItem<T>(
  key: string,
  validator?: (val: unknown) => val is T,
  fallbackValue?: T
): Promise<T | null> {
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

    const decryptedString = await decryptData(encryptedValue);

    if (decryptedString === null) {
      // Decryption failed - data is corrupted, remove it
      console.warn(`Corrupted secure storage data for key: ${key}. Removing.`);
      await removeSecureItem(key);
      return fallbackValue !== undefined ? fallbackValue : null;
    }

    const data = JSON.parse(decryptedString) as T;

    // Schema validation if provided
    if (validator && !validator(data)) {
      console.warn(`Validation failed for secure storage key: ${key}. Removing.`);
      await removeSecureItem(key);
      return fallbackValue !== undefined ? fallbackValue : null;
    }

    return data;
  } catch (error) {
    console.error(`Failed to retrieve secure storage key: ${key}`, error);
    return fallbackValue !== undefined ? fallbackValue : null;
  }
}

/**
 * Removes a key from secure storage (both localStorage and memory fallback).
 */
export async function removeSecureItem(key: string): Promise<boolean> {
  let removed = false;
  if (key in memoryStore) {
    delete memoryStore[key];
    removed = true;
  }
  if (storageSupported) {
    try {
      window.localStorage.removeItem(key);
      removed = true;
    } catch (error) {
      console.error(`Failed to remove key: ${key} from localStorage`, error);
    }
  }
  return removed;
}

/**
 * Clears all secure storage (both localStorage and memory fallback).
 */
export async function clearSecureStorage(): Promise<void> {
  // Clear memory store
  for (const key in memoryStore) {
    delete memoryStore[key];
  }
  if (storageSupported) {
    try {
      window.localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage', error);
    }
  }
}

/**
 * Resets the cached crypto key (useful for testing or key rotation).
 */
export function resetCryptoKeyCache(): void {
  cachedCryptoKey = null;
}

/**
 * Clears the memory fallback store (useful for testing).
 */
export function __resetMemoryStoreForTests(): void {
  for (const key in memoryStore) {
    delete memoryStore[key];
  }
}
