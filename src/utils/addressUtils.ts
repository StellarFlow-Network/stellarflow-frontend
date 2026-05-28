/**
 * Address Utility Functions
 * Provides pre-processing and caching for wallet/contract address shortenings
 * to eliminate runtime string slicing from render loops
 */

/**
 * Shortens a full address to a readable format: "FIRST4...LAST4"
 * Pre-computed once during data ingestion to avoid render-time processing
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 8) return address;
  const start = address.slice(0, 4);
  const end = address.slice(-4);
  return `${start}...${end}`;
}

/**
 * Batch processes an array of items with address fields
 * Adds a pre-computed `shortenedAddress` field to each item
 */
export function withShortenedAddresses<T extends { address: string }>(
  items: T[]
): Array<T & { shortenedAddress: string }> {
  return items.map((item) => ({
    ...item,
    shortenedAddress: shortenAddress(item.address),
  }));
}

/**
 * Batch processes items with a custom address field name
 */
export function withShortenedAddressField<T, K extends keyof T>(
  items: T[],
  addressField: K
): Array<T & { shortenedAddress: string }> {
  return items.map((item) => ({
    ...item,
    shortenedAddress: shortenAddress(String(item[addressField])),
  }));
}

/**
 * Returns true if a string looks like a shortened address
 */
export function isShortened(address: string): boolean {
  return address.includes('...') && address.length < 12;
}
