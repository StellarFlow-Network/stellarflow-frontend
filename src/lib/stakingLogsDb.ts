import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface StakingLogEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  operatorAddress: string;
  eventType: 'stake' | 'slash' | 'reward' | 'unstake';
  amountXLM: number;
  timestamp: number; // Unix ms
  txHash?: string;
  metadata?: Record<string, unknown>;
}

interface StakingLogsSchema extends DBSchema {
  stakingLogs: {
    key: string;
    value: StakingLogEntry;
    indexes: {
      'by-nodeId': string;
      'by-timestamp': number;
      'by-eventType': string;
    };
  };
  stakerCache: {
    key: string; // nodeId
    value: {
      nodeId: string;
      lastSynced: number;
      totalSlashingEvents: number;
      healthFactor: number;
    };
  };
}

const DB_NAME = 'stellarflow-staking';
const DB_VERSION = 1;
/** Logs older than 7 days are evicted on open */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let dbPromise: Promise<IDBPDatabase<StakingLogsSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<StakingLogsSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<StakingLogsSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('stakingLogs', { keyPath: 'id' });
        store.createIndex('by-nodeId', 'nodeId');
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-eventType', 'eventType');
        db.createObjectStore('stakerCache', { keyPath: 'nodeId' });
      },
    }).then(async db => {
      // TTL eviction: delete logs older than TTL_MS
      await evictExpiredLogs(db);
      return db;
    });
  }
  return dbPromise;
}

async function evictExpiredLogs(db: IDBPDatabase<StakingLogsSchema>): Promise<void> {
  const cutoff = Date.now() - TTL_MS;
  const tx = db.transaction('stakingLogs', 'readwrite');
  const index = tx.store.index('by-timestamp');
  // IDBKeyRange.upperBound(cutoff) gets all entries with timestamp <= cutoff
  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getLogsPaginated(
  page: number,
  pageSize: number,
  eventTypeFilter?: StakingLogEntry['eventType']
): Promise<PageResult<StakingLogEntry>> {
  const db = await getDb();
  let all: StakingLogEntry[];

  if (eventTypeFilter) {
    all = await db.getAllFromIndex('stakingLogs', 'by-eventType', eventTypeFilter);
  } else {
    all = await db.getAllFromIndex('stakingLogs', 'by-timestamp');
  }

  // Sort descending by timestamp
  all.sort((a, b) => b.timestamp - a.timestamp);

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return { items, total, page: safePage, pageSize, totalPages };
}

export async function getDbStats(): Promise<{
  totalLogs: number;
  slashCount: number;
  stakeCount: number;
  rewardCount: number;
  unstakeCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}> {
  const db = await getDb();
  const all = await db.getAll('stakingLogs');
  const counts = { slash: 0, stake: 0, reward: 0, unstake: 0 };
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const log of all) {
    counts[log.eventType] = (counts[log.eventType] ?? 0) + 1;
    if (oldest === null || log.timestamp < oldest) oldest = log.timestamp;
    if (newest === null || log.timestamp > newest) newest = log.timestamp;
  }

  return {
    totalLogs: all.length,
    slashCount: counts.slash,
    stakeCount: counts.stake,
    rewardCount: counts.reward,
    unstakeCount: counts.unstake,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
  };
}

// ─── Basic CRUD ───────────────────────────────────────────────────────────────

export async function putLog(entry: StakingLogEntry): Promise<void> {
  const db = await getDb();
  await db.put('stakingLogs', entry);
}

export async function putLogs(entries: StakingLogEntry[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('stakingLogs', 'readwrite');
  await Promise.all([...entries.map(e => tx.store.put(e)), tx.done]);
}

export async function getLogsByNode(nodeId: string): Promise<StakingLogEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('stakingLogs', 'by-nodeId', nodeId);
}

export async function getLogsByTimeRange(from: number, to: number): Promise<StakingLogEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('stakingLogs', 'by-timestamp', IDBKeyRange.bound(from, to));
}

export async function getSlashLogs(): Promise<StakingLogEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('stakingLogs', 'by-eventType', 'slash');
}

export async function getAllLogs(): Promise<StakingLogEntry[]> {
  const db = await getDb();
  return db.getAll('stakingLogs');
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('stakingLogs', id);
}

export async function clearLogs(): Promise<void> {
  const db = await getDb();
  await db.clear('stakingLogs');
}

// ─── Staker cache helpers ─────────────────────────────────────────────────────

export async function putStakerCache(
  entry: StakingLogsSchema['stakerCache']['value']
): Promise<void> {
  const db = await getDb();
  await db.put('stakerCache', entry);
}

export async function getStakerCache(
  nodeId: string
): Promise<StakingLogsSchema['stakerCache']['value'] | undefined> {
  const db = await getDb();
  return db.get('stakerCache', nodeId);
}

export async function getAllStakerCache(): Promise<
  StakingLogsSchema['stakerCache']['value'][]
> {
  const db = await getDb();
  return db.getAll('stakerCache');
}
