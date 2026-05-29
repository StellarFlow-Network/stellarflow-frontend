/// <reference lib="webworker" />

/**
 * crypto-worker.ts
 *
 * Off-thread Web Worker for cryptographic hashing via the native WebCrypto API
 * (crypto.subtle). Keeps all digest computation off the main UI thread so
 * frame rendering is never blocked during verification of oracle data strings.
 *
 * Supported algorithms: SHA-256 (default), SHA-384, SHA-512
 *
 * Inbound message types:
 *   HASH        – hash a single string
 *   BATCH_HASH  – hash an array of strings in one shot
 *
 * Outbound message types:
 *   HASH_RESULT       – success result for HASH
 *   BATCH_HASH_RESULT – success result for BATCH_HASH
 *   HASH_ERROR        – failure with reason string
 */

export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

interface HashPayload {
  id: string;
  input: string;
  algorithm?: HashAlgorithm;
}

interface BatchHashPayload {
  batchId: string;
  items: HashPayload[];
}

type InboundMessage =
  | { type: 'HASH'; payload: HashPayload }
  | { type: 'BATCH_HASH'; payload: BatchHashPayload };

interface HashResult {
  id: string;
  hex: string;
  algorithm: HashAlgorithm;
}

// ─── Core hash logic ──────────────────────────────────────────────────────────

async function hashString(
  id: string,
  input: string,
  algorithm: HashAlgorithm = 'SHA-256',
): Promise<HashResult> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest(algorithm, encoded);
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { id, hex, algorithm };
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<InboundMessage>) => {
  const { type, payload } = event.data;

  if (type === 'HASH') {
    const { id, input, algorithm } = payload as HashPayload;
    try {
      const result = await hashString(id, input, algorithm);
      self.postMessage({ type: 'HASH_RESULT', payload: result });
    } catch (err) {
      self.postMessage({
        type: 'HASH_ERROR',
        payload: { id, error: err instanceof Error ? err.message : String(err) },
      });
    }
    return;
  }

  if (type === 'BATCH_HASH') {
    const { batchId, items } = payload as BatchHashPayload;
    const results = await Promise.all(
      items.map(({ id, input, algorithm }) =>
        hashString(id, input, algorithm).catch((err) => ({
          id,
          hex: '',
          algorithm: algorithm ?? ('SHA-256' as HashAlgorithm),
          error: err instanceof Error ? err.message : String(err),
        })),
      ),
    );
    self.postMessage({ type: 'BATCH_HASH_RESULT', payload: { batchId, results } });
    return;
  }

  console.warn('[crypto-worker] Unknown message type:', (event.data as { type: string }).type);
};
