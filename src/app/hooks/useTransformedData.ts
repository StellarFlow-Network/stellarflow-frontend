/**
 * Data Transformation Hooks
 * Pre-processes data payloads with cached address shortenings
 * Eliminates string slicing from render loops
 */

import { shortenAddress } from '@/utils/addressUtils';
import type { Relayer, Contract } from '@/types';

/**
 * Transform relayer data with pre-computed shortened addresses
 * Apply immediately upon data fetch to avoid render-time processing
 */
export function useTransformedRelayers(relayers: Relayer[]): (Relayer & { shortenedAddress: string })[] {
  return relayers.map((relayer) => ({
    ...relayer,
    shortenedAddress: relayer.shortenedAddress || shortenAddress(relayer.address),
  }));
}

/**
 * Transform contract data with pre-computed shortened addresses
 * Apply immediately upon data fetch to avoid render-time processing
 */
export function useTransformedContracts(contracts: Contract[]): (Contract & { shortenedAddress: string })[] {
  return contracts.map((contract) => ({
    ...contract,
    shortenedAddress: contract.shortenedAddress || shortenAddress(contract.address),
  }));
}

/**
 * Generic transformation for any data with an address field
 */
export function useTransformedAddresses<T extends { address: string; shortenedAddress?: string }>(
  items: T[]
): Array<T & { shortenedAddress: string }> {
  return items.map((item) => ({
    ...item,
    shortenedAddress: item.shortenedAddress || shortenAddress(item.address),
  }));
}

/**
 * Transform for custom address field names (e.g., contractAddress, operatorAddress)
 */
export function useTransformedCustomAddressField<
  T extends Record<K, string>,
  K extends string = 'address'
>(items: T[], addressFieldName: K): Array<T & { shortenedAddress: string }> {
  return items.map((item) => ({
    ...item,
    shortenedAddress: shortenAddress(item[addressFieldName]),
  }));
}
