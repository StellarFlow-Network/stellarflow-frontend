export const SEP38_PAIRS = ["USDC/NGN", "XLM/EUR", "BRL/USDC"] as const;

export type Sep38Pair = (typeof SEP38_PAIRS)[number];

export interface Sep38RatePoint {
  timestamp: string;
  /** Firm rate quoted by the anchor, in buy-asset units per sell-asset unit. */
  anchorRate: number;
  /** Mid-market reference rate using the same quote orientation. */
  midMarketRate: number;
}

export interface Sep38RateHistory {
  pair: Sep38Pair;
  points: Sep38RatePoint[];
  source: "indexer" | "demo";
}