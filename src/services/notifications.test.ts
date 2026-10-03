/**
 * Unit tests for push notification helpers (#599).
 * Run: node --experimental-strip-types --test src/services/notifications.test.ts
 * (or via tsx if available)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePreferences,
  isCategoryEnabled,
  buildNotificationDeepLink,
  parseNotificationDeepLink,
  DEFAULT_NOTIFICATION_PREFERENCES,
  CATEGORY_TO_EVENT,
} from "./notifications.ts";

test("normalizePreferences fills defaults", () => {
  const prefs = normalizePreferences({ enabled: true, swaps: false });
  assert.equal(prefs.enabled, true);
  assert.equal(prefs.swaps, false);
  assert.equal(prefs.limitOrders, true);
  assert.equal(prefs.governanceVotes, false);
  assert.equal(prefs.remittancePayouts, true);
});

test("isCategoryEnabled respects master switch", () => {
  const off = { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: false, swaps: true };
  assert.equal(isCategoryEnabled(off, "swap"), false);

  const on = { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true, swaps: true };
  assert.equal(isCategoryEnabled(on, "swap"), true);
  assert.equal(isCategoryEnabled({ ...on, governanceVotes: false }, "governance"), false);
});

test("deep link build/parse round-trip", () => {
  const link = buildNotificationDeepLink({
    txHash: "deadbeef",
    type: "limit_order",
  });
  assert.equal(link, "/?tx=deadbeef&type=limit_order");
  const parsed = parseNotificationDeepLink(link.slice(1));
  assert.deepEqual(parsed, { txHash: "deadbeef", type: "limit_order" });
});

test("parseNotificationDeepLink rejects unknown types", () => {
  assert.equal(parseNotificationDeepLink("?tx=abc&type=hack"), null);
  assert.equal(parseNotificationDeepLink("?type=swap"), null);
});

test("category ↔ event maps are inverses", () => {
  for (const [cat, event] of Object.entries(CATEGORY_TO_EVENT)) {
    assert.ok(event);
    assert.equal(
      Object.entries(CATEGORY_TO_EVENT).find(([, e]) => e === event)?.[0],
      cat,
    );
  }
});
