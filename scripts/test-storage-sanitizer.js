/**
 * Verification harness for src/utils/storageSanitizer.ts.
 *
 * Follows the scripts/test-storage.js convention: compile the TypeScript to
 * CommonJS, then exercise it against a mocked `window.localStorage`. The repo
 * has no unit-test runner installed, so this is the executable proof.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const tempDir = path.join(__dirname, "temp");

function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/** Minimal but faithful localStorage: ordered keys, string coercion, length. */
function createMockLocalStorage() {
  return {
    map: Object.create(null),
    setItem(k, v) {
      this.map[k] = String(v);
    },
    getItem(k) {
      return k in this.map ? this.map[k] : null;
    },
    removeItem(k) {
      delete this.map[k];
    },
    clear() {
      this.map = Object.create(null);
    },
    key(i) {
      return Object.keys(this.map)[i] ?? null;
    },
    get length() {
      return Object.keys(this.map).length;
    },
  };
}

let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${label}`);
  } catch (error) {
    console.error(`  FAIL ${label}\n         ${error.message}`);
    process.exitCode = 1;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 29);

/** Comfortably inside the retention window. */
const RECENT = new Date(NOW - 5 * DAY_MS).toISOString();
/** Comfortably outside it — "older than 30 days" is a strict comparison. */
const STALE = new Date(NOW - 45 * DAY_MS).toISOString();
/** Exactly on the 30-day boundary. */
const BOUNDARY = new Date(NOW - 30 * DAY_MS).toISOString();

/** A query-cache bucket that passes the version check, padded to `size` chars. */
function cacheBucket(size = 64) {
  const base = { schemaVersion: 1, updatedAt: "x", client: { state: {} } };
  const pad = Math.max(size - JSON.stringify(base).length, 1);
  return JSON.stringify({ ...base, client: { state: { pad: "x".repeat(pad) } } });
}

try {
  console.log("Compiling storageSanitizer.ts for verification...");
  cleanup();

  execSync(
    "npx tsc src/utils/storageSanitizer.ts --rootDir . --outDir scripts/temp --target es2020 --module commonjs --skipLibCheck",
    { cwd: repoRoot, stdio: "inherit" },
  );

  // `./storage` probes localStorage for writability at module load, so the
  // mock has to exist before the module graph is required.
  const mock = createMockLocalStorage();
  global.window = { localStorage: mock };

  const requireTemp = (name) =>
    require(path.join(tempDir, "src", "utils", `${name}.js`));
  const enc = requireTemp("storage");
  const san = requireTemp("storageSanitizer");

  const QUERY_CACHE_KEY = "stellarflow:query-cache:v1";
  const TRADE_KEY = "stellarflow:trade-analytics-history";
  const HISTORY_KEY = "stellarflow-history:swaps";

  const reset = () => {
    mock.clear();
    global.window.localStorage = mock;
  };

  /** Swap in a different storage object, always restoring the mock after. */
  function withStorage(replacement, fn) {
    const original = global.window.localStorage;
    try {
      global.window.localStorage = replacement;
      return fn();
    } finally {
      global.window.localStorage = original;
    }
  }

  const run = (options) => san.sanitizeLocalStorage({ now: NOW, force: true, ...options });

  console.log("\nstorageSanitizer");

  // ── 1. transaction retention ────────────────────────────────────────────────
  check("purges trade analytics older than 30 days, keeps newer", () => {
    reset();
    mock.setItem(
      TRADE_KEY,
      JSON.stringify([
        { tradeId: "stale", timestamp: STALE },
        { tradeId: "recent", timestamp: RECENT },
      ]),
    );

    const report = run();

    assert.strictEqual(report.transactionsRemoved, 1, "one record purged");
    const kept = JSON.parse(mock.getItem(TRADE_KEY));
    assert.deepStrictEqual(
      kept.map((t) => t.tradeId),
      ["recent"],
      "only the in-window record survives",
    );
  });

  check("retains a record sitting exactly on the 30-day boundary", () => {
    reset();
    mock.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "edge", timestamp: BOUNDARY }]));

    const report = run();

    assert.strictEqual(report.transactionsRemoved, 0, "30 days is not *older* than 30 days");
    assert.strictEqual(JSON.parse(mock.getItem(TRADE_KEY)).length, 1);
  });

  check("keeps records it cannot date", () => {
    reset();
    mock.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "undated" }]));

    const report = run();

    assert.strictEqual(report.transactionsRemoved, 0);
    assert.strictEqual(JSON.parse(mock.getItem(TRADE_KEY)).length, 1);
  });

  check("purges the historySync { data } envelope", () => {
    reset();
    mock.setItem(
      HISTORY_KEY,
      JSON.stringify({
        key: "swaps",
        updatedAt: NOW,
        data: [
          { id: "tx-stale", date: STALE },
          { id: "tx-recent", date: RECENT },
        ],
      }),
    );

    const report = run();

    assert.strictEqual(report.transactionsRemoved, 1);
    const record = JSON.parse(mock.getItem(HISTORY_KEY));
    assert.deepStrictEqual(
      record.data.map((t) => t.id),
      ["tx-recent"],
    );
    assert.strictEqual(record.key, "swaps", "envelope metadata preserved");
    assert.strictEqual(record.updatedAt, NOW, "write stamp is not rewritten");
  });

  check("normalizes second-precision epochs", () => {
    reset();
    const staleSeconds = Math.floor((NOW - 45 * DAY_MS) / 1000);
    mock.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "old", timestamp: staleSeconds }]));

    const report = run();

    assert.strictEqual(report.transactionsRemoved, 1, "seconds are not misread as 1970");
  });

  check("evicts an unparseable history payload", () => {
    reset();
    mock.setItem(TRADE_KEY, "{not json");

    const report = run();

    assert.ok(report.evictedKeys.includes(TRADE_KEY), "corrupt entry evicted");
    assert.strictEqual(mock.getItem(TRADE_KEY), null);
  });

  // ── 2. version validation & migration ──────────────────────────────────────
  check("migrates an outdated enveloped key to the current version", () => {
    reset();
    // v0 envelope, as written before the version tag existed.
    mock.setItem(
      "stellarflow.customTokens.v1",
      enc.encrypt(JSON.stringify({ version: 0, data: { tokens: [{ code: "USDC" }] } })),
    );

    const report = run();

    assert.deepStrictEqual(report.migratedKeys, ["stellarflow.customTokens.v1"]);
    const envelope = JSON.parse(enc.decrypt(mock.getItem("stellarflow.customTokens.v1")));
    assert.strictEqual(envelope.version, 1, "stamped with the current version");
    assert.deepStrictEqual(envelope.data, { tokens: [{ code: "USDC" }] }, "payload preserved");
    assert.deepStrictEqual(enc.getItem("stellarflow.customTokens.v1"), {
      tokens: [{ code: "USDC" }],
    }, "and it reads back through the normal path");
  });

  check("evicts a v0 payload the ladder cannot lift, without throwing", () => {
    reset();
    // migrations[0] rejects non-objects.
    mock.setItem(
      "stellarflow.beneficiaries.v1",
      enc.encrypt(JSON.stringify({ version: 0, data: "not-an-object" })),
    );

    const report = run();

    assert.ok(report.evictedKeys.includes("stellarflow.beneficiaries.v1"));
    assert.strictEqual(mock.getItem("stellarflow.beneficiaries.v1"), null);
  });

  check("evicts a schema written by a newer build", () => {
    reset();
    mock.setItem(
      "stellarflow.chart.preferences",
      enc.encrypt(JSON.stringify({ version: 99, data: { theme: "dark" } })),
    );

    const report = run();

    assert.ok(report.evictedKeys.includes("stellarflow.chart.preferences"), "downgrade is not trusted");
  });

  check("evicts an unversioned plain entry", () => {
    reset();
    mock.setItem(QUERY_CACHE_KEY, JSON.stringify({ client: { state: {} } }));

    const report = run();

    assert.ok(report.evictedKeys.includes(QUERY_CACHE_KEY));
  });

  check("leaves a current-version entry untouched", () => {
    reset();
    const payload = cacheBucket();
    mock.setItem(QUERY_CACHE_KEY, payload);

    const report = run();

    assert.deepStrictEqual(report.migratedKeys, []);
    assert.deepStrictEqual(report.evictedKeys, []);
    assert.strictEqual(mock.getItem(QUERY_CACHE_KEY), payload, "byte-identical");
  });

  // ── 3. quota enforcement ───────────────────────────────────────────────────
  check("evicts the largest disposable entry when over quota", () => {
    reset();
    mock.setItem(QUERY_CACHE_KEY, cacheBucket(2000));
    mock.setItem(HISTORY_KEY, JSON.stringify({ key: "swaps", data: [] }));
    mock.setItem("stellarflow-theme", "z".repeat(3000));

    const report = run({ maxBytes: 1000 });

    assert.strictEqual(report.quotaEnforced, true, "quota pass engaged");
    assert.ok(
      report.evictedKeys.indexOf(QUERY_CACHE_KEY) < report.evictedKeys.indexOf(HISTORY_KEY),
      "largest disposable went first",
    );
    assert.strictEqual(mock.getItem("stellarflow-theme"), "z".repeat(3000), "non-disposable preserved");
  });

  check("never evicts non-disposable state under quota pressure", () => {
    reset();
    mock.setItem("stellarflow-theme", "z".repeat(4000));
    mock.setItem("stellarflow.wallet.publicKey", "G".repeat(4000));

    const report = run({ maxBytes: 100 });

    assert.strictEqual(report.quotaEnforced, false, "nothing evictable to remove");
    assert.strictEqual(mock.getItem("stellarflow-theme"), "z".repeat(4000));
    assert.strictEqual(mock.getItem("stellarflow.wallet.publicKey"), "G".repeat(4000));
    assert.ok(report.errors.some((e) => e.includes("quota pass")), "reports the shortfall");
  });

  check("brings usage back under the ceiling", () => {
    reset();
    mock.setItem(QUERY_CACHE_KEY, cacheBucket(4000));
    mock.setItem(HISTORY_KEY, JSON.stringify({ key: "swaps", data: [] }));

    const report = run({ maxBytes: 2000 });

    assert.ok(report.bytesAfter <= 2000, `usage ${report.bytesAfter} must be <= 2000`);
    assert.ok(report.bytesAfter < report.bytesBefore, "space was actually reclaimed");
  });

  check("does not engage below the ceiling", () => {
    reset();
    mock.setItem(QUERY_CACHE_KEY, cacheBucket(64));

    const report = run({ maxBytes: 1000 });

    assert.strictEqual(report.quotaEnforced, false);
    assert.ok(mock.getItem(QUERY_CACHE_KEY), "entry preserved");
  });

  // ── 4. throttling ──────────────────────────────────────────────────────────
  check("skips a second pass inside the throttle window", () => {
    reset();
    mock.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "stale", timestamp: STALE }]));

    san.sanitizeLocalStorage({ now: NOW, force: true });
    const second = san.sanitizeLocalStorage({ now: NOW + 60_000 });

    assert.strictEqual(second.skipped, true);
    assert.strictEqual(second.skipReason, "throttled");
    assert.strictEqual(JSON.parse(mock.getItem(TRADE_KEY)).length, 0, "first pass still did the work");
  });

  check("runs again once the throttle window elapses", () => {
    reset();
    mock.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "stale", timestamp: STALE }]));

    san.sanitizeLocalStorage({ now: NOW, force: true });
    const later = san.sanitizeLocalStorage({ now: NOW + san.SANITIZER_MIN_INTERVAL_MS + 1 });

    assert.strictEqual(later.skipped, false, "throttle expired");
  });

  // ── 5. manual clear ────────────────────────────────────────────────────────
  check("clearLocalDataCache drops cache but preserves identity", () => {
    reset();
    mock.setItem(QUERY_CACHE_KEY, cacheBucket());
    mock.setItem(TRADE_KEY, "[]");
    mock.setItem(HISTORY_KEY, JSON.stringify({ key: "swaps", data: [] }));
    mock.setItem("stellarflow-theme", "dark");
    mock.setItem("stellarflow.wallet.publicKey", "GABC");
    mock.setItem("stellarflow.beneficiaries.v1", "keep-me");

    const result = san.clearLocalDataCache();

    assert.ok(result.clearedKeys.includes(QUERY_CACHE_KEY));
    assert.ok(result.clearedKeys.includes(HISTORY_KEY));
    assert.ok(result.bytesFreed > 0, "reports reclaimed bytes");
    assert.strictEqual(mock.getItem(QUERY_CACHE_KEY), null);
    assert.strictEqual(mock.getItem(TRADE_KEY), null);
    assert.strictEqual(mock.getItem("stellarflow-theme"), "dark", "theme kept");
    assert.strictEqual(mock.getItem("stellarflow.wallet.publicKey"), "GABC", "session kept");
    assert.strictEqual(mock.getItem("stellarflow.beneficiaries.v1"), "keep-me", "address book kept");
  });

  check("clearLocalDataCache resets the throttle marker", () => {
    reset();
    mock.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "stale", timestamp: STALE }]));

    san.sanitizeLocalStorage({ now: NOW, force: true });
    san.clearLocalDataCache();
    const next = san.sanitizeLocalStorage({ now: NOW });

    assert.strictEqual(next.skipped, false, "next boot re-runs the full pass");
  });

  // ── 6. resilience ──────────────────────────────────────────────────────────
  check("reports storage-unavailable instead of throwing", () => {
    reset();
    withStorage(null, () => {
      const report = san.sanitizeLocalStorage({ now: NOW, force: true });
      assert.strictEqual(report.skipped, true);
      assert.strictEqual(report.skipReason, "storage-unavailable");

      const cleared = san.clearLocalDataCache();
      assert.ok(cleared.errors.length > 0, "clear reports the failure");
    });
  });

  check("collects errors when writes are rejected, without throwing", () => {
    reset();
    const hostile = createMockLocalStorage();
    hostile.setItem(TRADE_KEY, JSON.stringify([{ tradeId: "stale", timestamp: STALE }]));
    hostile.setItem = () => {
      const error = new Error("write rejected");
      error.name = "QuotaExceededError";
      throw error;
    };

    withStorage(hostile, () => {
      const report = san.sanitizeLocalStorage({ now: NOW, force: true });
      assert.ok(typeof report === "object", "returned a report");
      assert.ok(report.errors.length > 0, "recorded the write failure");
    });
  });

  check("getStorageFootprint is SSR-safe", () => {
    const originalWindow = global.window;
    try {
      delete global.window;
      const footprint = san.getStorageFootprint();
      assert.strictEqual(footprint.totalBytes, 0);
      assert.strictEqual(footprint.percentUsed, null);
      assert.ok(Array.isArray(footprint.entries));
    } finally {
      global.window = originalWindow;
    }
  });

  // ── 7. footprint accounting ────────────────────────────────────────────────
  check("footprint meters UTF-16 bytes and splits evictable", () => {
    reset();
    mock.setItem(QUERY_CACHE_KEY, cacheBucket(50));
    mock.setItem("stellarflow-theme", "y".repeat(50));

    const footprint = san.getStorageFootprint();
    const query = footprint.entries.find((e) => e.key === QUERY_CACHE_KEY);
    const theme = footprint.entries.find((e) => e.key === "stellarflow-theme");

    assert.ok(query, "query cache entry measured");
    assert.strictEqual(theme.bytes, 100, "50 chars = 100 UTF-16 bytes");
    assert.strictEqual(footprint.totalBytes, query.bytes + 100);
    assert.strictEqual(footprint.evictableBytes, query.bytes);
  });

  if (process.exitCode) {
    console.error(`\n${passed} passed, some checks FAILED.`);
  } else {
    console.log(`\nAll ${passed} storageSanitizer checks passed.`);
  }

  cleanup();
  process.exit(process.exitCode ?? 0);
} catch (error) {
  console.error("Test harness failed:", error);
  cleanup();
  process.exit(1);
}
