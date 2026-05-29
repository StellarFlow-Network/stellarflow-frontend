'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type StakingLogEntry,
  type PageResult,
  getAllLogs,
  putLog,
  putLogs,
  getLogsByNode,
  getSlashLogs,
  deleteLog,
  clearLogs,
  putStakerCache,
  getAllStakerCache,
  getStakerCache,
  getLogsPaginated,
  getDbStats,
} from '@/lib/stakingLogsDb';

export interface StakerCacheEntry {
  nodeId: string;
  lastSynced: number;
  totalSlashingEvents: number;
  healthFactor: number;
}

export interface DbStats {
  totalLogs: number;
  slashCount: number;
  stakeCount: number;
  rewardCount: number;
  unstakeCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

interface UseStakingLogsStore {
  logs: StakingLogEntry[];
  stakerCache: StakerCacheEntry[];
  isLoading: boolean;
  error: string | null;
  dbStats: DbStats | null;
  // Pagination
  page: PageResult<StakingLogEntry> | null;
  currentPage: number;
  pageSize: number;
  eventTypeFilter: StakingLogEntry['eventType'] | undefined;
  setCurrentPage: (p: number) => void;
  setPageSize: (s: number) => void;
  setEventTypeFilter: (f: StakingLogEntry['eventType'] | undefined) => void;
  // Mutations
  addLog: (entry: StakingLogEntry) => Promise<void>;
  addLogs: (entries: StakingLogEntry[]) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  clearAllLogs: () => Promise<void>;
  getNodeLogs: (nodeId: string) => Promise<StakingLogEntry[]>;
  getSlashingLogs: () => Promise<StakingLogEntry[]>;
  updateStakerCache: (entry: StakerCacheEntry) => Promise<void>;
  getNodeCache: (nodeId: string) => Promise<StakerCacheEntry | undefined>;
  refresh: () => Promise<void>;
}

export function useStakingLogsStore(): UseStakingLogsStore {
  const [logs, setLogs] = useState<StakingLogEntry[]>([]);
  const [stakerCache, setStakerCache] = useState<StakerCacheEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [page, setPage] = useState<PageResult<StakingLogEntry> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [eventTypeFilter, setEventTypeFilter] = useState<StakingLogEntry['eventType'] | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allLogs, allCache, stats, pageResult] = await Promise.all([
        getAllLogs(),
        getAllStakerCache(),
        getDbStats(),
        getLogsPaginated(currentPage, pageSize, eventTypeFilter),
      ]);
      setLogs(allLogs);
      setStakerCache(allCache);
      setDbStats(stats);
      setPage(pageResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staking logs');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, eventTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshPage = useCallback(async () => {
    try {
      const [pageResult, stats] = await Promise.all([
        getLogsPaginated(currentPage, pageSize, eventTypeFilter),
        getDbStats(),
      ]);
      setPage(pageResult);
      setDbStats(stats);
    } catch { /* silent */ }
  }, [currentPage, pageSize, eventTypeFilter]);

  const addLog = useCallback(async (entry: StakingLogEntry) => {
    await putLog(entry);
    setLogs(prev => {
      const idx = prev.findIndex(l => l.id === entry.id);
      return idx >= 0 ? prev.map((l, i) => (i === idx ? entry : l)) : [...prev, entry];
    });
    await refreshPage();
  }, [refreshPage]);

  const addLogs = useCallback(async (entries: StakingLogEntry[]) => {
    await putLogs(entries);
    setLogs(prev => {
      const map = new Map(prev.map(l => [l.id, l]));
      entries.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    });
    await refreshPage();
  }, [refreshPage]);

  const removeLog = useCallback(async (id: string) => {
    await deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
    await refreshPage();
  }, [refreshPage]);

  const clearAllLogs = useCallback(async () => {
    await clearLogs();
    setLogs([]);
    setPage(null);
    setDbStats(null);
  }, []);

  const getNodeLogs = useCallback((nodeId: string) => getLogsByNode(nodeId), []);
  const getSlashingLogs = useCallback(() => getSlashLogs(), []);

  const updateStakerCache = useCallback(async (entry: StakerCacheEntry) => {
    await putStakerCache(entry);
    setStakerCache(prev => {
      const idx = prev.findIndex(c => c.nodeId === entry.nodeId);
      return idx >= 0 ? prev.map((c, i) => (i === idx ? entry : c)) : [...prev, entry];
    });
  }, []);

  const getNodeCache = useCallback((nodeId: string) => getStakerCache(nodeId), []);

  return {
    logs,
    stakerCache,
    isLoading,
    error,
    dbStats,
    page,
    currentPage,
    pageSize,
    eventTypeFilter,
    setCurrentPage,
    setPageSize,
    setEventTypeFilter,
    addLog,
    addLogs,
    removeLog,
    clearAllLogs,
    getNodeLogs,
    getSlashingLogs,
    updateStakerCache,
    getNodeCache,
    refresh: load,
  };
}
