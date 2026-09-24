import { unstable_cache } from "next/cache";
import { REVALIDATE_INTERVALS } from "@/config/cacheConfig";
import type { CorridorMetrics, OrderBookEntry } from "@/app/hooks/useCorridorMetrics";
import { corridorPairToId } from "@/lib/corridorId";

export { corridorPairToId };

export interface CorridorDetail extends CorridorMetrics {
  id: string;
  description: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

function getMockCorridors(): CorridorDetail[] {
  return [
    {
      id: corridorPairToId("USD / NGN"),
      pair: "USD / NGN",
      source: "Binance / Local B2C",
      description:
        "Primary fiat on/off-ramp corridor bridging USD liquidity into the Nigerian Naira retail market.",
      rate: 1485.5,
      spread: 0.12,
      volume24h: 4_250_000,
      latencyMs: 45,
      status: "optimal",
      bids: [
        { price: 1485.1, amount: 2500, total: 2500 },
        { price: 1484.8, amount: 4800, total: 7300 },
        { price: 1484.2, amount: 12500, total: 19800 },
      ],
      asks: [
        { price: 1485.9, amount: 3100, total: 3100 },
        { price: 1486.3, amount: 6200, total: 9300 },
        { price: 1487.0, amount: 15000, total: 24300 },
      ],
    },
    {
      id: corridorPairToId("XLM / KES"),
      pair: "XLM / KES",
      source: "Stellar DEX / Luno",
      description:
        "Stellar-native XLM corridor settling directly against Kenyan Shilling liquidity providers.",
      rate: 16.4,
      spread: 0.25,
      volume24h: 1_850_000,
      latencyMs: 120,
      status: "optimal",
      bids: [
        { price: 16.35, amount: 5200, total: 5200 },
        { price: 16.3, amount: 8100, total: 13300 },
      ],
      asks: [
        { price: 16.45, amount: 4700, total: 4700 },
        { price: 16.5, amount: 9200, total: 13900 },
      ],
    },
    {
      id: corridorPairToId("NGN / GHS"),
      pair: "NGN / GHS",
      source: "Cross-Corridor Implied",
      description:
        "Implied cross-rate derived from the NGN and GHS legs against a shared reserve asset.",
      rate: 0.092,
      spread: 0.68,
      volume24h: 920_000,
      latencyMs: 240,
      status: "degraded",
      bids: [{ price: 0.0915, amount: 12000, total: 12000 }],
      asks: [{ price: 0.0925, amount: 9800, total: 9800 }],
    },
  ];
}

/**
 * Cached corridor detail lookup for the `/corridors/[id]` Server Component.
 * Shares the same revalidation cadence as the corridor monitor dashboard so
 * the detail page and list stay consistent within a single refresh window.
 */
const getCachedCorridors = unstable_cache(
  async () => getMockCorridors(),
  ["corridor-details"],
  { revalidate: REVALIDATE_INTERVALS.MEDIUM_INTERVAL, tags: ["corridors"] },
);

export async function listCorridorIds(): Promise<string[]> {
  const corridors = await getCachedCorridors();
  return corridors.map((corridor) => corridor.id);
}

export async function getCorridorById(id: string): Promise<CorridorDetail | null> {
  const corridors = await getCachedCorridors();
  return corridors.find((corridor) => corridor.id === id) ?? null;
}
