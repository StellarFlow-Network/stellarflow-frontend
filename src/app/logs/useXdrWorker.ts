import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BatchDecodeResult,
  DecodeXdrPayload,
  XdrWorkerOutboundMessage,
  BatchResultMessage,
  XdrErrorMessage,
} from './worker-types';

export interface UseXdrWorkerOptions {
  onProgress?: (current: number, total: number) => void;
}

export function useXdrWorker(options?: UseXdrWorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (results: BatchDecodeResult[]) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/xdrParser.worker.ts', import.meta.url));
    workerRef.current = worker;

    // ── Message handler: unified to handle all outbound message types ──
    const handleMessage = (event: MessageEvent<XdrWorkerOutboundMessage>) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'BATCH_RESULT': {
          const batchMsg = payload as BatchResultMessage['payload'];
          const request = pendingRequestsRef.current.get(batchMsg.batchId);
          
          if (request) {
            clearTimeout(request.timeoutId);
            setDecoding(false);
            setError(null);
            request.resolve(batchMsg.results);
            pendingRequestsRef.current.delete(batchMsg.batchId);
          }
          break;
        }

        case 'DECODED_XDR': {
          // For individual decode (if ever used)
          const result = payload;
          const request = pendingRequestsRef.current.get(result.id);
          
          if (request) {
            clearTimeout(request.timeoutId);
            setDecoding(false);
            setError(null);
            request.resolve([result]);
            pendingRequestsRef.current.delete(result.id);
          }
          break;
        }

        case 'XDR_ERROR': {
          const errorMsg = payload as XdrErrorMessage['payload'];
          const request = pendingRequestsRef.current.get(errorMsg.id);
          
          if (request) {
            clearTimeout(request.timeoutId);
            setDecoding(false);
            const errorStr = `XDR decode error: ${errorMsg.error}`;
            setError(errorStr);
            request.reject(new Error(errorStr));
            pendingRequestsRef.current.delete(errorMsg.id);
          }
          break;
        }

        default:
          console.warn(`[useXdrWorker] Unknown message type:`, type);
      }
    };

    worker.addEventListener('message', handleMessage);

    return () => {
      worker.removeEventListener('message', handleMessage);
      // Clear all pending requests
      pendingRequestsRef.current.forEach(({ timeoutId }) => {
        clearTimeout(timeoutId);
      });
      pendingRequestsRef.current.clear();
      worker.terminate();
    };
  }, []);

  const batchDecode = useCallback(async (
    batchId: string,
    items: DecodeXdrPayload[],
    timeoutMs: number = 30000
  ): Promise<BatchDecodeResult[]> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        const err = new Error('XDR Worker not initialized');
        setError(err.message);
        reject(err);
        return;
      }

      if (items.length === 0) {
        resolve([]);
        return;
      }

      setDecoding(true);
      setError(null);

      // Timeout safety: reject if no response after specified time
      const timeoutId = setTimeout(() => {
        if (pendingRequestsRef.current.has(batchId)) {
          pendingRequestsRef.current.delete(batchId);
          setDecoding(false);
          const err = new Error(`XDR batch decode timeout after ${timeoutMs}ms`);
          setError(err.message);
          reject(err);
        }
      }, timeoutMs);

      // Register pending request
      pendingRequestsRef.current.set(batchId, {
        resolve,
        reject,
        timeoutId,
      });

      // Send batch decode message to worker
      try {
        workerRef.current.postMessage({
          type: 'BATCH_DECODE',
          payload: { batchId, items },
        });
      } catch (err) {
        clearTimeout(timeoutId);
        pendingRequestsRef.current.delete(batchId);
        setDecoding(false);
        const error = err instanceof Error ? err.message : String(err);
        setError(error);
        reject(new Error(`Failed to send XDR batch to worker: ${error}`));
      }
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { 
    batchDecode, 
    decoding, 
    error, 
    clearError,
  };
}
