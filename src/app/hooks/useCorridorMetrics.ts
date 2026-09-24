import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCacheProfile } from "../lib/cacheProfiles";

export interface CorridorMetrics {
  pair: string;
  source: string;
  rate: number;
  spread: number;
  volume24h: number;
  latencyMs: number;
  status: "optimal" | "degraded" | "critical";
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface CorridorData {
  metrics: CorridorMetrics[];
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

function getMockData(): CorridorData {
  return {
    metrics: [
      {
        pair: "USD / NGN",
        source: "Binance / Local B2C",
        rate: 1485.5,
        spread: 0.12,
        volume24h: 4250000,
        latencyMs: 45,
        status: "optimal",
      },
      {
        pair: "XLM / KES",
        source: "Stellar DEX / Luno",
        rate: 16.4,
        spread: 0.25,
        volume24h: 1850000,
        latencyMs: 120,
        status: "optimal",
      },
      {
        pair: "NGN / GHS",
        source: "Cross-Corridor Implied",
        rate: 0.092,
        spread: 0.68,
        volume24h: 920000,
        latencyMs: 240,
        status: "degraded",
      },
    ],
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
  };
}

const QUERY_KEY = ["corridor-metrics"] as const;

export function useCorridorMetrics(): UseQueryResult<CorridorData, Error> {
  const profile = getCacheProfile("corridorMetrics");

  return useQuery<CorridorData, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/corridor-metrics", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch corridor metrics: ${res.status}`);
      }

      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: profile.staleTime,
    gcTime: profile.gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useCorridorMetricsWithFallback(): {
  data: CorridorData;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
} {
  const query = useCorridorMetrics();

  if (query.data) {
    return {
      data: query.data,
      isLoading: false,
      isFetching: query.isFetching,
      error: query.error,
    };
  }

  return {
    data: getMockData(),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
