import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DecodedResult,
  DecodeXdrPayload,
  XdrDecodedMessage,
  XdrWorkerMessage,
} from './worker-types';

export function useXdrWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [decoding, setDecoding] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('./xdr-worker.ts', import.meta.url));
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const batchDecode = useCallback(async (
    _batchId: string,
    items: DecodeXdrPayload[]
  ): Promise<DecodedResult[]> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('XDR Worker not initialized'));
        return;
      }

      setDecoding(true);

      let completed = 0;
      const results: DecodedResult[] = [];

      const handleMessage = (event: MessageEvent<XdrDecodedMessage>) => {
        const { type, payload } = event.data;

        if (type === 'DECODED_XDR') {
          results.push({
            id: payload.id,
            status: payload.status,
            decoded_payload: payload.decoded_payload,
            error: payload.error,
          });
          completed++;

          if (completed === items.length) {
            workerRef.current?.removeEventListener('message', handleMessage);
            setDecoding(false);
            resolve(results);
          }
        }
      };

      workerRef.current.addEventListener('message', handleMessage);

      items.forEach(item => {
        workerRef.current?.postMessage({
          type: 'DECODE_XDR',
          payload: { id: item.id, xdr: item.xdr },
        } as XdrWorkerMessage);
      });
    });
  }, []);

  return { batchDecode, decoding };
}
