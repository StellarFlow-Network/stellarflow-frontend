import "fake-indexeddb/auto";

import {
  CACHE_DB_NAME,
  CACHE_STORES,
  IndexedDBCacheManager,
} from "@/utils/storage/IndexedDBCacheManager";

describe("IndexedDBCacheManager", () => {
  let manager: IndexedDBCacheManager;

  beforeEach(async () => {
    manager = new IndexedDBCacheManager({
      [CACHE_STORES.priceHistory]: 60_000,
    });

    await manager.purgeAll();
  });

  afterEach(async () => {
    await manager.close();
    indexedDB.deleteDatabase(CACHE_DB_NAME);
  });

  it("stores and reads a non-expired record", async () => {
    await manager.set(CACHE_STORES.priceHistory, "XLM-USDC", {
      points: [1, 2, 3],
    });

    await expect(
      manager.get(CACHE_STORES.priceHistory, "XLM-USDC"),
    ).resolves.toEqual({
      points: [1, 2, 3],
    });
  });

  it("returns stale data while starting one background revalidation", async () => {
    await manager.set(CACHE_STORES.poolData, "pool-1", {
      reserveA: "100",
    }, { ttlMs: 1 });

    await new Promise((resolve) => setTimeout(resolve, 5));

    let calls = 0;
    const revalidate = async () => {
      calls += 1;
      return { reserveA: "200" };
    };

    const first = await manager.getStaleWhileRevalidate(
      CACHE_STORES.poolData,
      "pool-1",
      revalidate,
    );

    const second = await manager.getStaleWhileRevalidate(
      CACHE_STORES.poolData,
      "pool-1",
      revalidate,
    );

    expect(first.value).toEqual({ reserveA: "100" });
    expect(second.revalidationStarted).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toBe(1);
    await expect(
      manager.get(CACHE_STORES.poolData, "pool-1"),
    ).resolves.toEqual({ reserveA: "200" });
  });

  it("purges expired records", async () => {
    await manager.set(CACHE_STORES.tokenLists, "mainnet", ["XLM"], {
      ttlMs: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(manager.purgeExpired()).resolves.toBeGreaterThanOrEqual(1);
    await expect(
      manager.getRecord(CACHE_STORES.tokenLists, "mainnet"),
    ).resolves.toBeUndefined();
  });
});
