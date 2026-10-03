/**
 * Unit tests for Soroban Storage Footprint Cost Calculator (#772)
 * Run: node --experimental-strip-types --test src/lib/storageCostCalculator.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStorageCost,
  compareStorageTradeoffs,
  parseSimulationFootprint,
  estimateContractDeploymentFootprint,
  formatLedgerDuration,
  STROOPS_PER_XLM,
  LEDGERS_PER_DAY,
  LEDGERS_PER_MONTH,
  LEDGERS_PER_YEAR,
  RENT_CONFIG,
} from './storageCostCalculator.ts';

test('calculateStorageCost: computes correct Stroop and XLM cost for persistent storage', () => {
  const result = calculateStorageCost({
    byteSize: 1024,
    entryCount: 1,
    storageType: 'persistent',
    ledgerCount: LEDGERS_PER_MONTH,
    xlmUsdPrice: 0.12,
  });

  // Effective bytes: 1024 + (1 * 64) = 1088 bytes
  // Write fee: ceil((1088 / 1024) * 10000) = ceil(10625) = 10625 Stroops
  assert.equal(result.writeFeeStroops, 10625);
  assert.equal(result.writeFeeXlm, 10625 / STROOPS_PER_XLM);

  // Rent per ledger: (1 * 0.005 + 1088 * 0.0001) * 1.0 = 0.005 + 0.1088 = 0.1138 Stroops/ledger
  // Total rent for 518400 ledgers: ceil(0.1138 * 518400) = ceil(58993.92) = 58994 Stroops
  assert.equal(result.rentFeeStroops, 58994);
  assert.equal(result.totalCostStroops, 10625 + 58994);
  assert.equal(result.totalCostXlm, (10625 + 58994) / STROOPS_PER_XLM);
  assert.ok(result.totalCostUsd !== null && result.totalCostUsd > 0);
  assert.equal(result.approxDays, 30);
});

test('calculateStorageCost: temporary storage gets 50% rent discount', () => {
  const persistent = calculateStorageCost({
    byteSize: 2048,
    entryCount: 2,
    storageType: 'persistent',
    ledgerCount: LEDGERS_PER_MONTH,
  });

  const temporary = calculateStorageCost({
    byteSize: 2048,
    entryCount: 2,
    storageType: 'temporary',
    ledgerCount: LEDGERS_PER_MONTH,
  });

  // Write fees are identical
  assert.equal(persistent.writeFeeStroops, temporary.writeFeeStroops);
  // Rent fee is 50% of persistent
  assert.equal(temporary.rentFeeStroops, Math.ceil(persistent.rentFeeStroops * 0.5));
  assert.ok(temporary.totalCostXlm < persistent.totalCostXlm);
});

test('calculateStorageCost: handles edge cases (0 bytes, 0 ledgers, negative values)', () => {
  const zeroResult = calculateStorageCost({
    byteSize: 0,
    entryCount: 1,
    storageType: 'persistent',
    ledgerCount: 0,
  });

  assert.equal(zeroResult.byteSize, 0);
  assert.equal(zeroResult.ledgerCount, 0);
  assert.equal(zeroResult.rentFeeStroops, 0);
  assert.ok(zeroResult.writeFeeStroops > 0); // Base overhead for entry key
  assert.equal(zeroResult.totalCostStroops, zeroResult.writeFeeStroops);
});

test('formatLedgerDuration: formats various durations correctly', () => {
  assert.equal(formatLedgerDuration(0), '0 ledgers (0s)');
  assert.match(formatLedgerDuration(10), /10 ledgers \(~50s\)/);
  assert.match(formatLedgerDuration(LEDGERS_PER_DAY), /17,280 ledgers \(~1\.0 days\)/);
  assert.match(formatLedgerDuration(LEDGERS_PER_MONTH), /518,400 ledgers \(~1\.0 mos\)/);
});

test('compareStorageTradeoffs: returns comparison matrix with persistent, temporary, instance', () => {
  const tradeoffs = compareStorageTradeoffs({
    byteSize: 512,
    entryCount: 1,
    ledgerCount: LEDGERS_PER_MONTH,
    xlmUsdPrice: 0.15,
  });

  assert.equal(tradeoffs.length, 3);
  const persistent = tradeoffs.find(t => t.tier === 'persistent')!;
  const temporary = tradeoffs.find(t => t.tier === 'temporary')!;
  const instance = tradeoffs.find(t => t.tier === 'instance')!;

  assert.ok(persistent.isArchivable);
  assert.ok(persistent.canBeRestored);
  assert.ok(!temporary.isArchivable);
  assert.ok(!temporary.canBeRestored);
  assert.ok(instance.isArchivable);

  assert.ok(temporary.costXlm < persistent.costXlm);
  assert.ok(persistent.recommendedUseCases.length > 0);
  assert.ok(temporary.recommendedUseCases.length > 0);
  assert.ok(instance.recommendedUseCases.length > 0);
});

test('parseSimulationFootprint: parses raw simulation response correctly', () => {
  const mockSimulationResponse = {
    minResourceFee: '150000',
    transactionData: {
      resources: {
        readBytes: 4096,
        writeBytes: 1024,
        footprint: {
          readOnly: [{ type: 'contractCode' }],
          readWrite: [{ type: 'contractData' }, { type: 'contractData' }],
        },
      },
    },
  };

  const summary = parseSimulationFootprint(mockSimulationResponse, 0.14);

  assert.equal(summary.readBytes, 4096);
  assert.equal(summary.writeBytes, 1024);
  assert.equal(summary.readOnlyKeysCount, 1);
  assert.equal(summary.readWriteKeysCount, 2);
  assert.equal(summary.totalKeysCount, 3);
  assert.equal(summary.minResourceFeeStroops, 150000);
  assert.equal(summary.minResourceFeeXlm, 150000 / STROOPS_PER_XLM);
  assert.ok(summary.minResourceFeeUsd !== null && summary.minResourceFeeUsd > 0);
  assert.ok(summary.storageBreakdown.persistent.totalCostXlm > 0);
  assert.ok(summary.storageBreakdown.temporary.totalCostXlm < summary.storageBreakdown.persistent.totalCostXlm);
});

test('estimateContractDeploymentFootprint: calculates upfront and annual deployment costs', () => {
  const estimate = estimateContractDeploymentFootprint({
    wasmByteSize: 32768, // 32 KB WASM
    instanceStateByteSize: 1024, // 1 KB Instance config
    persistentEntriesByteSize: 2048, // 2 KB Initial persistent data
    initialTtlDays: 30,
    xlmUsdPrice: 0.12,
  });

  assert.equal(estimate.totalStorageBytes, 32768 + 1024 + 2048);
  assert.equal(estimate.initialRentTtlLedgers, 30 * LEDGERS_PER_DAY);
  assert.ok(estimate.upfrontCostXlm > 0);
  assert.ok(estimate.annualRentXlm > estimate.upfrontCostXlm);
  assert.ok(estimate.upfrontCostUsd !== null && estimate.upfrontCostUsd > 0);
  assert.ok(estimate.annualRentUsd !== null && estimate.annualRentUsd > 0);
});
