import { LogEntry } from './types';
import { STORES, getAll, putMany, evictOldRecords, clearStore, count } from '@/lib/indexedDb';

const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const hashLogKey = (log: LogEntry): string => {
  const source = [log.id, log.timestamp, log.type, log.actor, log.txHash ?? ''].join('|');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const toStorableLog = (log: LogEntry) => ({
  ...log,
  id: hashLogKey(log),
});

export const readIndexedLogs = async (): Promise<LogEntry[] | null> => {
  try {
    const logs = await getAll<LogEntry>(STORES.logs, null, 500);
    return logs.length > 0 ? logs : null;
  } catch {
    return null;
  }
};

export const writeIndexedLogs = async (logs: LogEntry[]): Promise<void> => {
  if (logs.length === 0) return;

  try {
    const storable = logs.map(toStorableLog);
    await putMany(STORES.logs, storable);
    evictOldRecords(STORES.logs, MAX_LOG_AGE_MS);
  } catch {
    // IndexedDB may be unavailable in private browsing contexts.
  }
};

export const clearIndexedLogs = async (): Promise<void> => {
  try {
    await clearStore(STORES.logs);
  } catch {
    // Silently fail.
  }
};

export const getLogCount = async (): Promise<number> => {
  try {
    return await count(STORES.logs);
  } catch {
    return 0;
  }
};

