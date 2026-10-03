/** Slugifies a corridor pair label (e.g. "USD / NGN" -> "usd-ngn") for use as a route param. */
export function corridorPairToId(pair: string): string {
  return pair
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Splits a corridor pair label (e.g. "USD / NGN") into its two asset codes. */
export function parseCorridorPairCodes(pair: string): [string, string] | null {
  const segments = pair
    .split(" / ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  return [segments[0], segments[1]];
}
