// Re-export the canonical XDR worker hook from its co-located module.
// The actual Web Worker script lives at: src/workers/xdrParser.worker.ts
// The React hook that spawns it lives at: src/app/logs/useXdrWorker.ts
export { useXdrWorker } from '../logs/useXdrWorker';
export type { BatchDecodeResult, DecodeXdrPayload, XdrFields } from '../logs/worker-types';
