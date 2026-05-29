'use client';

import { useEffect, useRef, useCallback } from 'react';

const DB_NAME = 'stellarflow-governance';
const STORE_NAME = 'proposals';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lightweight IndexedDB sync layer for historical proposal collections.
 * Pulls archived data from local cache on subsequent page reloads,
 * avoiding redundant network fetches and reducing memory pressure.
 */
export function useProposalCache<T extends { id: string }>() {
  const dbRef = useRef<IDBDatabase | null>(null);

  useEffect(() => {
    openDB().then((db) => { dbRef.current = db; }).catch(console.error);
    return () => { dbRef.current?.close(); };
  }, []);

  const saveProposals = useCallback(async (proposals: T[]): Promise<void> => {
    const db = dbRef.current ?? await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      proposals.forEach((p) => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  const loadProposals = useCallback(async (): Promise<T[]> => {
    const db = dbRef.current ?? await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }, []);

  const clearProposals = useCallback(async (): Promise<void> => {
    const db = dbRef.current ?? await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  return { saveProposals, loadProposals, clearProposals };
}
