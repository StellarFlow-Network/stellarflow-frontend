const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const tempDir = path.join(__dirname, "temp");

function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  console.log("Compiling storage.ts for verification...");
  cleanup();
  
  // Compile the TS file to ES6/CommonJS JS file in scripts/temp
  execSync(`npx tsc src/utils/storage.ts --outDir scripts/temp --target es6 --module commonjs`, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });

  const storagePath = path.join(tempDir, "src", "utils", "storage.js");
  const storage = require(storagePath);

  // Setup Mock Window and LocalStorage
  const mockLocalStorage = {
    map: {},
    setItem(k, v) { this.map[k] = String(v); },
    getItem(k) { return this.map[k] !== undefined ? this.map[k] : null; },
    removeItem(k) { delete this.map[k]; },
    clear() { this.map = {}; },
  };

  global.window = {
    localStorage: mockLocalStorage,
  };

  console.log("Running Storage Persistence Middleware Tests...");

  // Test 1: Encryption / Decryption consistency
  const originalText = "StellarFlow-Secret-Data";
  const encrypted = storage.encrypt(originalText);
  const decrypted = storage.decrypt(encrypted);
  assert.strictEqual(decrypted, originalText, "Decrypted text must match original text");
  assert.notStrictEqual(encrypted, originalText, "Encrypted text must be different from original text");
  console.log("✓ Test 1 Passed: Encryption/Decryption Consistency");

  // Test 2: Standard Set and Get
  const testKey = "user_preferences";
  const testValue = { theme: "dark", customRpcEndpoints: ["https://testnet.stellar.org"] };
  
  const setSuccess = storage.setItem(testKey, testValue);
  assert.strictEqual(setSuccess, true, "setItem should return true on success");
  
  const retrievedValue = storage.getItem(testKey);
  assert.deepStrictEqual(retrievedValue, testValue, "Retrieved value should match set value");
  console.log("✓ Test 2 Passed: Standard Set and Get");

  // Test 3: Schema Validation
  const validator = (val) => {
    return val && typeof val.theme === "string" && Array.isArray(val.customRpcEndpoints);
  };
  
  const validRetrieved = storage.getItem(testKey, validator);
  assert.deepStrictEqual(validRetrieved, testValue, "Validator should approve valid data");

  // Invalid data check
  const invalidValidator = (val) => {
    return val && typeof val.nonExistentField === "string";
  };
  const invalidRetrieved = storage.getItem(testKey, invalidValidator);
  assert.strictEqual(invalidRetrieved, null, "Validator should reject invalid data and return null");
  console.log("✓ Test 3 Passed: Schema Validation");

  // Test 4: LocalStorage Fallback Store when disabled / throws
  global.window.localStorage = null; // Disable localStorage
  
  const fallbackKey = "recent_transactions";
  const fallbackValue = [{ id: "tx1", hash: "hash123", status: "confirmed" }];
  
  const setFallbackSuccess = storage.setItem(fallbackKey, fallbackValue);
  assert.strictEqual(setFallbackSuccess, true, "setItem should return true even when localStorage is disabled");
  
  const retrievedFallback = storage.getItem(fallbackKey);
  assert.deepStrictEqual(retrievedFallback, fallbackValue, "getItem should retrieve from memory fallback store");
  console.log("✓ Test 4 Passed: LocalStorage Disabled Fallback");

  console.log("All storage middleware tests passed successfully!");
  cleanup();
  process.exit(0);
} catch (e) {
  console.error("Test suite failed:", e);
  cleanup();
  process.exit(1);
}
