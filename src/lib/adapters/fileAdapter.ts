import { readFile } from 'fs/promises';
import { createDecipheriv } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FetchResult =
  | { success: true; key: string }
  | { success: false; error: string };

// ── fetchKey ──────────────────────────────────────────────────────────────────

/**
 * Reads and decrypts the Stellar secret key from a local encrypted file.
 *
 * Expected environment variables:
 *   - `SECRET_FILE_PATH`    — path to the encrypted file
 *   - `FILE_ENCRYPTION_KEY` — hex-encoded 32-byte AES-256-GCM key
 *
 * File format (UTF-8 text):
 *   <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * Never throws to callers — all errors are returned as structured failures.
 * Never logs the decrypted key value (Requirement 7.1).
 *
 * Requirements: 3.2, 7.1
 */
export async function fetchKey(): Promise<FetchResult> {
  const filePath = process.env.SECRET_FILE_PATH;
  const encKeyHex = process.env.FILE_ENCRYPTION_KEY;

  if (!filePath || filePath.trim() === '') {
    return { success: false, error: 'SECRET_FILE_PATH environment variable is not set' };
  }

  if (!encKeyHex || encKeyHex.trim() === '') {
    return { success: false, error: 'FILE_ENCRYPTION_KEY environment variable is not set' };
  }

  // Read the encrypted file
  let fileContents: string;
  try {
    fileContents = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
    return {
      success: false,
      error: isNotFound
        ? `Secret file not found at path: ${filePath}`
        : `Failed to read secret file: ${message}`,
    };
  }

  // Parse the file format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
  const parts = fileContents.trim().split(':');
  if (parts.length !== 3) {
    return {
      success: false,
      error: 'Secret file has invalid format; expected <iv_hex>:<authTag_hex>:<ciphertext_hex>',
    };
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  // Decrypt using AES-256-GCM
  try {
    const encKey = Buffer.from(encKeyHex, 'hex');
    if (encKey.length !== 32) {
      return {
        success: false,
        error: `FILE_ENCRYPTION_KEY must be a hex-encoded 32-byte key (got ${encKey.length} bytes)`,
      };
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const key = decrypted.toString('utf-8').trim();

    if (!key) {
      return { success: false, error: 'Decrypted secret key is empty' };
    }

    return { success: true, key };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Decryption failed: ${message}` };
  }
}
