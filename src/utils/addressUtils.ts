/**
 * Address Utility Functions
 * Provides isolated pure formatting helpers for wallet/contract address shortenings
 * to eliminate runtime string slicing from render loops.
 */

/**
 * Formats a long public key or wallet address into a readable compact form.
 * This isolated pure converter is intentionally small and deterministic.
 */
export function formatAddress(
  address: string,
  headLength = 4,
  tailLength = 4,
  separator = '...'
): string {
  if (!address || address.length < headLength + tailLength + separator.length) {
    return address;
  }

  return `${address.slice(0, headLength)}${separator}${address.slice(-tailLength)}`;
}

/**
 * Shortens a full address to a readable format: "FIRST4...LAST4"
 */
export function shortenAddress(address: string): string {
  return formatAddress(address, 4, 4, '...');
}

/**
 * Batch processes an array of items with address fields and attaches a
 * pre-computed `shortenedAddress` field to each item.
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
 * Batch processes items with a custom address field name.
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
 * Builds a stable lookup map from item IDs to shortened addresses.
 */
export function buildShortenedAddressMap<T extends Record<string, unknown>, K extends keyof T>(
  items: T[],
  idField: keyof T,
  addressField: K
): Record<string, string> {
  return Object.fromEntries(
    items.map((item) => [
      String(item[idField]),
      shortenAddress(String(item[addressField])),
    ])
  );
}

/**
 * Returns true if a string looks like a shortened address.
 */
export function isShortened(address: string): boolean {
  return address.includes('...') && address.length < 12;
}
