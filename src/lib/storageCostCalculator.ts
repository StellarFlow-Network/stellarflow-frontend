/**
 * Soroban Contract Storage Footprint & Rent Cost Calculator
 * 
 * Implements Stellar/Soroban state rent fee formulas and footprint parsing
 * based on Soroban Protocol specifications (Protocol 20+).
 */

export type StorageTier = 'persistent' | 'temporary' | 'instance';

export interface StorageRentParams {
  /** Size in bytes to be stored/written */
  byteSize: number;
  /** Number of storage entries (default 1) */
  entryCount?: number;
  /** Storage tier: persistent, temporary, or instance */
  storageType: StorageTier;
  /** Number of ledgers to keep the entry alive (TTL) */
  ledgerCount: number;
  /** Optional live price of 1 XLM in USD */
  xlmUsdPrice?: number;
}

export interface StorageCostBreakdown {
  /** Storage type evaluated */
  storageType: StorageTier;
  /** Byte size evaluated */
  byteSize: number;
  /** Entry count evaluated */
  entryCount: number;
  /** Target ledger count duration */
  ledgerCount: number;
  /** Duration converted to approximate days (~5 sec per ledger) */
  approxDays: number;
  /** One-time base write resource fee in Stroops */
  writeFeeStroops: number;
  /** One-time base read resource fee in Stroops */
  readFeeStroops: number;
  /** Recurring state rent fee in Stroops for the given ledger count */
  rentFeeStroops: number;
  /** Total cost (Write fee + Rent fee) in Stroops */
  totalCostStroops: number;
  /** Total cost in XLM (1 XLM = 10,000,000 Stroops) */
  totalCostXlm: number;
  /** Write fee in XLM */
  writeFeeXlm: number;
  /** Rent fee in XLM */
  rentFeeXlm: number;
  /** Total cost in USD (if XLM price available) */
  totalCostUsd: number | null;
  /** Rent cost per day in XLM */
  rentPerDayXlm: number;
  /** Rent cost per month (30 days) in XLM */
  rentPerMonthXlm: number;
  /** Rent cost per year (365 days) in XLM */
  rentPerYearXlm: number;
}

export interface StorageTradeoffItem {
  tier: StorageTier;
  title: string;
  badge: string;
  isArchivable: boolean;
  canBeRestored: boolean;
  costMultiplier: number;
  costXlm: number;
  costUsd: number | null;
  rentPerMonthXlm: number;
  pros: string[];
  cons: string[];
  recommendedUseCases: string[];
}

export interface SimulationFootprintSummary {
  readBytes: number;
  writeBytes: number;
  readOnlyKeysCount: number;
  readWriteKeysCount: number;
  totalKeysCount: number;
  minResourceFeeStroops: number;
  minResourceFeeXlm: number;
  minResourceFeeUsd: number | null;
  estimatedRent1DayXlm: number;
  estimatedRent30DaysXlm: number;
  estimatedRent1YearXlm: number;
  estimatedRent30DaysUsd: number | null;
  storageBreakdown: {
    persistent: StorageCostBreakdown;
    temporary: StorageCostBreakdown;
    instance: StorageCostBreakdown;
  };
}

export interface ContractDeploymentFootprintEstimate {
  wasmByteSize: number;
  instanceStateByteSize: number;
  persistentEntriesByteSize: number;
  totalStorageBytes: number;
  initialRentTtlLedgers: number;
  upfrontCostXlm: number;
  upfrontCostUsd: number | null;
  annualRentXlm: number;
  annualRentUsd: number | null;
}

// -------------------------------------------------------------------------
// Protocol Network Constants (Soroban Standard Protocol Rent Coefficients)
// -------------------------------------------------------------------------

/** Number of Stroops in 1 XLM */
export const STROOPS_PER_XLM = 10_000_000;

/** Average block/ledger close time in seconds on Stellar */
export const SECONDS_PER_LEDGER = 5;

/** Ledgers per standard time units */
export const LEDGERS_PER_DAY = Math.round((24 * 60 * 60) / SECONDS_PER_LEDGER); // 17,280 ledgers/day
export const LEDGERS_PER_MONTH = LEDGERS_PER_DAY * 30; // 518,400 ledgers/month
export const LEDGERS_PER_YEAR = LEDGERS_PER_DAY * 365; // 6,307,200 ledgers/year

/**
 * Rent and resource coefficients (in Stroops):
 * Based on Soroban Protocol 20/21 baseline network configuration.
 */
export const RENT_CONFIG = {
  /** Base fee to write 1 KB (1024 bytes) of ledger data in Stroops */
  WRITE_FEE_PER_1KB: 10_000,
  /** Base fee to read 1 KB (1024 bytes) of ledger data in Stroops */
  READ_FEE_PER_1KB: 1_785,
  /** Base rent fee per storage entry per ledger in Stroops (Persistent/Instance) */
  RENT_FEE_PER_ENTRY_PER_LEDGER: 0.005,
  /** Base rent fee per byte per ledger in Stroops (Persistent/Instance) */
  RENT_FEE_PER_BYTE_PER_LEDGER: 0.0001,
  /**
   * Discount / cost multiplier for Temporary storage:
   * Temporary storage does not require archival tracking and is automatically discarded on expiry.
   * Typically ~50% cheaper or exempt from long-term archival rent reserves.
   */
  TEMPORARY_STORAGE_RENT_MULTIPLIER: 0.5,
  /**
   * Instance storage shares lifetime with the contract instance.
   * Multiplier relative to persistent entry.
   */
  INSTANCE_STORAGE_RENT_MULTIPLIER: 1.0,
  /** Persistent storage multiplier */
  PERSISTENT_STORAGE_RENT_MULTIPLIER: 1.0,
  /** Overhead per ledger entry in bytes (key metadata, headers) */
  ENTRY_KEY_OVERHEAD_BYTES: 64,
} as const;

// -------------------------------------------------------------------------
// Pure Calculation Helpers
// -------------------------------------------------------------------------

/**
 * Calculates Soroban state rent and resource footprint costs for a given payload.
 *
 * @param params StorageRentParams
 * @returns StorageCostBreakdown
 */
export function calculateStorageCost(params: StorageRentParams): StorageCostBreakdown {
  const byteSize = Math.max(0, Math.floor(params.byteSize || 0));
  const entryCount = Math.max(1, Math.floor(params.entryCount || 1));
  const ledgerCount = Math.max(0, Math.floor(params.ledgerCount || 0));
  const storageType = params.storageType || 'persistent';
  const xlmPrice = params.xlmUsdPrice && params.xlmUsdPrice > 0 ? params.xlmUsdPrice : null;

  // Effective byte size includes entry overhead per ledger entry
  const totalEffectiveBytes = byteSize + (entryCount * RENT_CONFIG.ENTRY_KEY_OVERHEAD_BYTES);

  // 1. One-time Write & Read Resource Fees (Stroops)
  const writeFeeStroops = Math.ceil((totalEffectiveBytes / 1024) * RENT_CONFIG.WRITE_FEE_PER_1KB);
  const readFeeStroops = Math.ceil((totalEffectiveBytes / 1024) * RENT_CONFIG.READ_FEE_PER_1KB);

  // 2. Storage Tier Multiplier
  let tierMultiplier: number = RENT_CONFIG.PERSISTENT_STORAGE_RENT_MULTIPLIER;
  if (storageType === 'temporary') {
    tierMultiplier = RENT_CONFIG.TEMPORARY_STORAGE_RENT_MULTIPLIER;
  } else if (storageType === 'instance') {
    tierMultiplier = RENT_CONFIG.INSTANCE_STORAGE_RENT_MULTIPLIER;
  }

  // 3. State Rent Fee Calculation (Stroops)
  // Rent = (Rent_Per_Entry * Entries + Rent_Per_Byte * Total_Bytes) * Ledgers * Tier_Multiplier
  const rentPerLedger = (
    (entryCount * RENT_CONFIG.RENT_FEE_PER_ENTRY_PER_LEDGER) +
    (totalEffectiveBytes * RENT_CONFIG.RENT_FEE_PER_BYTE_PER_LEDGER)
  ) * tierMultiplier;

  const rentFeeStroops = Math.ceil(rentPerLedger * ledgerCount);
  const totalCostStroops = writeFeeStroops + rentFeeStroops;

  // Convert to XLM
  const totalCostXlm = totalCostStroops / STROOPS_PER_XLM;
  const writeFeeXlm = writeFeeStroops / STROOPS_PER_XLM;
  const rentFeeXlm = rentFeeStroops / STROOPS_PER_XLM;

  // Projection per standard time units in XLM
  const rentPerDayXlm = (rentPerLedger * LEDGERS_PER_DAY) / STROOPS_PER_XLM;
  const rentPerMonthXlm = (rentPerLedger * LEDGERS_PER_MONTH) / STROOPS_PER_XLM;
  const rentPerYearXlm = (rentPerLedger * LEDGERS_PER_YEAR) / STROOPS_PER_XLM;

  const approxDays = Number(((ledgerCount * SECONDS_PER_LEDGER) / (24 * 60 * 60)).toFixed(2));
  const totalCostUsd = xlmPrice ? Number((totalCostXlm * xlmPrice).toFixed(6)) : null;

  return {
    storageType,
    byteSize,
    entryCount,
    ledgerCount,
    approxDays,
    writeFeeStroops,
    readFeeStroops,
    rentFeeStroops,
    totalCostStroops,
    totalCostXlm,
    writeFeeXlm,
    rentFeeXlm,
    totalCostUsd,
    rentPerDayXlm,
    rentPerMonthXlm,
    rentPerYearXlm,
  };
}

/**
 * Converts ledger counts to approximate human-readable duration string.
 */
export function formatLedgerDuration(ledgers: number): string {
  if (ledgers <= 0) return '0 ledgers (0s)';
  const totalSeconds = ledgers * SECONDS_PER_LEDGER;
  if (totalSeconds < 60) return `${ledgers} ledgers (~${totalSeconds}s)`;
  if (totalSeconds < 3600) return `${ledgers} ledgers (~${Math.round(totalSeconds / 60)} min)`;
  if (totalSeconds < 86400) return `${ledgers} ledgers (~${(totalSeconds / 3600).toFixed(1)} hrs)`;
  const days = totalSeconds / 86400;
  if (days < 30) return `${ledgers.toLocaleString()} ledgers (~${days.toFixed(1)} days)`;
  const months = days / 30;
  if (months < 12) return `${ledgers.toLocaleString()} ledgers (~${months.toFixed(1)} mos)`;
  const years = days / 365;
  return `${ledgers.toLocaleString()} ledgers (~${years.toFixed(1)} yrs)`;
}

/**
 * Compares storage allocation tradeoffs across Persistent, Temporary, and Instance storage.
 *
 * @param params { byteSize, entryCount, ledgerCount, xlmUsdPrice }
 * @returns Array of StorageTradeoffItem for side-by-side analysis
 */
export function compareStorageTradeoffs(params: {
  byteSize: number;
  entryCount?: number;
  ledgerCount?: number;
  xlmUsdPrice?: number;
}): StorageTradeoffItem[] {
  const ledgerCount = params.ledgerCount ?? LEDGERS_PER_MONTH;
  const entryCount = params.entryCount ?? 1;
  const xlmPrice = params.xlmUsdPrice;

  const persistentCost = calculateStorageCost({
    byteSize: params.byteSize,
    entryCount,
    storageType: 'persistent',
    ledgerCount,
    xlmUsdPrice: xlmPrice,
  });

  const temporaryCost = calculateStorageCost({
    byteSize: params.byteSize,
    entryCount,
    storageType: 'temporary',
    ledgerCount,
    xlmUsdPrice: xlmPrice,
  });

  const instanceCost = calculateStorageCost({
    byteSize: params.byteSize,
    entryCount,
    storageType: 'instance',
    ledgerCount,
    xlmUsdPrice: xlmPrice,
  });

  return [
    {
      tier: 'persistent',
      title: 'Persistent Storage',
      badge: 'Archivable & Restorable',
      isArchivable: true,
      canBeRestored: true,
      costMultiplier: RENT_CONFIG.PERSISTENT_STORAGE_RENT_MULTIPLIER,
      costXlm: persistentCost.totalCostXlm,
      costUsd: persistentCost.totalCostUsd,
      rentPerMonthXlm: persistentCost.rentPerMonthXlm,
      pros: [
        'Data is never permanently lost upon expiration; it enters archived state.',
        'Can be revived anytime by paying a restoration fee.',
        'Ideal for mission-critical user balances, governance stakes, and ownership records.',
      ],
      cons: [
        'Higher overall rent footprint than temporary storage.',
        'Requires active TTL extension or restoration logic if expired.',
      ],
      recommendedUseCases: [
        'User token balances & allowances',
        'Vesting schedules & escrow locks',
        'NFT/Asset ownership registries',
      ],
    },
    {
      tier: 'temporary',
      title: 'Temporary Storage',
      badge: '50% Rent Discount',
      isArchivable: false,
      canBeRestored: false,
      costMultiplier: RENT_CONFIG.TEMPORARY_STORAGE_RENT_MULTIPLIER,
      costXlm: temporaryCost.totalCostXlm,
      costUsd: temporaryCost.totalCostUsd,
      rentPerMonthXlm: temporaryCost.rentPerMonthXlm,
      pros: [
        'Lowest cost footprint with 50% discount on state rent fees.',
        'Automatically reclaimed and purged from ledger upon expiration with zero cleanup cost.',
        'Zero archival storage overhead.',
      ],
      cons: [
        'Irrevocably deleted once TTL drops to zero; cannot be restored under any circumstances.',
        'Unsuitable for persistent user balances or long-term data.',
      ],
      recommendedUseCases: [
        'Oracle price feeds & volatile sensor feeds',
        'Replay protection nonces & authorization signatures',
        'Temporary limit order quotes & rate-limiting records',
      ],
    },
    {
      tier: 'instance',
      title: 'Instance Storage',
      badge: 'Contract-Bound',
      isArchivable: true,
      canBeRestored: true,
      costMultiplier: RENT_CONFIG.INSTANCE_STORAGE_RENT_MULTIPLIER,
      costXlm: instanceCost.totalCostXlm,
      costUsd: instanceCost.totalCostUsd,
      rentPerMonthXlm: instanceCost.rentPerMonthXlm,
      pros: [
        'Directly tied to the smart contract instance lifecycle.',
        'Extending the contract TTL automatically extends all instance storage entries.',
        'Readily accessible across all contract method invocations without separate key lookups.',
      ],
      cons: [
        'Limited total instance storage quota (typically 64 KB maximum per contract).',
        'Not scalable for arbitrary numbers of users or dynamic collections.',
      ],
      recommendedUseCases: [
        'Contract admin addresses & protocol pause flags',
        'Global protocol fee percentages & treasury settings',
        'WASM upgrade hashes & protocol configuration',
      ],
    },
  ];
}

/**
 * Parses Soroban RPC simulation response JSON or object and calculates
 * the storage footprint breakdown and rent cost projection.
 *
 * @param simulationResponse Raw response from `sorobanRpc.simulateTransaction`
 * @param xlmUsdPrice Optional XLM price in USD
 * @returns SimulationFootprintSummary
 */
export function parseSimulationFootprint(
  simulationResponse: unknown,
  xlmUsdPrice?: number,
): SimulationFootprintSummary {
  const sim = (simulationResponse ?? {}) as Record<string, unknown>;

  // Extract SorobanTransactionData or transaction resources if available
  const txData = (sim.transactionData ?? sim.sorobanTransactionData ?? {}) as Record<string, unknown>;
  const resources = (txData.resources ?? sim.resources ?? {}) as Record<string, unknown>;
  const footprint = (resources.footprint ?? txData.footprint ?? sim.footprint ?? {}) as Record<string, unknown>;

  const readOnlyKeys: unknown[] = Array.isArray(footprint.readOnly) ? footprint.readOnly : [];
  const readWriteKeys: unknown[] = Array.isArray(footprint.readWrite) ? footprint.readWrite : [];

  const readBytes = typeof resources.readBytes === 'number'
    ? resources.readBytes
    : (typeof sim.readBytes === 'number' ? sim.readBytes : 0);

  const writeBytes = typeof resources.writeBytes === 'number'
    ? resources.writeBytes
    : (typeof sim.writeBytes === 'number' ? sim.writeBytes : 0);

  const minResourceFeeStroops = typeof sim.minResourceFee === 'string'
    ? parseInt(sim.minResourceFee, 10)
    : (typeof sim.minResourceFee === 'number' ? sim.minResourceFee : 0);

  const totalKeysCount = readOnlyKeys.length + readWriteKeys.length;
  const effectiveWriteBytes = Math.max(writeBytes, totalKeysCount * RENT_CONFIG.ENTRY_KEY_OVERHEAD_BYTES);
  const effectiveEntryCount = Math.max(1, readWriteKeys.length || 1);

  // Compute breakdown for 30 days
  const persistent = calculateStorageCost({
    byteSize: effectiveWriteBytes,
    entryCount: effectiveEntryCount,
    storageType: 'persistent',
    ledgerCount: LEDGERS_PER_MONTH,
    xlmUsdPrice,
  });

  const temporary = calculateStorageCost({
    byteSize: effectiveWriteBytes,
    entryCount: effectiveEntryCount,
    storageType: 'temporary',
    ledgerCount: LEDGERS_PER_MONTH,
    xlmUsdPrice,
  });

  const instance = calculateStorageCost({
    byteSize: effectiveWriteBytes,
    entryCount: effectiveEntryCount,
    storageType: 'instance',
    ledgerCount: LEDGERS_PER_MONTH,
    xlmUsdPrice,
  });

  const minResourceFeeXlm = minResourceFeeStroops / STROOPS_PER_XLM;
  const minResourceFeeUsd = xlmUsdPrice ? Number((minResourceFeeXlm * xlmUsdPrice).toFixed(6)) : null;

  return {
    readBytes,
    writeBytes,
    readOnlyKeysCount: readOnlyKeys.length,
    readWriteKeysCount: readWriteKeys.length,
    totalKeysCount,
    minResourceFeeStroops,
    minResourceFeeXlm,
    minResourceFeeUsd,
    estimatedRent1DayXlm: persistent.rentPerDayXlm,
    estimatedRent30DaysXlm: persistent.rentPerMonthXlm,
    estimatedRent1YearXlm: persistent.rentPerYearXlm,
    estimatedRent30DaysUsd: xlmUsdPrice ? Number((persistent.rentPerMonthXlm * xlmUsdPrice).toFixed(6)) : null,
    storageBreakdown: {
      persistent,
      temporary,
      instance,
    },
  };
}

/**
 * Estimates total deployment + ongoing state rent footprint for a smart contract.
 *
 * @param params { wasmByteSize, instanceStateByteSize, persistentEntriesByteSize, initialTtlDays, xlmUsdPrice }
 */
export function estimateContractDeploymentFootprint(params: {
  wasmByteSize: number;
  instanceStateByteSize?: number;
  persistentEntriesByteSize?: number;
  initialTtlDays?: number;
  xlmUsdPrice?: number;
}): ContractDeploymentFootprintEstimate {
  const wasmSize = Math.max(0, params.wasmByteSize || 0);
  const instanceSize = Math.max(0, params.instanceStateByteSize || 0);
  const persistentSize = Math.max(0, params.persistentEntriesByteSize || 0);
  const ttlDays = Math.max(1, params.initialTtlDays || 30);
  const ttlLedgers = ttlDays * LEDGERS_PER_DAY;
  const totalStorageBytes = wasmSize + instanceSize + persistentSize;

  // WASM bytecode is stored in contract code entry
  const wasmCost = calculateStorageCost({
    byteSize: wasmSize,
    entryCount: 1,
    storageType: 'persistent',
    ledgerCount: ttlLedgers,
    xlmUsdPrice: params.xlmUsdPrice,
  });

  const instanceCost = calculateStorageCost({
    byteSize: instanceSize,
    entryCount: 1,
    storageType: 'instance',
    ledgerCount: ttlLedgers,
    xlmUsdPrice: params.xlmUsdPrice,
  });

  const persistentCost = calculateStorageCost({
    byteSize: persistentSize,
    entryCount: persistentSize > 0 ? 1 : 0,
    storageType: 'persistent',
    ledgerCount: ttlLedgers,
    xlmUsdPrice: params.xlmUsdPrice,
  });

  const upfrontCostXlm = wasmCost.totalCostXlm + instanceCost.totalCostXlm + persistentCost.totalCostXlm;
  const upfrontCostUsd = params.xlmUsdPrice ? Number((upfrontCostXlm * params.xlmUsdPrice).toFixed(6)) : null;

  const annualRentXlm = wasmCost.rentPerYearXlm + instanceCost.rentPerYearXlm + persistentCost.rentPerYearXlm;
  const annualRentUsd = params.xlmUsdPrice ? Number((annualRentXlm * params.xlmUsdPrice).toFixed(6)) : null;

  return {
    wasmByteSize: wasmSize,
    instanceStateByteSize: instanceSize,
    persistentEntriesByteSize: persistentSize,
    totalStorageBytes,
    initialRentTtlLedgers: ttlLedgers,
    upfrontCostXlm,
    upfrontCostUsd,
    annualRentXlm,
    annualRentUsd,
  };
}
