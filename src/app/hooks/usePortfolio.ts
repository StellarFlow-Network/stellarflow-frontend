import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCacheProfile } from "../lib/cacheProfiles";
import type {
  PortfolioHistoryPoint,
  PortfolioSummaryData,
  PortfolioTimeframe,
} from "@/types/portfolio";

function buildHistory(
  days: number,
  startValue: number,
  endValue: number,
): PortfolioHistoryPoint[] {
  const points: PortfolioHistoryPoint[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i -= Math.max(1, Math.floor(days / 24))) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const progress = 1 - i / days;
    // Deterministic gentle wobble so the line isn't perfectly straight.
    const wobble = Math.sin(progress * Math.PI * 3) * (startValue * 0.015);
    const netWorthUsd = startValue + (endValue - startValue) * progress + wobble;

    points.push({
      date: date.toISOString().split("T")[0],
      netWorthUsd: Math.round(netWorthUsd * 100) / 100,
    });
  }

  return points;
}

function getMockData(): PortfolioSummaryData {
  const walletUsd = 8420.31;
  const liquidityPoolsUsd = 5210.87;
  const vaultsUsd = 3105.5;
  const totalNetWorthUsd = walletUsd + liquidityPoolsUsd + vaultsUsd;

  return {
    totalNetWorthUsd,
    changePercent24h: 2.37,
    balances: { walletUsd, liquidityPoolsUsd, vaultsUsd },
    allocation: [
      { symbol: "XLM", assetClass: "native", valueUsd: 5680.4 },
      { symbol: "USDC", assetClass: "native", valueUsd: 2739.91 },
      { symbol: "XLM-USDC-LP", assetClass: "lp", valueUsd: 3420.6 },
      { symbol: "NGN-XLM-LP", assetClass: "lp", valueUsd: 1790.27 },
      { symbol: "Blue Chip Vault", assetClass: "vault", valueUsd: 1950.0 },
      { symbol: "Stable Yield Vault", assetClass: "vault", valueUsd: 1155.5 },
    ],
    history: {
      "7D": buildHistory(7, totalNetWorthUsd * 0.94, totalNetWorthUsd),
      "30D": buildHistory(30, totalNetWorthUsd * 0.82, totalNetWorthUsd),
      "90D": buildHistory(90, totalNetWorthUsd * 0.61, totalNetWorthUsd),
      "1Y": buildHistory(365, totalNetWorthUsd * 0.35, totalNetWorthUsd),
    },
  };
}

const QUERY_KEY = ["portfolio-summary"] as const;

export function usePortfolio(): UseQueryResult<PortfolioSummaryData, Error> {
  const profile = getCacheProfile("portfolioSummary");

  return useQuery<PortfolioSummaryData, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/portfolio", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch portfolio summary: ${res.status}`);
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

export function usePortfolioWithFallback(): {
  data: PortfolioSummaryData;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
} {
  const query = usePortfolio();

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

export type { PortfolioTimeframe };
