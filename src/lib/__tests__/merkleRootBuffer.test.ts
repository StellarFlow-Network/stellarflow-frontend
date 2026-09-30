/**
 * Unit tests for Shielded Note Commitments Merkle Root History Buffer (#990)
 * Run: npx tsx --test src/lib/__tests__/merkleRootBuffer.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  MerkleRootHistoryBuffer,
  normalizeMerkleRoot,
  DEFAULT_MERKLE_BUFFER_CAPACITY,
} from "../merkleRootBuffer";
import {
  validateWithdrawalProofAgainstRootBuffer,
  type ZKWithdrawalProofPayload,
} from "../shieldedRemittanceNote";

// Helper to generate deterministic 32-byte hex string
function generateMockRoot(index: number): string {
  return index.toString(16).padStart(64, "0");
}

test("MerkleRootHistoryBuffer: initializes with default capacity K = 32", () => {
  const buffer = new MerkleRootHistoryBuffer();
  assert.equal(buffer.capacity, 32);
  assert.equal(buffer.getLatestRoot(), null);

  const stats = buffer.getBufferStats();
  assert.equal(stats.capacity, 32);
  assert.equal(stats.activeCount, 0);
  assert.equal(stats.isFull, false);
});

test("MerkleRootHistoryBuffer: stores up to 32 roots without eviction", () => {
  const buffer = new MerkleRootHistoryBuffer(32);

  for (let i = 1; i <= 32; i++) {
    const root = generateMockRoot(i);
    const evicted = buffer.pushRoot(root);
    assert.equal(evicted, null);
  }

  const stats = buffer.getBufferStats();
  assert.equal(stats.activeCount, 32);
  assert.equal(stats.isFull, true);
  assert.equal(stats.latestRoot, generateMockRoot(32));
  assert.equal(stats.oldestRoot, generateMockRoot(1));
});

test("MerkleRootHistoryBuffer: pushing 33rd root evicts the oldest root (FIFO rollover)", () => {
  const buffer = new MerkleRootHistoryBuffer(32);

  for (let i = 1; i <= 32; i++) {
    buffer.pushRoot(generateMockRoot(i));
  }

  // Push 33rd root
  const root33 = generateMockRoot(33);
  const evicted = buffer.pushRoot(root33);

  // Root 1 must be evicted
  assert.equal(evicted, generateMockRoot(1));
  assert.equal(buffer.isRootValid(generateMockRoot(1)), false);
  assert.equal(buffer.isRootValid(generateMockRoot(33)), true);
  assert.equal(buffer.getLatestRoot(), generateMockRoot(33));

  const stats = buffer.getBufferStats();
  assert.equal(stats.activeCount, 32);
  assert.equal(stats.oldestRoot, generateMockRoot(2));
});

test("MerkleRootHistoryBuffer: O(1) isRootValid correctly validates active vs evicted roots", () => {
  const buffer = new MerkleRootHistoryBuffer(32);

  // Push 40 roots
  for (let i = 1; i <= 40; i++) {
    buffer.pushRoot(generateMockRoot(i));
  }

  // Roots 1..8 should be evicted
  for (let i = 1; i <= 8; i++) {
    assert.equal(buffer.isRootValid(generateMockRoot(i)), false);
  }

  // Roots 9..40 should be active
  for (let i = 9; i <= 40; i++) {
    assert.equal(buffer.isRootValid(generateMockRoot(i)), true);
  }
});

test("MerkleRootHistoryBuffer: root age tracking operates correctly", () => {
  const buffer = new MerkleRootHistoryBuffer(32);

  buffer.pushRoot(generateMockRoot(100)); // Oldest
  buffer.pushRoot(generateMockRoot(101));
  buffer.pushRoot(generateMockRoot(102)); // Latest

  assert.equal(buffer.getRootAge(generateMockRoot(102)), 0);
  assert.equal(buffer.getRootAge(generateMockRoot(101)), 1);
  assert.equal(buffer.getRootAge(generateMockRoot(100)), 2);
  assert.equal(buffer.getRootAge(generateMockRoot(999)), null);
});

test("normalizeMerkleRoot: normalizes hex strings and rejects malformed inputs", () => {
  const validHex = "a".repeat(64);
  assert.equal(normalizeMerkleRoot(`0x${validHex}`), validHex);
  assert.equal(normalizeMerkleRoot(`0X${validHex.toUpperCase()}`), validHex);
  assert.equal(normalizeMerkleRoot(validHex.toUpperCase()), validHex);

  assert.equal(normalizeMerkleRoot("invalid_hex"), null);
  assert.equal(normalizeMerkleRoot("1234"), null);
  assert.equal(normalizeMerkleRoot("a".repeat(63)), null);
  assert.equal(normalizeMerkleRoot("a".repeat(65)), null);
});

test("validateWithdrawalProofAgainstRootBuffer: validates ZK proofs against historical active roots", () => {
  const buffer = new MerkleRootHistoryBuffer(32);

  // Deposit 5 notes over time
  for (let i = 1; i <= 5; i++) {
    buffer.pushRoot(generateMockRoot(i));
  }

  // User generated proof against root #3 while 2 more deposits occurred
  const payload: ZKWithdrawalProofPayload = {
    proof: "0xmockproofdata",
    nullifierHash: generateMockRoot(99),
    merkleRoot: generateMockRoot(3), // Historical root (age 2)
    recipient: "GABC123...",
    amount: "100.00",
  };

  const validation = validateWithdrawalProofAgainstRootBuffer(payload, buffer);
  assert.equal(validation.valid, true);
  if (validation.valid) {
    assert.equal(validation.rootValidation.valid, true);
    assert.equal(validation.rootValidation.isLatestRoot, false);
    assert.equal(validation.rootValidation.rootAge, 2);
  }
});

test("validateWithdrawalProofAgainstRootBuffer: rejects proof when root is expired outside 32-buffer window", () => {
  const buffer = new MerkleRootHistoryBuffer(32);

  for (let i = 1; i <= 50; i++) {
    buffer.pushRoot(generateMockRoot(i));
  }

  // Proof generated against root #5 (evicted, buffer currently holds 19..50)
  const payload: ZKWithdrawalProofPayload = {
    proof: "0xmockproofdata",
    nullifierHash: generateMockRoot(99),
    merkleRoot: generateMockRoot(5),
    recipient: "GABC123...",
    amount: "100.00",
  };

  const validation = validateWithdrawalProofAgainstRootBuffer(payload, buffer);
  assert.equal(validation.valid, false);
  if (!validation.valid) {
    assert.match(validation.error, /Merkle root expired or invalid/);
  }
});

test("MerkleRootHistoryBuffer: retains duplicate roots until the last copy is evicted", () => {
  const buffer = new MerkleRootHistoryBuffer(3);
  const repeatedRoot = generateMockRoot(1);
  const root2 = generateMockRoot(2);
  const root3 = generateMockRoot(3);
  const root4 = generateMockRoot(4);

  buffer.pushRoot(repeatedRoot);
  buffer.pushRoot(root2);
  buffer.pushRoot(repeatedRoot);
  buffer.pushRoot(root3); // Evicts the first copy; the later copy remains active.
  assert.equal(buffer.isRootValid(repeatedRoot), true);
  assert.equal(buffer.getRootAge(repeatedRoot), 1);

  buffer.pushRoot(root4); // Evicts the last remaining copy.
  assert.equal(buffer.isRootValid(repeatedRoot), false);
});

test("MerkleRootHistoryBuffer: handles duplicate/idempotent pushes and clear()", () => {
  const buffer = new MerkleRootHistoryBuffer(32);
  const root1 = generateMockRoot(1);

  buffer.pushRoot(root1);
  const duplicateEviction = buffer.pushRoot(root1); // Redundant push ignored
  assert.equal(duplicateEviction, null);
  assert.equal(buffer.getBufferStats().activeCount, 1);

  buffer.clear();
  assert.equal(buffer.getBufferStats().activeCount, 0);
  assert.equal(buffer.isRootValid(root1), false);
});
