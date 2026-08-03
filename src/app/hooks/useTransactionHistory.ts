import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCacheProfile } from "../lib/cacheProfiles";
import type { TransactionRecord } from "@/types/transactions";

function getMockData(): TransactionRecord[] {
  return [
    {
      id: "tx-1001",
      date: "2026-07-28T09:14:02Z",
      type: "swap",
      sentAmount: 500,
      sentCurrency: "USDC",
      receivedAmount: 4127.5,
      receivedCurrency: "XLM",
      fee: 0.35,
      feeCurrency: "USDC",
      txHash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234",
      status: "completed",
    },
    {
      id: "tx-1002",
      date: "2026-07-25T16:42:11Z",
      type: "liquidity",
      sentAmount: 1200,
      sentCurrency: "XLM",
      receivedAmount: 118.4,
      receivedCurrency: "XLM-USDC-LP",
      fee: 1.2,
      feeCurrency: "XLM",
      txHash: "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345a",
      status: "completed",
    },
    {
      id: "tx-1003",
      date: "2026-07-19T11:05:47Z",
      type: "remittance",
      sentAmount: 250,
      sentCurrency: "USD",
      receivedAmount: 371875,
      receivedCurrency: "NGN",
      fee: 2.5,
      feeCurrency: "USD",
      txHash: "c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345ab",
      status: "completed",
    },
    {
      id: "tx-1004",
      date: "2026-07-10T08:30:19Z",
      type: "swap",
      sentAmount: 3200,
      sentCurrency: "XLM",
      receivedAmount: 387.9,
      receivedCurrency: "USDC",
      fee: 2.1,
      feeCurrency: "XLM",
      txHash: "d4e5f6789012345678901234567890abcdef1234567890abcdef12345abc3",
      status: "completed",
    },
    {
      id: "tx-1005",
      date: "2026-06-30T20:11:53Z",
      type: "remittance",
      sentAmount: 100,
      sentCurrency: "EUR",
      receivedAmount: 132840,
      receivedCurrency: "KES",
      fee: 1.1,
      feeCurrency: "EUR",
      txHash: "e5f6789012345678901234567890abcdef1234567890abcdef12345abc3d4",
      status: "failed",
    },
    {
      id: "tx-1006",
      date: "2026-06-22T13:57:04Z",
      type: "liquidity",
      sentAmount: 640.25,
      sentCurrency: "XLM-USDC-LP",
      receivedAmount: 6300,
      receivedCurrency: "XLM",
      fee: 0.9,
      feeCurrency: "XLM",
      txHash: "f6789012345678901234567890abcdef1234567890abcdef12345abc3d4e5",
      status: "completed",
    },
  ];
}

const QUERY_KEY = ["transaction-history"] as const;

export function useTransactionHistory(): UseQueryResult<TransactionRecord[], Error> {
  const profile = getCacheProfile("transactionHistory");

  return useQuery<TransactionRecord[], Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/transaction-history", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch transaction history: ${res.status}`);
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

export function useTransactionHistoryWithFallback(): {
  data: TransactionRecord[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
} {
  const query = useTransactionHistory();

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
