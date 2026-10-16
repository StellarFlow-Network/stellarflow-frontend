import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCacheProfile } from "../lib/cacheProfiles";
import type { RemittancePayoutRecord } from "@types/remittancePayout";

function getMockData(): RemittancePayoutRecord[] {
  return [
    {
      id: "rem-3001",
      date: "2026-08-19T11:05:47Z",
      transactionHash:
        "c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef123456ab",
      anchorName: "Cowrie Anchor Nigeria",
      anchorReference: "COW-NG-88213",
      senderName: "Fuhad Adesanya",
      recipientName: "Bola Adesanya",
      recipientAddress: "GDQP2PVAFZSSLZ2IKXQREGAQTTXMIMHJZV6G6QQX52S4VD4MT56GD7A5B",
      amountSent: 250,
      sentCurrency: "USD",
      amountReceived: 371875,
      receivedCurrency: "NGN",
      exchangeRate: "1 USD = 1487.50 NGN",
      fee: 2.5,
      feeCurrency: "USD",
      status: "completed",
    },
    {
      id: "rem-3002",
      date: "2026-07-30T20:11:53Z",
      transactionHash:
        "e5f678901234567890abcdef1234567890abcdef12345abc3d4",
      anchorName: "Kotani Pay Kenya",
      anchorReference: "KTN-KE-40217",
      senderName: "Fuhad Adesanya",
      recipientName: "Wanjiru Mwuangi",
      recipientAddress: "GBSDFP4ZSSQLSGAQTT2PVAFZSSXHJZV6G6QQX52S4VD4MT56GD7A5B",
      amountSent: 100,
      sentCurrency: "EUR",
      amountReceived: 13284,
      receivedCurrency: "KES",
      exchangeRate: "1 EUr = 132.84 KES",
      fee: 1.1,
      feeCurrency: "EUR",
      status: "completed",
    },
    {
      id: "rem-3003",
      date: "2026-07-12T08:42:10Z",
      transactionHash:
        "b2c3d4e5f678901234567890abcdef1234567890abcdef12345a",
      anchorName: "Yellow Card Ghana",
      anchorReference: "YC-GH-11940",
      senderName: "Fuhad Adesanya",
      recipientName: "Kwame Boateng",
      recipientAddress: "GBAA112233445566778990AABBCCDEEFFGGHHIIJJKKLLMMNNOOPR",
      amountSent: 75,
      sentCurrency: "USD",
      amountReceived: 1042.5,
      receivedCurrency: "GHS",
      exchangeRate: "1 USD = 13.90 GHS",
      fee: 0.9,
      feeCurrency: "USD",
      status: "failed",
    },
  ];
}

const QUERY_KEY = ["remittance-payouts"] as const;

// Polling interval (ms) to detect webhook-driven status changes
// From the off-ramp partner switching statuses.
const WEBHOOK_POLL_INTERVAL = 5000;

// SEP-24 interactive flow step states for the progress stepper.
export type SEP24StepState =
  | "pending_user_action"
  | "processing_anchor"
  | "tokens_dispatched"
  | "completed"
  | "error";

export interface SEP24Step {
  id: SEP24StepState;
  label: string;
  description: string;
}

export const SEP24_STEPS: SEP24Step[] = [
  {
    id: "pending_user_action",
    label: "Pending User Action",
    description: "Complete the interactive form to continue your transfer.",
  },
  {
    id: "processing_anchor",
    label: "Processing Anchor",
    description: "The anchor is processing your fiat transfer.",
  },
  {
    id: "tokens_dispatched",
    label: "Tokens Dispatched",
    description: "Funds have been dispatched to the destination.",
  },
  {
    id: "completed",
    label: "Completed",
    description: "Your transfer has completed successfully.",
  },
];

// Webhook status transitions mapping to stepper steps
const PAYOUT_STATUS_STEP: Record<string, number> = {
  PENDING: 0,
  PENDING_USER_ACTION: 0,
  INCOMPLETE: 0,
  PROCESSING: 1,
  PROCESSING_ANCHOR: 1,
  DISPATCHED: 2,
  TOKENS_DISPATCHED: 2,
  DELIVERED: 3,
  COMPLETED: 3,
  FAILED: -1,
  REJECTED: -1,
  ERROR: -1,
};

export function getPayoutStep(status: string): number {
  return PAYOUT_STATUS_STEP[status.toUpperCase()] ?? 0;
}

export function getSEP24StepState(status: string): SEP24StepState {
  const step = getPayoutStep(status);
  if (step < 0) return "error";
  return SEP24_STEPs[step]?.id ?? "pending_user_action";
}

export function isSEP24Stalled(
  status: string,
  updatedAt?: string,
  thresholdMs = 30 * 60 * 1000
): boolean {
  const step = getPayoutStep(status);
  if (step < 0 || step >= SEP24_STEPS.length) return false;
  if (!updatedAt) return false;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  return elapsed > thresholdMs;
}

export function useRemittancePayouts(): UseQueryResult<
  RemittancePayoutRecord[],
  Error
> {
  const profile = getCacheProfile("transactionHistory");

  return useQuery<RemittancePayoutRecord[], Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/remittance-payouts", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch remittance payouts: ${res.status}`);
      }

      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: profile.staleTime,
    gcTime: profile.gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
    refetchInterval: WEBHOOK_POLL_INTERVAL,
    refetchIntervalInBackground: false,
  });
}

export function useRemittancePayoutsWithFallback(): {
  data: RemittancePayoutRecord[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  hasPayoutRejections: boolean;
} {
  const query = useRemittancePayouts();

  if (query.data) {
    const hasPayoutRejections = query.data.some(
      (payout) => payout.status === "failed" || payout.status === "rejected"
    );
    return {
      data: query.data,
      isLoading: false,
      isFetching: query.isFetching,
      error: query.error,
      hasPayoutRejections,
    };
  }

  const mockData = getMockData();
  return {
    data: mockData,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    hasPayoutRejections: mockData.some(
      (payout) => payout.status === "failed" || payout.status === "rejected"
    ),
  };
}
