"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowDownLeft,
  Landmark,
  Send,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Wallet,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import type {
  ActivityTransactionType,
  ActivityTransactionStatus,
  ActivityTypeFilter,
  ConnectedAccountDescriptor,
  MultiWalletActivityStreamProps,
  PaginatedActivityResponse,
  StreamTransaction,
} from "@/types/activityStream";

// ─────────────────────────────────────────────────────────────────────────────
// Default Multi-Wallet Demo Accounts
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DEMO_ACCOUNTS: ConnectedAccountDescriptor[] = [
  {
    publicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFL4U",
    label: "Main Account",
  },
  {
    publicKey: "GCAV4G63V7D73J7KDEV5WTR9DUWV4PY4DTQEVFL5NBV5BRH4AMMFL5V",
    label: "Trading Account",
  },
  {
    publicKey: "GDCE5H74W8E84K8LDEV6XUS0EUWV5QZ5ETQEVFL6NCW6CSI5SAVFL6W",
    label: "Savings Vault",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Type & Status Metadata & Visual Configurations
// ─────────────────────────────────────────────────────────────────────────────

interface TypeBadgeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className: string;
}

const TYPE_CONFIGS: Record<ActivityTransactionType, TypeBadgeConfig> = {
  swap: {
    label: "Swap",
    icon: ArrowLeftRight,
    className:
      "bg-cyan-950/70 text-cyan-400 border-cyan-800/50 shadow-cyan-950/20",
  },
  deposit: {
    label: "Deposit",
    icon: ArrowDownLeft,
    className:
      "bg-emerald-950/70 text-emerald-400 border-emerald-800/50 shadow-emerald-950/20",
  },
  borrow: {
    label: "Borrow",
    icon: Landmark,
    className:
      "bg-amber-950/70 text-amber-400 border-amber-800/50 shadow-amber-950/20",
  },
  remittance: {
    label: "Remittance",
    icon: Send,
    className:
      "bg-indigo-950/70 text-indigo-400 border-indigo-800/50 shadow-indigo-950/20",
  },
  bridge: {
    label: "Bridge",
    icon: Layers,
    className:
      "bg-sky-950/70 text-sky-400 border-sky-800/50 shadow-sky-950/20",
  },
};

interface StatusBadgeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className: string;
}

const STATUS_CONFIGS: Record<ActivityTransactionStatus, StatusBadgeConfig> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
};

const TYPE_FILTERS: Array<{ label: string; value: ActivityTypeFilter }> = [
  { label: "All Activity", value: "all" },
  { label: "Swaps", value: "swap" },
  { label: "Deposits", value: "deposit" },
  { label: "Borrows", value: "borrow" },
  { label: "Remittances", value: "remittance" },
  { label: "Bridges", value: "bridge" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Address Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncates a Stellar public key or transaction hash into GXXXX…YYYY format.
 */
export function truncateAddress(
  address: string,
  prefixLen = 5,
  suffixLen = 4
): string {
  if (!address || address.length <= prefixLen + suffixLen) return address;
  return `${address.slice(0, prefixLen)}…${address.slice(-suffixLen)}`;
}

/**
 * Formats an ISO date or millisecond timestamp into a localized compact date-time string.
 */
export function formatDateTime(isoOrTimestamp: string | number): string {
  const date = new Date(isoOrTimestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Deterministic Multi-Account Mock Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an interleaved chronological stream of transactions across multiple accounts.
 */
export function generateMockTransactionsForAccounts(
  accounts: ConnectedAccountDescriptor[]
): StreamTransaction[] {
  const transactions: StreamTransaction[] = [];
  const baseTime = Date.now() - 1000 * 60 * 60; // 1 hour ago

  const templates: Array<{
    type: ActivityTransactionType;
    status: ActivityTransactionStatus;
    pAmount: number | string;
    pAsset: string;
    sAmount?: number | string;
    sAsset?: string;
    fee: number;
    memo?: string;
    counterparty?: string;
  }> = [
    {
      type: "swap",
      status: "completed",
      pAmount: 500,
      pAsset: "USDC",
      sAmount: 4125.8,
      sAsset: "XLM",
      fee: 0.00001,
      memo: "StellarFlow AMM",
    },
    {
      type: "deposit",
      status: "completed",
      pAmount: 1500,
      pAsset: "XLM",
      sAmount: 145.2,
      sAsset: "XLM-USDC-LP",
      fee: 0.00001,
      memo: "Liquidity Pool v2",
    },
    {
      type: "borrow",
      status: "completed",
      pAmount: 850,
      pAsset: "USDC",
      sAmount: 9000,
      sAsset: "XLM",
      fee: 0.00002,
      memo: "Soroban CDP Vault #12",
    },
    {
      type: "remittance",
      status: "completed",
      pAmount: 250,
      pAsset: "USD",
      sAmount: 375000,
      sAsset: "NGN",
      fee: 1.5,
      memo: "SEP-31 Corridor Payout",
      counterparty: "Flutterwave Anchor",
    },
    {
      type: "bridge",
      status: "completed",
      pAmount: 1.5,
      pAsset: "ETH",
      sAmount: 1.498,
      sAsset: "wETH (Stellar)",
      fee: 0.002,
      memo: "Allbridge Core Relay",
      counterparty: "Ethereum -> Stellar",
    },
    {
      type: "swap",
      status: "pending",
      pAmount: 2400,
      pAsset: "XLM",
      sAmount: 295.4,
      sAsset: "USDC",
      fee: 0.00001,
      memo: "Path Payment",
    },
    {
      type: "deposit",
      status: "completed",
      pAmount: 3000,
      pAsset: "XLM",
      fee: 0.00001,
      memo: "Collateral top-up",
    },
    {
      type: "remittance",
      status: "failed",
      pAmount: 120,
      pAsset: "EUR",
      sAmount: 16800,
      sAsset: "KES",
      fee: 0.8,
      memo: "Safaricom M-Pesa error",
      counterparty: "YellowCard Anchor",
    },
    {
      type: "borrow",
      status: "pending",
      pAmount: 400,
      pAsset: "USDC",
      sAmount: 4200,
      sAsset: "XLM",
      fee: 0.00002,
      memo: "Vault #08 Drawdown",
    },
    {
      type: "bridge",
      status: "completed",
      pAmount: 500,
      pAsset: "USDC (Polygon)",
      sAmount: 500,
      sAsset: "USDC (Stellar)",
      fee: 0.5,
      memo: "Cross-chain Circle CCTP",
      counterparty: "Polygon -> Stellar",
    },
    {
      type: "swap",
      status: "completed",
      pAmount: 1250,
      pAsset: "USDC",
      sAmount: 10320,
      sAsset: "XLM",
      fee: 0.00001,
      memo: "Aggregated DEX Route",
    },
    {
      type: "deposit",
      status: "completed",
      pAmount: 750,
      pAsset: "EURC",
      fee: 0.00001,
      memo: "Yield Farm Stake",
    },
    {
      type: "remittance",
      status: "completed",
      pAmount: 180,
      pAsset: "USD",
      sAmount: 2480,
      sAsset: "GHS",
      fee: 1.2,
      memo: "MoMo Settlement",
      counterparty: "Zeepay Anchor",
    },
    {
      type: "borrow",
      status: "completed",
      pAmount: 1200,
      pAsset: "USDC",
      sAmount: 12500,
      sAsset: "XLM",
      fee: 0.00002,
      memo: "StellarFlow CDP",
    },
    {
      type: "bridge",
      status: "failed",
      pAmount: 0.8,
      pAsset: "SOL",
      sAmount: 0.8,
      sAsset: "wSOL",
      fee: 0.005,
      memo: "Solana Bridge Timeout",
      counterparty: "Solana -> Stellar",
    },
  ];

  // Distribute across accounts with staggered timestamps to create realistic interleaving
  let counter = 1;
  accounts.forEach((account, accIndex) => {
    templates.forEach((template, tIndex) => {
      // Offset time by minutes for strict descending sequence
      const timeOffsetMs = (accIndex * 17 + tIndex * 31 + counter * 5) * 60 * 1000;
      const txTime = baseTime - timeOffsetMs;
      const hashSuffix = `${accIndex}${tIndex}${counter.toString(16)}`.padStart(6, "0");
      const txHash = `a4f89b${hashSuffix}c7d6e5f43210987654321fedcba09876543210abcdef1234567890`;

      transactions.push({
        id: `tx-stream-${accIndex}-${tIndex}-${counter}`,
        txHash,
        walletAddress: account.publicKey,
        walletLabel: account.label,
        timestamp: txTime,
        date: new Date(txTime).toISOString(),
        type: template.type,
        status: template.status,
        primaryAmount: template.pAmount,
        primaryAsset: template.pAsset,
        secondaryAmount: template.sAmount,
        secondaryAsset: template.sAsset,
        fee: template.fee,
        feeAsset: "XLM",
        memo: template.memo,
        counterparty: template.counterparty,
      });
      counter++;
    });
  });

  // Strict descending chronological sort (newest first)
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Default asynchronous paginated fetcher with simulated latency.
 */
export async function defaultFetchActivityPage(
  page: number,
  pageSize: number,
  accounts: ConnectedAccountDescriptor[],
  typeFilter: ActivityTypeFilter,
  accountFilter: string
): Promise<PaginatedActivityResponse> {
  const allTxs = generateMockTransactionsForAccounts(accounts);

  // Apply filters
  const filtered = allTxs.filter((tx) => {
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    const matchesAccount =
      accountFilter === "all" || tx.walletAddress === accountFilter;
    return matchesType && matchesAccount;
  });

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedSlice = filtered.slice(startIndex, endIndex);
  const hasMore = endIndex < filtered.length;

  return {
    transactions: paginatedSlice,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
    totalCount: filtered.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents: Badges, Item Row, & Skeletons
// ─────────────────────────────────────────────────────────────────────────────

export const TypeBadge = React.memo(function TypeBadge({
  type,
}: {
  type: ActivityTransactionType;
}) {
  const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.swap;
  const IconComponent = config.icon;

  return (
    <span
      data-testid={`badge-type-${type}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-colors ${config.className}`}
    >
      <IconComponent size={13} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
});

export const StatusBadge = React.memo(function StatusBadge({
  status,
}: {
  status: ActivityTransactionStatus;
}) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.completed;
  const IconComponent = config.icon;

  return (
    <span
      data-testid={`badge-status-${status}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${config.className}`}
    >
      <IconComponent size={12} aria-hidden="true" />
      <span className="capitalize">{config.label}</span>
    </span>
  );
});

export const StreamSkeletonRow = React.memo(function StreamSkeletonRow() {
  return (
    <div
      data-testid="activity-skeleton-row"
      className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/40 animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="w-9 h-9 rounded-full bg-neutral-800" />
        <div className="space-y-2 flex-1">
          <div className="w-28 h-4 bg-neutral-800 rounded-sm" />
          <div className="w-40 h-3 bg-neutral-800/60 rounded-sm" />
        </div>
      </div>
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        <div className="space-y-1.5 text-right">
          <div className="w-24 h-4 bg-neutral-800 rounded-sm ml-auto" />
          <div className="w-16 h-3 bg-neutral-800/60 rounded-sm ml-auto" />
        </div>
        <div className="w-20 h-6 bg-neutral-800 rounded-md" />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Stream Row
// ─────────────────────────────────────────────────────────────────────────────

interface TransactionRowProps {
  tx: StreamTransaction;
  onCopyText: (text: string, id: string) => void;
  copiedId: string | null;
}

const TransactionRow = React.memo(function TransactionRow({
  tx,
  onCopyText,
  copiedId,
}: TransactionRowProps) {
  const isCopied = copiedId === tx.id;

  return (
    <article
      data-testid={`activity-row-${tx.id}`}
      className="group relative p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/60 hover:bg-neutral-900 hover:border-neutral-700/80 transition-all duration-200"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Type badge, Account origin, and timestamp */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="mt-0.5 sm:mt-0">
            <TypeBadge type={tx.type} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-neutral-100">
                {tx.walletLabel || "Connected Wallet"}
              </span>

              {/* Wallet address pill with copy action */}
              <button
                type="button"
                onClick={() => onCopyText(tx.walletAddress, tx.id)}
                title="Copy wallet address"
                aria-label={`Copy wallet address ${tx.walletAddress}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs text-neutral-400 bg-neutral-800/70 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
              >
                <Wallet size={11} className="text-neutral-500" aria-hidden="true" />
                <span>{truncateAddress(tx.walletAddress)}</span>
                {isCopied ? (
                  <Check size={11} className="text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy size={11} className="text-neutral-500 group-hover:text-neutral-400" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
              <time dateTime={tx.date}>{formatDateTime(tx.timestamp)}</time>
              {tx.memo && (
                <>
                  <span className="text-neutral-600" aria-hidden="true">•</span>
                  <span className="truncate max-w-[160px] sm:max-w-[220px]" title={tx.memo}>
                    {tx.memo}
                  </span>
                </>
              )}
              {tx.counterparty && (
                <>
                  <span className="text-neutral-600" aria-hidden="true">•</span>
                  <span className="text-neutral-400 italic truncate max-w-[180px]">
                    {tx.counterparty}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amounts, Status badge & explorer link */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-1 sm:pl-0 border-t sm:border-t-0 border-neutral-800/60 pt-3 sm:pt-0">
          <div className="text-left sm:text-right">
            <div className="text-sm font-semibold text-neutral-100 flex items-center gap-1 sm:justify-end">
              <span>
                {tx.primaryAmount} {tx.primaryAsset}
              </span>
              {tx.secondaryAmount && (
                <span className="text-neutral-400 font-normal">
                  → {tx.secondaryAmount} {tx.secondaryAsset}
                </span>
              )}
            </div>

            {tx.fee !== undefined && (
              <div className="text-xs text-neutral-500 mt-0.5">
                Fee: {tx.fee} {tx.feeAsset || "XLM"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={tx.status} />

            <a
              href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View transaction ${tx.txHash} on StellarExpert`}
              title="View on StellarExpert"
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: MultiWalletActivityStream
// ─────────────────────────────────────────────────────────────────────────────

export function MultiWalletActivityStream({
  accounts = DEFAULT_DEMO_ACCOUNTS,
  pageSize = 10,
  refreshIntervalMs = 30_000,
  initialTypeFilter = "all",
  initialAccountFilter = "all",
  fetchPage,
  className = "",
}: MultiWalletActivityStreamProps) {
  // Normalize accounts prop to standard ConnectedAccountDescriptor format
  const normalizedAccounts = useMemo<ConnectedAccountDescriptor[]>(() => {
    if (!accounts || accounts.length === 0) return DEFAULT_DEMO_ACCOUNTS;
    return accounts.map((acc, index) => {
      if (typeof acc === "string") {
        return {
          publicKey: acc,
          label: `Account ${index + 1}`,
        };
      }
      return {
        publicKey: acc.publicKey,
        label: acc.label || `Account ${index + 1}`,
      };
    });
  }, [accounts]);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>(initialTypeFilter);
  const [accountFilter, setAccountFilter] = useState<string>(initialAccountFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Observer sentinel reference for infinite scrolling
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Stable query key based on normalized accounts and active filters
  const accountKeys = useMemo(
    () => normalizedAccounts.map((a) => a.publicKey).sort().join(","),
    [normalizedAccounts]
  );

  const queryKey = useMemo(
    () => [
      "multiWalletActivityStream",
      {
        accountKeys,
        typeFilter,
        accountFilter,
        pageSize,
      },
    ],
    [accountKeys, typeFilter, accountFilter, pageSize]
  );

  // React Query useInfiniteQuery with TanStack Query v5 signature
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<
    PaginatedActivityResponse,
    Error,
    InfiniteData<PaginatedActivityResponse>,
    typeof queryKey,
    number
  >({
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (fetchPage) {
        return fetchPage(
          pageParam,
          pageSize,
          normalizedAccounts.map((a) => a.publicKey),
          typeFilter,
          accountFilter
        );
      }
      return defaultFetchActivityPage(
        pageParam,
        pageSize,
        normalizedAccounts,
        typeFilter,
        accountFilter
      );
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? (lastPage.nextPage ?? undefined) : undefined;
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Poll only caller-provided data sources. The built-in source is static demo data.
    refetchInterval: fetchPage && refreshIntervalMs > 0 ? refreshIntervalMs : false,
  });

  // Infinite scroll intersection observer attachment
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [first] = entries;
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: "150px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten and deduplicate transactions across all paginated pages (O(P * N))
  const allTransactions = useMemo<StreamTransaction[]>(() => {
    if (!data?.pages) return [];

    const seenIds = new Set<string>();
    const list: StreamTransaction[] = [];

    for (const page of data.pages) {
      for (const tx of page.transactions) {
        if (!seenIds.has(tx.id)) {
          seenIds.add(tx.id);
          list.push(tx);
        }
      }
    }

    // Preserve chronological descending sort
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [data?.pages]);

  // Optional client-side search query over asset, memo, counterparty, or hash
  const visibleTransactions = useMemo<StreamTransaction[]>(() => {
    if (!searchQuery.trim()) return allTransactions;
    const q = searchQuery.toLowerCase().trim();

    return allTransactions.filter(
      (tx) =>
        tx.primaryAsset.toLowerCase().includes(q) ||
        tx.secondaryAsset?.toLowerCase().includes(q) ||
        tx.memo?.toLowerCase().includes(q) ||
        tx.counterparty?.toLowerCase().includes(q) ||
        tx.txHash.toLowerCase().includes(q) ||
        tx.walletAddress.toLowerCase().includes(q)
    );
  }, [allTransactions, searchQuery]);

  // Copy-to-clipboard handler with automatic feedback dismiss
  const handleCopyText = useCallback((text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 2000);
  }, []);

  const totalLoaded = visibleTransactions.length;

  return (
    <section
      data-testid="multi-wallet-activity-stream"
      aria-label="Multi-Wallet Activity Stream"
      className={`rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 sm:p-6 backdrop-blur-md ${className}`}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-100">
              Multi-Wallet Activity Stream
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
              {normalizedAccounts.length} {normalizedAccounts.length === 1 ? "Wallet" : "Wallets"}
            </span>
            {!fetchPage && (
              <span
                data-testid="activity-demo-data-badge"
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/30"
              >
                Demo data
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-neutral-400">
            {fetchPage
              ? "Chronological activity from your connected Stellar accounts."
              : "Sample activity across demo accounts. Connect a transaction data source to show wallet history."}
          </p>
        </div>

        {/* Quick controls: Refresh & Account selector */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Account Filter Dropdown */}
          <div className="relative inline-block text-left">
            <label htmlFor="account-filter-select" className="sr-only">
              Filter by Wallet Account
            </label>
            <select
              id="account-filter-select"
              data-testid="account-filter-select"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="appearance-none bg-neutral-900 border border-neutral-700/80 hover:border-neutral-600 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-neutral-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="all">All Accounts ({normalizedAccounts.length})</option>
              {normalizedAccounts.map((acc) => (
                <option key={acc.publicKey} value={acc.publicKey}>
                  {acc.label} ({truncateAddress(acc.publicKey)})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
              <Filter size={12} aria-hidden="true" />
            </div>
          </div>

          {/* Refetch button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh activity stream"
            aria-label="Refresh activity feed"
            className="p-1.5 rounded-lg border border-neutral-700/80 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={isFetching ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* ── Type Filter Pills & Search Bar ───────────────────────────────── */}
      <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/60">
        {/* Category Pills */}
        <div
          role="tablist"
          aria-label="Transaction Type Filters"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
        >
          {TYPE_FILTERS.map((item) => {
            const isActive = typeFilter === item.value;
            return (
              <button
                key={item.value}
                role="tab"
                aria-selected={isActive}
                data-testid={`filter-type-${item.value}`}
                onClick={() => setTypeFilter(item.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Client-side Search / Filter */}
        <div className="relative min-w-[180px] sm:w-48">
          <input
            type="text"
            data-testid="activity-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memo, asset..."
            aria-label="Search transactions"
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* ── Feed Container ───────────────────────────────────────────────── */}
      <div className="mt-4 space-y-3" role="feed" aria-busy={isLoading || isFetchingNextPage}>
        {/* Loading Skeleton during initial load */}
        {isLoading && (
          <div className="space-y-3" data-testid="activity-loading-skeletons">
            {Array.from({ length: 4 }).map((_, idx) => (
              <StreamSkeletonRow key={idx} />
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            data-testid="activity-error-state"
            className="p-6 rounded-xl border border-rose-900/40 bg-rose-950/20 text-center"
          >
            <AlertCircle size={28} className="mx-auto text-rose-400 mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-rose-300">
              Failed to load transaction stream
            </p>
            <p className="text-xs text-rose-400/80 mt-1">
              {error.message || "An unexpected network error occurred."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && visibleTransactions.length === 0 && (
          <div
            data-testid="activity-empty-state"
            className="p-8 text-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/20"
          >
            <Layers size={32} className="mx-auto text-neutral-600 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-neutral-300">
              No transactions found
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              {searchQuery || typeFilter !== "all" || accountFilter !== "all"
                ? "No activity matches your active filters. Try resetting the category or account filter."
                : "No recent transactions found across the connected wallet accounts."}
            </p>
            {(searchQuery || typeFilter !== "all" || accountFilter !== "all") && (
              <button
                type="button"
                data-testid="reset-filters-btn"
                onClick={() => {
                  setTypeFilter("all");
                  setAccountFilter("all");
                  setSearchQuery("");
                }}
                className="mt-3.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Render Transaction Stream Rows */}
        {!isLoading && !error && visibleTransactions.length > 0 && (
          <>
            {visibleTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onCopyText={handleCopyText}
                copiedId={copiedId}
              />
            ))}
          </>
        )}

        {/* ── Infinite Scroll Observer Sentinel & Loaders ───────────────── */}
        <div
          ref={sentinelRef}
          data-testid="activity-stream-sentinel"
          className="h-4 w-full pointer-events-none"
          aria-hidden="true"
        />

        {/* Subsequent Page Fetching Spinner */}
        {isFetchingNextPage && (
          <div
            data-testid="activity-fetching-next-page"
            className="p-3 text-center flex items-center justify-center gap-2 text-xs text-cyan-400"
          >
            <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
            <span>Loading older transactions...</span>
          </div>
        )}

        {/* Manual Load More Button for Accessibility / Keyboard users */}
        {hasNextPage && !isFetchingNextPage && !isLoading && (
          <div className="pt-2 text-center">
            <button
              type="button"
              data-testid="manual-load-more-btn"
              onClick={() => fetchNextPage()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 hover:bg-neutral-800 transition-colors"
            >
              Load Older Transactions
            </button>
          </div>
        )}

        {/* End of Stream Notice */}
        {!hasNextPage && !isLoading && totalLoaded > 0 && (
          <div
            data-testid="activity-end-of-stream"
            className="pt-4 text-center text-xs text-neutral-500 border-t border-neutral-900"
          >
            All recent transactions loaded ({totalLoaded} total)
          </div>
        )}
      </div>
    </section>
  );
}

export default MultiWalletActivityStream;
