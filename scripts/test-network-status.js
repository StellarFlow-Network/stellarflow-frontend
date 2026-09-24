const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const tempDir = path.join(__dirname, "temp-network");

function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  console.log("Compiling rpcNodes.ts and rpc.ts for automated verification...");
  cleanup();

  execSync(
    `npx tsc src/config/rpcNodes.ts src/services/rpc.ts --rootDir src --outDir scripts/temp-network --target es2020 --module commonjs --moduleResolution node --skipLibCheck --esModuleInterop`,
    {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    },
  );

  const rpcNodesPath = path.join(tempDir, "config", "rpcNodes.js");
  const rpcServicePath = path.join(tempDir, "services", "rpc.js");

  const rpcNodes = require(rpcNodesPath);
  const rpcService = require(rpcServicePath);

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

  console.log("\n=======================================================");
  console.log("  Running Issue #730 Network Status & Latency Tests   ");
  console.log("=======================================================\n");

  // ─── Test 1: Color-Coded Latency Classification (<200ms Green, 200-500ms Yellow, >500ms Red)
  console.log("Testing Test 1: Color-Coded Latency Classification Thresholds...");

  // 1a: Fast (<200ms) -> Green
  const optimal1 = rpcNodes.classifyLatency(50);
  assert.strictEqual(optimal1.tier, "optimal", "50ms should be classified as optimal");
  assert.strictEqual(optimal1.colorName, "green", "50ms should be green");
  assert.ok(optimal1.dotClass.includes("39FF14"), "50ms dotClass should have green styling");

  const optimal2 = rpcNodes.classifyLatency(199);
  assert.strictEqual(optimal2.tier, "optimal", "199ms should be optimal");
  assert.strictEqual(optimal2.colorName, "green", "199ms should be green");

  // 1b: Moderate (200-500ms) -> Yellow
  const degraded1 = rpcNodes.classifyLatency(200);
  assert.strictEqual(degraded1.tier, "degraded", "200ms should be degraded");
  assert.strictEqual(degraded1.colorName, "yellow", "200ms should be yellow");
  assert.ok(degraded1.dotClass.includes("yellow"), "200ms dotClass should have yellow styling");

  const degraded2 = rpcNodes.classifyLatency(350);
  assert.strictEqual(degraded2.tier, "degraded", "350ms should be degraded");
  assert.strictEqual(degraded2.colorName, "yellow", "350ms should be yellow");

  const degraded3 = rpcNodes.classifyLatency(500);
  assert.strictEqual(degraded3.tier, "degraded", "500ms should be degraded");
  assert.strictEqual(degraded3.colorName, "yellow", "500ms should be yellow");

  // 1c: Slow (>500ms) -> Red
  const unhealthy1 = rpcNodes.classifyLatency(501);
  assert.strictEqual(unhealthy1.tier, "unhealthy", "501ms should be unhealthy");
  assert.strictEqual(unhealthy1.colorName, "red", "501ms should be red");
  assert.ok(unhealthy1.dotClass.includes("rose") || unhealthy1.dotClass.includes("red"), "501ms should have red/rose styling");

  const unhealthy2 = rpcNodes.classifyLatency(1200);
  assert.strictEqual(unhealthy2.tier, "unhealthy", "1200ms should be unhealthy");
  assert.strictEqual(unhealthy2.colorName, "red", "1200ms should be red");

  // 1d: Checking / Null -> Gray
  const checking = rpcNodes.classifyLatency(null);
  assert.strictEqual(checking.tier, "checking", "null latency should be checking");
  assert.strictEqual(checking.colorName, "gray", "null latency should be gray");

  console.log("✓ Test 1 Passed: Latency thresholds correctly enforce <200ms Green, 200-500ms Yellow, >500ms Red.");

  // ─── Test 2: Preconfigured Stellar RPC Nodes Registry
  console.log("\nTesting Test 2: Stellar RPC Nodes Registry...");
  const nodes = rpcNodes.DEFAULT_RPC_NODES;
  assert.ok(Array.isArray(nodes), "DEFAULT_RPC_NODES must be an array");
  assert.ok(nodes.length >= 4, "Should have multiple nodes for testnet and mainnet");

  const testnetNodes = nodes.filter((n) => n.network === "testnet");
  const mainnetNodes = nodes.filter((n) => n.network === "mainnet");
  assert.ok(testnetNodes.length >= 2, "Testnet should have at least 2 candidate nodes");
  assert.ok(mainnetNodes.length >= 2, "Mainnet should have at least 2 candidate nodes");

  const defaultTestnet = rpcNodes.getDefaultNodeForNetwork("testnet");
  assert.strictEqual(defaultTestnet.network, "testnet");
  assert.ok(defaultTestnet.url.includes("soroban-testnet.stellar.org"));

  const defaultMainnet = rpcNodes.getDefaultNodeForNetwork("mainnet");
  assert.strictEqual(defaultMainnet.network, "mainnet");
  assert.ok(defaultMainnet.url.includes("stellar.org"));

  console.log(`✓ Test 2 Passed: Found ${testnetNodes.length} Testnet nodes and ${mainnetNodes.length} Mainnet nodes with valid defaults.`);

  // ─── Test 3: LocalStorage Persistence & Custom Node Management
  console.log("\nTesting Test 3: LocalStorage Persistence & Custom Node Management...");

  // 3a: Active node selection persistence
  const selectedNode = testnetNodes[1];
  rpcNodes.persistActiveNode("testnet", selectedNode);
  const readBack = rpcNodes.readPersistedActiveNode("testnet");
  assert.strictEqual(readBack.id, selectedNode.id, "Persisted node ID must match");
  assert.strictEqual(readBack.url, selectedNode.url, "Persisted node URL must match");

  // 3b: Custom node addition and retrieval
  const customNode = {
    id: "custom-node-1",
    name: "My Private Node",
    url: "https://rpc.myprivatenode.com",
    network: "testnet",
    type: "soroban",
    provider: "Custom",
    isCustom: true,
  };
  rpcNodes.persistCustomNodes([customNode]);
  const customList = rpcNodes.readCustomNodes();
  assert.strictEqual(customList.length, 1, "Should have 1 custom node saved");
  assert.strictEqual(customList[0].name, "My Private Node");
  assert.strictEqual(customList[0].url, "https://rpc.myprivatenode.com");

  console.log("✓ Test 3 Passed: Active node selection and custom node storage persistence working seamlessly.");

  // ─── Test 4: RpcManager Dynamic Switching & Failover
  console.log("\nTesting Test 4: RpcManager Manual Selection & Failover...");
  const manager = new rpcService.RpcManager();

  const initialEndpoint = manager.getCurrentEndpoint();
  assert.ok(initialEndpoint, "Manager should have an initial endpoint");

  // Manual switch
  const targetUrl = "https://soroban-rpc.mainnet.stellar.org";
  manager.setCurrentEndpoint(targetUrl);
  assert.strictEqual(manager.getCurrentEndpoint().url, targetUrl, "Current endpoint should be updated to target URL");

  // Failover cycle
  const previousUrl = manager.getCurrentEndpoint().url;
  const failoverNext = manager.failover("mainnet");
  assert.notStrictEqual(failoverNext, previousUrl, "Failover should switch to a different endpoint");

  // Latency recording & stats
  manager.recordLatency(targetUrl, 142, null);
  manager.recordLatency(targetUrl, 158, null);
  const stats = manager.getLatencyStats();
  const targetStat = stats.find((s) => s.url === targetUrl);
  assert.ok(targetStat, "Stats should contain target URL");
  assert.strictEqual(targetStat.sampleCount, 2, "Sample count should be 2");
  assert.strictEqual(targetStat.lastLatency, 158, "Last latency should be 158ms");
  assert.strictEqual(targetStat.avgLatency, 150, "Average latency should be 150ms");

  console.log("✓ Test 4 Passed: RpcManager manual selection, failover cycle, and latency tracking verified.");

  // ─── Test 5: Latency Display Formatter
  console.log("\nTesting Test 5: Latency Display Formatter...");
  assert.strictEqual(rpcNodes.formatLatencyDisplay(null), "—");
  assert.strictEqual(rpcNodes.formatLatencyDisplay(42.3), "42ms");
  assert.strictEqual(rpcNodes.formatLatencyDisplay(199.8), "200ms");
  assert.strictEqual(rpcNodes.formatLatencyDisplay(520), "520ms");
  console.log("✓ Test 5 Passed: formatLatencyDisplay outputs clean readable values.");

  console.log("\n=======================================================");
  console.log("  ALL ISSUE #730 NETWORK STATUS TESTS PASSED! (5/5)   ");
  console.log("=======================================================\n");

  cleanup();
  process.exit(0);
} catch (err) {
  console.error("Test failure:", err);
  cleanup();
  process.exit(1);
}
