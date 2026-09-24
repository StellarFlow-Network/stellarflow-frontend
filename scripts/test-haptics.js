const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const tempDir = path.join(__dirname, "temp_haptics");

function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  console.log("Compiling haptics.ts for test execution...");
  cleanup();

  execSync(`npx tsc src/lib/haptics.ts --outDir scripts/temp_haptics --target es2020 --module commonjs`, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });

  const hapticsPath = fs.existsSync(path.join(tempDir, "haptics.js"))
    ? path.join(tempDir, "haptics.js")
    : path.join(tempDir, "src", "lib", "haptics.js");
  const haptics = require(hapticsPath);

  // Setup Mock Window, LocalStorage, and Navigator
  const mockStorage = {};
  const mockLocalStorage = {
    setItem(k, v) { mockStorage[k] = String(v); },
    getItem(k) { return mockStorage[k] !== undefined ? mockStorage[k] : null; },
    removeItem(k) { delete mockStorage[k]; },
    clear() { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  };

  let vibrateCalls = [];
  const mockVibrate = (pattern) => {
    vibrateCalls.push(pattern);
    return true;
  };

  try {
    Object.defineProperty(global.navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });
  } catch {
    global.navigator = { vibrate: mockVibrate };
  }

  let reducedMotion = false;
  const mockMatchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
  });

  global.window = {
    localStorage: mockLocalStorage,
    matchMedia: mockMatchMedia,
    dispatchEvent: () => {},
    navigator: global.navigator,
  };
  global.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };

  console.log("Running Native Mobile Haptics Engine Tests...\n");

  // Test 1: Feature Detection
  assert.strictEqual(haptics.isHapticsSupported(), true, "Should report haptics as supported");
  console.log("✓ Test 1: isHapticsSupported detects navigator.vibrate");

  // Test 2: Storage Persistence Defaults & Setter
  assert.strictEqual(haptics.getHapticsEnabled(), true, "Should default to enabled");
  haptics.setHapticsEnabled(false);
  assert.strictEqual(haptics.getHapticsEnabled(), false, "Should be disabled after setHapticsEnabled(false)");
  assert.strictEqual(mockStorage[haptics.HAPTIC_STORAGE_KEY], "false", "Storage value should be false");
  
  const toggled = haptics.toggleHaptics();
  assert.strictEqual(toggled, true, "toggleHaptics should invert to true");
  assert.strictEqual(haptics.getHapticsEnabled(), true, "State should be true after toggle");
  console.log("✓ Test 2: Storage persistence and toggle behavior");

  // Test 3: Pattern Resolution
  assert.strictEqual(haptics.resolvePattern('tap'), 12, "Tap pattern should resolve to 12ms");
  assert.strictEqual(haptics.resolvePattern('slider'), 8, "Slider pattern should resolve to 8ms");
  assert.deepStrictEqual(haptics.resolvePattern('txConfirm'), [40, 60, 40], "txConfirm should resolve to [40, 60, 40]");
  assert.deepStrictEqual(haptics.resolvePattern([100, 50, 100]), [100, 50, 100], "Custom array pattern passed through");
  console.log("✓ Test 3: Pattern resolution logic");

  // Test 4: Trigger Execution
  vibrateCalls = [];
  const tapSuccess = haptics.triggerHaptic('tap', true);
  assert.strictEqual(tapSuccess, true, "triggerHaptic('tap') should return true");
  assert.strictEqual(vibrateCalls.length, 1, "Vibrate should be called once");
  assert.strictEqual(vibrateCalls[0], 12, "Vibrate should receive 12ms for tap");

  const txSuccess = haptics.triggerHaptic('txConfirm', true);
  assert.strictEqual(txSuccess, true, "triggerHaptic('txConfirm') should return true");
  assert.deepStrictEqual(vibrateCalls[1], [40, 60, 40], "Vibrate should receive [40, 60, 40] for double pulse");
  console.log("✓ Test 4: Trigger execution and pattern dispatching");

  // Test 5: Disabled Setting Block
  haptics.setHapticsEnabled(false);
  vibrateCalls = [];
  const disabledTrigger = haptics.triggerHaptic('tap', true);
  assert.strictEqual(disabledTrigger, false, "Should return false when disabled");
  assert.strictEqual(vibrateCalls.length, 0, "navigator.vibrate should NOT be called when disabled");
  console.log("✓ Test 5: User preference suppression");

  // Test 6: Reduced Motion Accessibility Override
  haptics.setHapticsEnabled(true);
  reducedMotion = true;
  vibrateCalls = [];
  const reducedTrigger = haptics.triggerHaptic('tap', true);
  assert.strictEqual(reducedTrigger, false, "Should return false when prefers-reduced-motion is true");
  assert.strictEqual(vibrateCalls.length, 0, "navigator.vibrate should NOT be called under reduced motion");
  reducedMotion = false;
  console.log("✓ Test 6: Accessibility reduced-motion override");

  // Test 7: Cancel Haptic
  vibrateCalls = [];
  haptics.cancelHaptic();
  assert.strictEqual(vibrateCalls[0], 0, "cancelHaptic should pass 0 to navigator.vibrate");
  console.log("✓ Test 7: cancelHaptic stops active vibration");

  console.log("\n All 7 Haptics Engine Tests Passed Successfully!");
} finally {
  cleanup();
}
