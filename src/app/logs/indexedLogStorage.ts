import { LogEntry } from './types';

const LOG_CACHE_KEY = 'stellarflow:logs:indexed-cache:v1';
const SCHEMA_VERSION = 1;

interface IndexedLogBucket {
  schemaVersion: typeof SCHEMA_VERSION;
  updatedAt: string;
  order: string[];
  recordsByHash: Record<string, LogEntry>;
}

const hashLogKey = (log: LogEntry) => {
  const source = [log.id, log.timestamp, log.type, log.actor, log.txHash ?? ''].join('|');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const isIndexedLogBucket = (value: unknown): value is IndexedLogBucket => {
  if (!value || typeof value !== 'object') return false;

  const bucket = value as Partial<IndexedLogBucket>;
  return (
    bucket.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(bucket.order) &&
    !!bucket.recordsByHash &&
    typeof bucket.recordsByHash === 'object'
  );
};

const readIndexedLogBucket = (): IndexedLogBucket | null => {
  if (typeof window === 'undefined') return null;

  try {
    const rawBucket = window.localStorage.getItem(LOG_CACHE_KEY);
    if (!rawBucket) return null;

    const bucket = JSON.parse(rawBucket);
    return isIndexedLogBucket(bucket) ? bucket : null;
  } catch {
    return null;
  }
};

export const readIndexedLogs = (): LogEntry[] | null => {
  const bucket = readIndexedLogBucket();
  if (!bucket) return null;

  const logs = bucket.order
    .map((hash) => bucket.recordsByHash[hash])
    .filter((log): log is LogEntry => Boolean(log));

  return logs.length > 0 ? logs : null;
};

export const writeIndexedLogs = (logs: LogEntry[]) => {
  if (typeof window === 'undefined') return;

  const bucket = logs.reduce<IndexedLogBucket>(
    (nextBucket, log) => {
      const hash = hashLogKey(log);
      nextBucket.order.push(hash);
      nextBucket.recordsByHash[hash] = log;
      return nextBucket;
    },
    {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      order: [],
      recordsByHash: {},
    },
  );

  try {
    window.localStorage.setItem(LOG_CACHE_KEY, JSON.stringify(bucket));
  } catch {
    // Local storage can be unavailable in private contexts or full quota states.
  }
};

