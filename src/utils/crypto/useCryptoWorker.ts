'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { HashAlgorithm } from './crypto-worker';

interface HashResult {
  id: string;
  hex: string;
  algorithm: HashAlgorithm;
  error?: string;
}

interface BatchHashResult {
  batchId: string;
  results: HashResult[];
}

type PendingHash = (result: HashResult) => void;
type PendingBatch = (result: BatchHashResult) => void;

/**
 * useCryptoWorker
 *
 * React hook that spawns a single crypto Web Worker and exposes `hash` /
 * `batchHash` helpers. All digest work runs off the main thread via the
 * native WebCrypto API (crypto.subtle).
 *
 * @example
 * const { hash } = useCryptoWorker();
 * const { hex } = await hash('oracle-payload-string');
 */
export function useCryptoWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingHashRef = useRef<Map<string, PendingHash>>(new Map());
  const pendingBatchRef = useRef<Map<string, PendingBatch>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('./crypto-worker.ts', import.meta.url));

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data as {
        type: string;
        payload: HashResult & { batchId?: string; results?: HashResult[] };
      };

      if (type === 'HASH_RESULT' || type === 'HASH_ERROR') {
        const resolve = pendingHashRef.current.get(payload.id);
        if (resolve) {
          pendingHashRef.current.delete(payload.id);
          resolve(payload as HashResult);
        }
        return;
      }

      if (type === 'BATCH_HASH_RESULT' && payload.batchId) {
        const resolve = pendingBatchRef.current.get(payload.batchId);
        if (resolve) {
          pendingBatchRef.current.delete(payload.batchId);
          resolve({ batchId: payload.batchId, results: payload.results ?? [] });
        }
      }
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  /** Hash a single string. Returns the hex digest and algorithm used. */
  const hash = useCallback(
    (input: string, algorithm: HashAlgorithm = 'SHA-256'): Promise<HashResult> =>
      new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Crypto worker not initialized'));
          return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingHashRef.current.set(id, resolve);
        workerRef.current.postMessage({ type: 'HASH', payload: { id, input, algorithm } });
      }),
    [],
  );

  /** Hash multiple strings in one worker round-trip. */
  const batchHash = useCallback(
    (
      items: Array<{ id: string; input: string; algorithm?: HashAlgorithm }>,
    ): Promise<HashResult[]> =>
      new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Crypto worker not initialized'));
          return;
        }
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingBatchRef.current.set(batchId, ({ results }) => resolve(results));
        workerRef.current.postMessage({
          type: 'BATCH_HASH',
          payload: { batchId, items },
        });
      }),
    [],
  );

  return { hash, batchHash };
}
