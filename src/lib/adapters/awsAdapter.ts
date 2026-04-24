import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FetchResult =
  | { success: true; key: string }
  | { success: false; error: string };

// ── Client (lazy singleton) ───────────────────────────────────────────────────

let client: SecretsManagerClient | null = null;

function getClient(): SecretsManagerClient {
  if (!client) {
    client = new SecretsManagerClient({});
  }
  return client;
}

// ── fetchKey ──────────────────────────────────────────────────────────────────

/**
 * Fetches the Stellar secret key from AWS Secrets Manager.
 *
 * - Reads the ARN from `process.env.AWS_SECRET_ARN`.
 * - Handles both plain-string secrets and JSON objects with a
 *   `STELLAR_SECRET_KEY` field.
 * - Never throws to callers — all errors are returned as structured failures.
 * - Never logs the fetched key value (Requirements 7.1, 7.2).
 *
 * Requirements: 3.1, 7.1, 7.2
 */
export async function fetchKey(): Promise<FetchResult> {
  const arn = process.env.AWS_SECRET_ARN;

  if (!arn || arn.trim() === '') {
    return { success: false, error: 'AWS_SECRET_ARN environment variable is not set' };
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: arn });
    const response = await getClient().send(command);

    const raw = response.SecretString;

    if (!raw) {
      return { success: false, error: 'AWS Secrets Manager returned an empty secret value' };
    }

    // Attempt to parse as JSON; fall back to treating the value as a plain string
    let key: string;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'STELLAR_SECRET_KEY' in parsed &&
        typeof (parsed as Record<string, unknown>).STELLAR_SECRET_KEY === 'string'
      ) {
        key = (parsed as Record<string, string>).STELLAR_SECRET_KEY;
      } else {
        // JSON but no expected field — treat the whole string as the key
        key = raw;
      }
    } catch {
      // Not JSON — use the raw string directly
      key = raw;
    }

    if (!key || key.trim() === '') {
      return { success: false, error: 'Resolved secret key is empty' };
    }

    return { success: true, key };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `AWS Secrets Manager fetch failed: ${message}` };
  }
}
