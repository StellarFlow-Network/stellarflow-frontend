/**
 * Unit tests for the offline transaction draft queue (#995).
 *
 * Run: node --experimental-strip-types --test src/lib/OfflineTransactionQueue.test.ts
 *
 * The suite exercises the real durability path with the in-memory driver, which
 * implements the exact same `OfflineQueueDriver` contract as the IndexedDB
 * driver (getAll / put / remove / clear). IndexedDB-specific behaviour
 * (upgrade, indexes) is covered by the driver implementation itself, which is a
 * thin adapter over those four operations.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DRAFT_TTL_MS,
  DEFAULT_OFFLINE_DRAFT_NETWORK,
  MAX_DRAFT_ATTEMPTS,
  OfflineDraftValidationError,
  OfflineTransactionQueue,
  buildOfflineDraftSyncSummary,
  createMemoryOfflineQueueDriver,
  createOfflineDraftStore,
  describeDraftParams,
  formatDraftAge,
  formatDraftLabel,
  isBrowserOffline,
  isDraftExpired,
  isDraftRetryable,
  normalizeDraftInput,
  sortDraftsNewestFirst,
  sortDraftsOldestFirst,
  summarizeDraftQueue,
} from "./OfflineTransactionQueue.ts";

const BASE_INPUT = {
  kind: "swap",
  params: { amount: "100", asset: "XLM", destination: "GDESTINATION" },
  sourceAccount: "GSOURCE",
};

const ORIGINAL_NAVIGATOR = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setNavigatorOnline(online) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: online },
    writable: true,
    configurable: true,
  });
}

function restoreNavigator() {
  if (ORIGINAL_NAVIGATOR) {
    Object.defineProperty(globalThis, "navigator", ORIGINAL_NAVIGATOR);
  } else {
    delete globalThis.navigator;
  }
}

function createHarness(seed = [], startAt = 1_000_000) {
  const clock = { now: startAt };
  const driver = createMemoryOfflineQueueDriver(seed);
  const queue = new OfflineTransactionQueue({ driver, now: () => clock.now });
  return { clock, driver, queue };
}

function createStoreHarness() {
  const clock = { now: 1_000_000 };
  const driver = createMemoryOfflineQueueDriver();
  const queue = new OfflineTransactionQueue({ driver, now: () => clock.now });
  const store = createOfflineDraftStore(queue);
  return { clock, driver, queue, store };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation + validation
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeDraftInput fills durable defaults for a composed draft", () => {
  const draft = normalizeDraftInput(BASE_INPUT, {
    now: 1_700_000_000_000,
    idFactory: () => "draft_test",
  });

  assert.equal(draft.id, "draft_test");
  assert.equal(draft.kind, "swap");
  assert.equal(draft.status, "pending");
  assert.equal(draft.network, DEFAULT_OFFLINE_DRAFT_NETWORK);
  assert.equal(draft.sourceAccount, "GSOURCE");
  assert.equal(draft.label, null);
  assert.equal(draft.attempts, 0);
  assert.equal(draft.lastAttemptAt, null);
  assert.equal(draft.lastError, null);
  assert.equal(draft.createdAt, 1_700_000_000_000);
  assert.equal(draft.expiresAt, 1_700_000_000_000 + DEFAULT_DRAFT_TTL_MS);
  assert.deepEqual(draft.params, BASE_INPUT.params);
});

test("normalizeDraftInput copies params so later mutation cannot corrupt storage", () => {
  const params = { amount: "100" };
  const draft = normalizeDraftInput({ kind: "swap", params });
  params.amount = "999999";
  assert.equal(draft.params.amount, "100");
});

test("normalizeDraftInput rejects unsupported kinds and incomplete params", () => {
  assert.throws(
    () => normalizeDraftInput({ kind: "mortgage", params: { amount: "1" } }),
    OfflineDraftValidationError,
  );
  assert.throws(
    () => normalizeDraftInput({ kind: "swap", params: {} }),
    OfflineDraftValidationError,
  );
  assert.throws(
    () => normalizeDraftInput({ kind: "swap", params: null }),
    OfflineDraftValidationError,
  );
  assert.throws(
    () => normalizeDraftInput({ kind: "swap", params: { amount: "1" }, ttlMs: 0 }),
    OfflineDraftValidationError,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

test("isDraftExpired and isDraftRetryable respect TTL and the attempt cap", () => {
  const draft = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" }, ttlMs: 5_000 },
    { now: 1_000, idFactory: () => "d1" },
  );

  assert.equal(isDraftExpired(draft, 5_999), false);
  assert.equal(isDraftExpired(draft, 6_000), true);
  assert.equal(isDraftRetryable(draft, 1_000), true);
  assert.equal(isDraftRetryable({ ...draft, attempts: MAX_DRAFT_ATTEMPTS }, 1_000), false);
  assert.equal(isDraftRetryable({ ...draft, status: "failed" }, 1_000), false);
  assert.equal(isDraftRetryable({ ...draft, status: "syncing" }, 1_000), false);
  assert.equal(isDraftRetryable(draft, 6_000), false);
});

test("sort helpers order drafts by creation time without mutating the input", () => {
  const newer = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" } },
    { now: 2_000, idFactory: () => "newer" },
  );
  const older = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" } },
    { now: 1_000, idFactory: () => "older" },
  );
  const input = [newer, older];

  assert.deepEqual(
    sortDraftsNewestFirst(input).map((draft) => draft.id),
    ["newer", "older"],
  );
  assert.deepEqual(
    sortDraftsOldestFirst(input).map((draft) => draft.id),
    ["older", "newer"],
  );
  assert.deepEqual(
    input.map((draft) => draft.id),
    ["newer", "older"],
  );
});

test("summarizeDraftQueue counts statuses, expired drafts and the oldest draft", () => {
  const now = 10_000;
  const pending = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" } },
    { now: 1_000, idFactory: () => "pending" },
  );
  const syncing = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" } },
    { now: 2_000, idFactory: () => "syncing" },
  );
  const failed = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" } },
    { now: 3_000, idFactory: () => "failed" },
  );
  const expired = normalizeDraftInput(
    { kind: "swap", params: { amount: "1" }, ttlMs: 100 },
    { now: 1_000, idFactory: () => "expired" },
  );

  const counts = summarizeDraftQueue(
    [
      pending,
      { ...syncing, status: "syncing" },
      { ...failed, status: "failed" },
      expired,
    ],
    now,
  );

  assert.equal(counts.total, 4);
  assert.equal(counts.pending, 1);
  assert.equal(counts.syncing, 1);
  assert.equal(counts.failed, 1);
  assert.equal(counts.expired, 1);
  assert.equal(counts.oldestCreatedAt, 1_000);
});

test("describeDraftParams and formatDraftLabel produce readable queue rows", () => {
  const draft = normalizeDraftInput(
    {
      kind: "swap",
      label: "  Sell XLM  ",
      params: { amount: 100, asset: "XLM", memo: "hello" },
    },
    { idFactory: () => "d1" },
  );

  assert.equal(describeDraftParams(draft), "amount=100, asset=XLM, memo=hello");
  assert.equal(describeDraftParams(draft, 2), "amount=100, asset=XLM (+1 more)");
  assert.equal(formatDraftLabel(draft), "Sell XLM");
  assert.equal(formatDraftLabel({ ...draft, label: null }), "Swap");
  assert.equal(
    describeDraftParams(normalizeDraftInput({ kind: "payment", params: { list: [1, 2] } })),
    "list=[2 items]",
  );
});

test("formatDraftAge renders coarse relative ages", () => {
  assert.equal(formatDraftAge(1_000), "just now");
  assert.equal(formatDraftAge(5 * 60_000), "5m ago");
  assert.equal(formatDraftAge(2 * 3_600_000), "2h ago");
  assert.equal(formatDraftAge(3 * 86_400_000), "3d ago");
});

test("buildOfflineDraftSyncSummary partitions results by status", () => {
  const summary = buildOfflineDraftSyncSummary([
    { id: "a", status: "submitted", hash: "hash-a" },
    { id: "b", status: "failed", error: "boom" },
    { id: "c", status: "no-handler", error: "unregistered" },
  ]);

  assert.equal(summary.submittedCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.submitted[0].hash, "hash-a");
  assert.equal(summary.failed[0].error, "boom");
  assert.equal(summary.skipped[0].id, "c");
});

test("isBrowserOffline only reports offline for an explicit false onLine flag", () => {
  try {
    setNavigatorOnline(false);
    assert.equal(isBrowserOffline(), true);
    setNavigatorOnline(true);
    assert.equal(isBrowserOffline(), false);
    setNavigatorOnline(undefined);
    assert.equal(isBrowserOffline(), false);
  } finally {
    restoreNavigator();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

test("enqueue persists the draft so a reloaded queue can read it back", async () => {
  const { clock, driver, queue } = createHarness();
  const draft = await queue.enqueue(BASE_INPUT);

  assert.equal(await queue.count(), 1);
  assert.deepEqual((await queue.get(draft.id))?.params, BASE_INPUT.params);

  // A second queue over the same driver simulates an app reload.
  const reloaded = new OfflineTransactionQueue({ driver, now: () => clock.now });
  const drafts = await reloaded.hydrate();

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, draft.id);
  assert.deepEqual(drafts[0].params, BASE_INPUT.params);
  assert.equal(drafts[0].status, "pending");
});

test("hydrate purges expired drafts and recovers interrupted syncing drafts", async () => {
  const { clock, driver, queue } = createHarness();
  const fresh = await queue.enqueue(BASE_INPUT);
  await queue.enqueue({ ...BASE_INPUT, params: { amount: "5" }, ttlMs: 1_000 });

  // Simulate a tab that was closed while a submission was in flight.
  await driver.put({ ...fresh, status: "syncing" });

  clock.now += 5_000;
  const drafts = await queue.hydrate();

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, fresh.id);
  assert.equal(drafts[0].status, "pending");
  assert.equal((await driver.getAll()).length, 1);
});

test("purgeExpired only removes drafts whose TTL has elapsed", async () => {
  const { clock, queue } = createHarness();
  await queue.enqueue(BASE_INPUT);
  await queue.enqueue({ ...BASE_INPUT, params: { amount: "5" }, ttlMs: 500 });

  clock.now += 1_000;

  assert.equal(await queue.purgeExpired(), 1);
  assert.equal(await queue.count(), 1);
  assert.equal(await queue.purgeExpired(), 0);
});

test("remove and clear delete drafts from storage", async () => {
  const { queue } = createHarness();
  const draft = await queue.enqueue(BASE_INPUT);
  await queue.enqueue({ ...BASE_INPUT, params: { amount: "5" } });

  assert.equal(await queue.remove("missing"), false);
  assert.equal(await queue.remove(draft.id), true);
  assert.equal(await queue.count(), 1);

  await queue.clear();
  assert.equal(await queue.count(), 0);
});

test("enqueueIfOffline only persists drafts while the browser is offline", async () => {
  const { queue } = createHarness();
  try {
    setNavigatorOnline(true);
    assert.equal(await queue.enqueueIfOffline(BASE_INPUT), null);
    assert.equal(await queue.count(), 0);

    setNavigatorOnline(false);
    const saved = await queue.enqueueIfOffline(BASE_INPUT);
    assert.ok(saved);
    assert.equal(saved.params.amount, "100");
    assert.equal(await queue.count(), 1);

    const forced = await queue.enqueueIfOffline(BASE_INPUT, { force: true });
    assert.ok(forced);
    assert.equal(await queue.count(), 2);
  } finally {
    restoreNavigator();
  }
});

test("listPending returns retryable drafts oldest-first", async () => {
  const { clock, queue } = createHarness();
  const first = await queue.enqueue({ ...BASE_INPUT, params: { amount: "1" } });
  clock.now += 10;
  const second = await queue.enqueue({ ...BASE_INPUT, params: { amount: "2" } });

  const pending = await queue.listPending();
  assert.deepEqual(
    pending.map((draft) => draft.id),
    [first.id, second.id],
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Submission
// ─────────────────────────────────────────────────────────────────────────────

test("syncDraft deletes the draft on success and returns the transaction hash", async () => {
  const { queue } = createHarness();
  const draft = await queue.enqueue(BASE_INPUT);
  const seen = [];

  const result = await queue.syncDraft(draft.id, async (submitted) => {
    seen.push(submitted.params);
    return "abc123";
  });

  assert.equal(result.status, "submitted");
  assert.equal(result.hash, "abc123");
  assert.equal(await queue.count(), 0);
  assert.deepEqual(seen, [BASE_INPUT.params]);
});

test("syncDraft keeps the draft queued and records the failure message", async () => {
  const { queue } = createHarness();
  const draft = await queue.enqueue(BASE_INPUT);

  const result = await queue.syncDraft(draft.id, () => {
    throw new Error("horizon unreachable");
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error, "horizon unreachable");

  const stored = await queue.get(draft.id);
  assert.ok(stored);
  assert.equal(stored.status, "pending");
  assert.equal(stored.attempts, 1);
  assert.equal(stored.lastError, "horizon unreachable");
  assert.equal(stored.lastAttemptAt !== null, true);
});

test("syncDraft flips to failed once MAX_DRAFT_ATTEMPTS is exhausted", async () => {
  const { queue } = createHarness();
  const draft = await queue.enqueue(BASE_INPUT);

  for (let attempt = 0; attempt < MAX_DRAFT_ATTEMPTS; attempt += 1) {
    await queue.syncDraft(draft.id, () => {
      throw new Error("still offline");
    });
  }

  const stored = await queue.get(draft.id);
  assert.ok(stored);
  assert.equal(stored.status, "failed");
  assert.equal(stored.attempts, MAX_DRAFT_ATTEMPTS);
  assert.equal((await queue.listPending()).length, 0);
});

test("syncDraft reports no-handler without touching the stored draft", async () => {
  const { queue } = createHarness();
  const draft = await queue.enqueue(BASE_INPUT);

  const result = await queue.syncDraft(draft.id, undefined);

  assert.equal(result.status, "no-handler");
  const stored = await queue.get(draft.id);
  assert.ok(stored);
  assert.equal(stored.attempts, 0);
  assert.equal(stored.status, "pending");
});

test("syncDraft removes an expired draft instead of submitting it", async () => {
  const { clock, queue } = createHarness();
  const draft = await queue.enqueue({ ...BASE_INPUT, ttlMs: 100 });
  clock.now += 1_000;

  let called = false;
  const result = await queue.syncDraft(draft.id, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(result.status, "failed");
  assert.equal(await queue.count(), 0);
});

test("syncPendingDrafts submits every retryable draft and skips failed ones", async () => {
  const { queue } = createHarness();
  const first = await queue.enqueue({ ...BASE_INPUT, params: { amount: "1" } });
  const second = await queue.enqueue({ ...BASE_INPUT, params: { amount: "2" } });

  // Exhaust the retry budget of the second draft.
  for (let attempt = 0; attempt < MAX_DRAFT_ATTEMPTS; attempt += 1) {
    const exhausted = await queue.get(second.id);
    if (exhausted?.status === "failed") break;
    await queue.syncDraft(second.id, () => {
      throw new Error("nope");
    });
  }

  const submitted = [];
  const summary = await queue.syncPendingDrafts((draft) => {
    submitted.push(draft.id);
    return `hash-${draft.id}`;
  });

  assert.deepEqual(submitted, [first.id]);
  assert.equal(summary.submittedCount, 1);
  assert.equal(summary.failedCount, 0);
  assert.equal((await queue.get(second.id))?.status, "failed");
});

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

test("store hydrates persisted drafts and reports queue counts", async () => {
  const { queue, store } = createStoreHarness();
  await queue.enqueue(BASE_INPUT);

  assert.equal(store.getSnapshot().hydrated, false);
  await store.hydrate();

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.hydrated, true);
  assert.equal(snapshot.busy, false);
  assert.equal(snapshot.counts.total, 1);
  assert.equal(snapshot.counts.pending, 1);
  assert.equal(snapshot.storageDriver, "memory");
  assert.equal(snapshot.drafts.length, 1);
});

test("store notifies subscribers when drafts change and records the saved draft", async () => {
  const { store } = createStoreHarness();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });

  await store.hydrate();
  const draft = await store.saveDraft(BASE_INPUT);

  const snapshot = store.getSnapshot();
  assert.ok(notifications >= 2);
  assert.equal(snapshot.lastSavedDraftId, draft.id);
  assert.equal(snapshot.lastSavedAt, draft.createdAt);
  assert.equal(snapshot.counts.total, 1);

  unsubscribe();
  const beforeUnsubscribe = notifications;
  await store.saveDraft(BASE_INPUT);
  assert.equal(notifications, beforeUnsubscribe);

  store.acknowledgeSavedBanner();
  assert.equal(store.getSnapshot().lastSavedDraftId, null);
});

test("store deleteDraft and clearDrafts keep the projection in sync", async () => {
  const { store } = createStoreHarness();
  await store.hydrate();
  const draft = await store.saveDraft(BASE_INPUT);

  await store.deleteDraft(draft.id);
  assert.equal(store.getSnapshot().counts.total, 0);

  await store.saveDraft(BASE_INPUT);
  await store.saveDraft({ ...BASE_INPUT, params: { amount: "5" } });
  assert.equal(store.getSnapshot().counts.total, 2);

  await store.clearDrafts();
  assert.equal(store.getSnapshot().counts.total, 0);
  assert.equal(store.getSnapshot().drafts.length, 0);
});

test("store submitAllDrafts routes drafts through their registered handlers", async () => {
  const { store } = createStoreHarness();
  await store.hydrate();
  await store.saveDraft(BASE_INPUT);
  await store.saveDraft({
    ...BASE_INPUT,
    kind: "remittance",
    params: { amount: "5" },
  });

  const submitted = [];
  const unregisterSwap = store.registerSubmitHandler("swap", async (draft) => {
    submitted.push(draft.id);
    return "hash-swap";
  });
  store.registerSubmitHandler("remittance", (draft) => {
    submitted.push(draft.id);
  });

  const summary = await store.submitAllDrafts();

  assert.equal(summary.submittedCount, 2);
  assert.equal(summary.skippedCount, 0);
  assert.equal(summary.failedCount, 0);
  assert.equal(submitted.length, 2);
  assert.equal(store.getSnapshot().counts.total, 0);
  assert.ok(store.getSnapshot().lastSyncedAt !== null);

  unregisterSwap();
});

test("store reports no-handler drafts without burning retry attempts", async () => {
  const { queue, store } = createStoreHarness();
  await store.hydrate();
  const draft = await store.saveDraft(BASE_INPUT);

  const summary = await store.submitAllDrafts();

  assert.equal(summary.submittedCount, 0);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.failedCount, 0);
  assert.match(String(store.getSnapshot().error), /No submit handler/);

  const stored = await queue.get(draft.id);
  assert.ok(stored);
  assert.equal(stored.attempts, 0);
  assert.equal(stored.status, "pending");
});

test("store keeps a draft queued when its handler throws", async () => {
  const { queue, store } = createStoreHarness();
  await store.hydrate();
  const draft = await store.saveDraft(BASE_INPUT);

  store.registerSubmitHandler("swap", () => {
    throw new Error("wallet locked");
  });

  const summary = await store.submitAllDrafts();

  assert.equal(summary.failedCount, 1);
  assert.equal(store.getSnapshot().error, "wallet locked");

  const stored = await queue.get(draft.id);
  assert.ok(stored);
  assert.equal(stored.attempts, 1);
  assert.equal(stored.lastError, "wallet locked");
  assert.equal(stored.status, "pending");
});

test("store exposes drawer and reconnect-prompt actions", () => {
  const { store } = createStoreHarness();

  assert.equal(store.getSnapshot().drawerOpen, false);
  store.openDrawer();
  assert.equal(store.getSnapshot().drawerOpen, true);
  store.closeDrawer();
  assert.equal(store.getSnapshot().drawerOpen, false);

  store.openPrompt();
  assert.equal(store.getSnapshot().promptOpen, true);
  assert.equal(store.getSnapshot().promptDismissed, false);
  store.dismissPrompt();
  assert.equal(store.getSnapshot().promptOpen, false);
  assert.equal(store.getSnapshot().promptDismissed, true);
  store.resetPromptDismissal();
  assert.equal(store.getSnapshot().promptDismissed, false);

  store.setError("boom");
  assert.equal(store.getSnapshot().error, "boom");
});

test("store saveDraftIfOffline prefers persisting while offline", async () => {
  const { store } = createStoreHarness();
  try {
    setNavigatorOnline(true);
    assert.equal(await store.saveDraftIfOffline(BASE_INPUT), null);
    assert.equal(store.getSnapshot().counts.total, 0);

    setNavigatorOnline(false);
    const draft = await store.saveDraftIfOffline(BASE_INPUT);
    assert.ok(draft);
    assert.equal(store.getSnapshot().counts.total, 1);

    assert.ok(await store.saveDraftIfOffline(BASE_INPUT, { force: true }));
    assert.equal(store.getSnapshot().counts.total, 2);
  } finally {
    restoreNavigator();
  }
});

test("store submitDraft surfaces a missing handler for a single draft", async () => {
  const { store } = createStoreHarness();
  await store.hydrate();
  const draft = await store.saveDraft(BASE_INPUT);

  const result = await store.submitDraft(draft.id);

  assert.equal(result.status, "no-handler");
  assert.match(String(store.getSnapshot().error), /No submit handler/);
});
