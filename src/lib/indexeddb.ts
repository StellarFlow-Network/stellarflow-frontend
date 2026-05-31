import type { HistoricalDataPoint } from '@/types'

const DB_NAME = 'stellarflow-history'
const DB_VERSION = 1
const STORE_NAME = 'priceHistory'
const MAX_RETENTION_DAYS = 7

function getKey(point: HistoricalDataPoint): string {
  return `${point.assetPair}_${point.timestamp}`
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('assetPair', 'assetPair', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('assetTimestamp', ['assetPair', 'timestamp'], { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

export async function storeDataPoint(point: HistoricalDataPoint): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const id = getKey(point)
    const entry = { ...point, id }

    const request = store.put(entry)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function storeDataPoints(points: HistoricalDataPoint[]): Promise<void> {
  if (points.length === 0) return

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    for (const point of points) {
      const id = getKey(point)
      store.put({ ...point, id })
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getDataPoints(
  assetPair: string,
  options?: {
    fromTimestamp?: number
    toTimestamp?: number
    limit?: number
  },
): Promise<HistoricalDataPoint[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('assetTimestamp')
    const range = IDBKeyRange.bound(
      [assetPair, options?.fromTimestamp ?? 0],
      [assetPair, options?.toTimestamp ?? Date.now()],
    )
    const limit = options?.limit ?? 500

    const results: HistoricalDataPoint[] = []
    const request = index.openCursor(range, 'prev')

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor && results.length < limit) {
        results.push(cursor.value as HistoricalDataPoint)
        cursor.continue()
      } else {
        resolve(results.sort((a, b) => a.timestamp - b.timestamp))
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getLatestDataPoints(
  assetPair: string,
  count: number = 50,
): Promise<HistoricalDataPoint[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('assetTimestamp')
    const range = IDBKeyRange.bound(
      [assetPair, 0],
      [assetPair, Date.now()],
    )
    const results: HistoricalDataPoint[] = []
    const request = index.openCursor(range, 'prev')

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor && results.length < count) {
        results.push(cursor.value as HistoricalDataPoint)
        cursor.continue()
      } else {
        resolve(results.sort((a, b) => a.timestamp - b.timestamp))
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getAllAssetPairs(): Promise<string[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('assetPair')
    const assetPairs = new Set<string>()
    const request = index.openCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        assetPairs.add((cursor.value as HistoricalDataPoint).assetPair)
        cursor.continue()
      } else {
        resolve(Array.from(assetPairs).sort())
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function pruneDataPoints(
  retentionDays: number = MAX_RETENTION_DAYS,
): Promise<number> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    const range = IDBKeyRange.upperBound(cutoff)
    let deletedCount = 0
    const request = index.openCursor(range)

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        store.delete(cursor.primaryKey)
        deletedCount++
        cursor.continue()
      }
    }

    tx.oncomplete = () => resolve(deletedCount)
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAllData(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
