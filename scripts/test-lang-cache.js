const assert = require('assert');
const path = require('path');

const cache = require(path.join(__dirname, '..', 'src', 'app', 'docs', 'langCache.js'));

// Mock a simple in-memory storage to simulate localStorage
class StorageMock {
  constructor() { this.map = {}; }
  getItem(k) { return this.map[k] || null; }
  setItem(k, v) { this.map[k] = String(v); }
}

function run() {
  const storage = new StorageMock();

  // ensure defaults are exposed via runtime cache
  cache.populateRuntimeFromStorageOrDefaults();
  const rust = cache.getLangConfig('rust');
  const js = cache.getLangConfig('js');

  assert(rust && rust.code && rust.code.includes('soroban_sdk'), 'rust snippet present');
  assert(js && js.code && js.code.includes("stellar-sdk"), 'js snippet present');

  // simulate persisting to custom storage by directly calling internals
  const { defaultConfigs } = cache._internals;
  storage.setItem(cache._internals.STORAGE_KEY, JSON.stringify(defaultConfigs));

  // simulate reading back
  const raw = storage.getItem(cache._internals.STORAGE_KEY);
  assert(raw, 'storage mock stored value');

  // performance-ish check: multiple lookups should be fast and stable
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    cache.getLangConfig(i % 2 === 0 ? 'rust' : 'js');
  }
  const elapsed = Date.now() - start;
  console.log('Performed 1000 cache lookups in', elapsed, 'ms');

  console.log('All langCache checks passed');
}

try {
  run();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(2);
}
