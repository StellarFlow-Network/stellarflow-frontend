/**
 * Data Transformation Hooks
 * Pre-processes data payloads with cached address shortenings
 * Eliminates render-time string slicing inside table loops.
 */

import {
  shortenAddress,
  withShortenedAddresses,
  withShortenedAddressField,
} from '@/utils/addressUtils';
import type { Relayer, Contract } from '@/types';

/**
 * Transform relayer data with pre-computed shortened addresses
 */
export function useTransformedRelayers(relayers: Relayer[]): (Relayer & { shortenedAddress: string })[] {
  return withShortenedAddresses(relayers);
}

/**
 * Transform contract data with pre-computed shortened addresses
 */
export function useTransformedContracts(contracts: Contract[]): (Contract & { shortenedAddress: string })[] {
  return withShortenedAddresses(contracts);
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
  return withShortenedAddressField(items, addressFieldName as keyof T);
}
