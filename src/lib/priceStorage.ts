import { PriceData } from '@/types';
import { STORES, getAll, getByIndex, put, putMany, evictOldRecords, count, getByTimeRange } from './indexedDb';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REHYDRATION_LIMIT = 100;

export async function getCachedPrices(
  assetPair?: string,
  limit: number = REHYDRATION_LIMIT,
): Promise<PriceData[]> {
  try {
    if (assetPair) {
      const results = await getByIndex<PriceData>(
        STORES.priceHistory,
        'assetPair',
        assetPair,
        limit,
      );
      return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }

    const all = await getAll<PriceData>(STORES.priceHistory, null, limit);
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getLatestPrice(assetPair: string): Promise<PriceData | null> {
  const prices = await getCachedPrices(assetPair, 1);
  return prices[0] ?? null;
}

export async function savePriceData(data: PriceData): Promise<void> {
  await put(STORES.priceHistory, data);
}

export async function savePriceBatch(data: PriceData[]): Promise<void> {
  if (data.length === 0) return;
  await putMany(STORES.priceHistory, data);
}

export async function evictStalePrices(
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<number> {
  return evictOldRecords(STORES.priceHistory, maxAgeMs);
}

export async function getPriceCount(): Promise<number> {
  return count(STORES.priceHistory);
}

export async function getRecentPrices(
  sinceMs: number,
): Promise<PriceData[]> {
  return getByTimeRange<PriceData>(STORES.priceHistory, sinceMs, Date.now());
}
