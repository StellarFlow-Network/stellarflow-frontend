/**
 * Soroban Storage Footprint Service
 * 
 * Provides integration between Soroban RPC simulation endpoints,
 * real-time/cached price feeds (XLM/USD), and storage footprint cost calculations.
 */

import { getLatestPrice } from '@/lib/priceStorage';
import { AssetSymbol } from '@/config/assetSymbols';
import {
  parseSimulationFootprint,
  calculateStorageCost,
  compareStorageTradeoffs,
  estimateContractDeploymentFootprint,
  SimulationFootprintSummary,
  StorageCostBreakdown,
  StorageTradeoffItem,
  ContractDeploymentFootprintEstimate,
  StorageTier,
} from '@/lib/storageCostCalculator';

// Fallback XLM price in USD if offline or uninitialized
const DEFAULT_XLM_USD_PRICE = 0.125;

/**
 * Retrieves the most recent XLM price in USD from local indexedDb/cache or fallback.
 */
export async function getXlmUsdRate(): Promise<number> {
  try {
    const cached = await getLatestPrice('USD-XLM' as AssetSymbol);
    if (cached && typeof cached.price === 'number' && cached.price > 0) {
      return 1 / cached.price; // USD-XLM price inverted gives XLM in USD
    }
    const altCached = await getLatestPrice('XLM-USD' as unknown as AssetSymbol);
    if (altCached && typeof altCached.price === 'number' && altCached.price > 0) {
      return altCached.price;
    }
  } catch (err) {
    console.warn('[StorageFootprintService] Failed to load cached XLM rate, using fallback:', err);
  }
  return DEFAULT_XLM_USD_PRICE;
}

/**
 * Analyzes a raw simulation response object or JSON string.
 */
export async function analyzeSimulationPayload(
  payload: string | object,
  customXlmPrice?: number,
): Promise<SimulationFootprintSummary> {
  let parsedObj: object;
  if (typeof payload === 'string') {
    try {
      parsedObj = JSON.parse(payload);
    } catch {
      throw new Error('Invalid simulation JSON payload. Please verify JSON format.');
    }
  } else {
    parsedObj = payload;
  }

  const xlmPrice = customXlmPrice ?? (await getXlmUsdRate());
  return parseSimulationFootprint(parsedObj, xlmPrice);
}

/**
 * Computes custom state rent and footprint preview with active XLM-USD rate.
 */
export async function calculateCustomStoragePreview(params: {
  byteSize: number;
  entryCount?: number;
  storageType: StorageTier;
  ledgerCount: number;
  customXlmPrice?: number;
}): Promise<StorageCostBreakdown> {
  const xlmPrice = params.customXlmPrice ?? (await getXlmUsdRate());
  return calculateStorageCost({
    ...params,
    xlmUsdPrice: xlmPrice,
  });
}

/**
 * Computes storage tradeoffs analysis with active XLM-USD rate.
 */
export async function getStorageTradeoffsAnalysis(params: {
  byteSize: number;
  entryCount?: number;
  ledgerCount?: number;
  customXlmPrice?: number;
}): Promise<StorageTradeoffItem[]> {
  const xlmPrice = params.customXlmPrice ?? (await getXlmUsdRate());
  return compareStorageTradeoffs({
    ...params,
    xlmUsdPrice: xlmPrice,
  });
}

/**
 * Estimates contract deployment footprint costs.
 */
export async function getContractDeploymentEstimate(params: {
  wasmByteSize: number;
  instanceStateByteSize?: number;
  persistentEntriesByteSize?: number;
  initialTtlDays?: number;
  customXlmPrice?: number;
}): Promise<ContractDeploymentFootprintEstimate> {
  const xlmPrice = params.customXlmPrice ?? (await getXlmUsdRate());
  return estimateContractDeploymentFootprint({
    ...params,
    xlmUsdPrice: xlmPrice,
  });
}
