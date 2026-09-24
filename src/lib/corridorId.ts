/** Slugifies a corridor pair label (e.g. "USD / NGN" -> "usd-ngn") for use as a route param. */
export function corridorPairToId(pair: string): string {
  return pair
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
