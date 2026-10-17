import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MultiWalletActivityStream,
  truncateAddress,
  formatDateTime,
  TypeBadge,
  StatusBadge,
} from "@/components/transactions/MultiWalletActivityStream";
import type {
  ActivityTransactionType,
  ActivityTransactionStatus,
  ConnectedAccountDescriptor,
  PaginatedActivityResponse,
  StreamTransaction,
} from "@/types/activityStream";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers & Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const TEST_ACCOUNTS: ConnectedAccountDescriptor[] = [
  {
    publicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFL4U",
    label: "Main Account",
  },
  {
    publicKey: "GCAV4G63V7D73J7KDEV5WTR9DUWV4PY4DTQEVFL5NBV5BRH4AMMFL5V",
    label: "Trading Account",
  },
];

function createMockTransaction(
  overrides: Partial<StreamTransaction> = {}
): StreamTransaction {
  const timestamp = overrides.timestamp || Date.now();
  return {
    id: `tx-${Math.random().toString(36).substring(2, 9)}`,
    txHash: "a4f89b000001c7d6e5f43210987654321fedcba09876543210abcdef1234567890",
    walletAddress: TEST_ACCOUNTS[0].publicKey,
    walletLabel: TEST_ACCOUNTS[0].label,
    timestamp,
    date: new Date(timestamp).toISOString(),
    type: "swap",
    status: "completed",
    primaryAmount: 100,
    primaryAsset: "USDC",
    secondaryAmount: 825,
    secondaryAsset: "XLM",
    fee: 0.00001,
    feeAsset: "XLM",
    memo: "Test Memo",
    ...overrides,
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement, client = createTestQueryClient()) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock IntersectionObserver
// ─────────────────────────────────────────────────────────────────────────────

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;
  static activeInstances: MockIntersectionObserver[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.activeInstances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn(() => {
    MockIntersectionObserver.activeInstances =
      MockIntersectionObserver.activeInstances.filter((inst) => inst !== this);
  });
  takeRecords = vi.fn(() => []);

  triggerIntersect(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: document.createElement("div"),
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
      ],
      this
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("MultiWalletActivityStream Component (Issue #1205)", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    MockIntersectionObserver.activeInstances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("labels generated transactions as demo data", async () => {
    renderWithClient(<MultiWalletActivityStream accounts={TEST_ACCOUNTS} />);

    expect(await screen.findByTestId("activity-demo-data-badge")).toHaveTextContent("Demo data");
    expect(screen.getByText(/sample activity across demo accounts/i)).toBeInTheDocument();
  });

  it("polls a supplied data source at its configured interval", async () => {
    vi.useFakeTimers();
    const customFetcher = vi.fn(async () => ({
      transactions: [],
      nextPage: null,
      hasMore: false,
    }));

    renderWithClient(
      <MultiWalletActivityStream
        accounts={TEST_ACCOUNTS}
        fetchPage={customFetcher}
        refreshIntervalMs={1_000}
      />
    );

    await vi.waitFor(() => expect(customFetcher).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(customFetcher).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });

  // ── 1. Unit Tests for Isolated Helpers & Badges ─────────────────────────

  describe("Utility helpers & Badges", () => {
    it("truncates Stellar public keys correctly", () => {
      const fullKey = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFL4U";
      expect(truncateAddress(fullKey)).toBe("GBBD4…FL4U");
      expect(truncateAddress("SHORT")).toBe("SHORT");
      expect(truncateAddress("")).toBe("");
    });

    it("formats dates and timestamps consistently", () => {
      const iso = "2026-10-17T04:22:00Z";
      const formatted = formatDateTime(iso);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe("string");
    });

    it("renders all 5 transaction type badges with proper labels and accessible testids", () => {
      const types: ActivityTransactionType[] = [
        "swap",
        "deposit",
        "borrow",
        "remittance",
        "bridge",
      ];

      for (const t of types) {
        const { unmount } = render(<TypeBadge type={t} />);
        const badge = screen.getByTestId(`badge-type-${t}`);
        expect(badge).toBeInTheDocument();
        expect(badge.textContent?.toLowerCase()).toContain(t);
        unmount();
      }
    });

    it("renders all 3 status badges correctly", () => {
      const statuses: ActivityTransactionStatus[] = [
        "completed",
        "pending",
        "failed",
      ];

      for (const s of statuses) {
        const { unmount } = render(<StatusBadge status={s} />);
        const badge = screen.getByTestId(`badge-status-${s}`);
        expect(badge).toBeInTheDocument();
        expect(badge.textContent?.toLowerCase()).toContain(s);
        unmount();
      }
    });
  });

  // ── 2. Multi-Wallet Chronological Aggregation ──────────────────────────

  describe("Multi-Wallet Aggregation & Chronological Ordering", () => {
    it("aggregates transactions across multiple accounts and sorts chronologically descending", async () => {
      const now = Date.now();
      const mockTxs: StreamTransaction[] = [
        createMockTransaction({
          id: "tx-older",
          walletAddress: TEST_ACCOUNTS[0].publicKey,
          walletLabel: "Main Account",
          timestamp: now - 50000,
          type: "swap",
        }),
        createMockTransaction({
          id: "tx-newest",
          walletAddress: TEST_ACCOUNTS[1].publicKey,
          walletLabel: "Trading Account",
          timestamp: now,
          type: "deposit",
        }),
        createMockTransaction({
          id: "tx-middle",
          walletAddress: TEST_ACCOUNTS[0].publicKey,
          walletLabel: "Main Account",
          timestamp: now - 25000,
          type: "borrow",
        }),
      ];

      const customFetcher = vi.fn(async () => ({
        transactions: mockTxs,
        nextPage: null,
        hasMore: false,
        totalCount: 3,
      }));

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      // Wait for feed to finish loading
      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-newest")).toBeInTheDocument();
      });

      const rows = screen.getAllByTestId(/^activity-row-/);
      expect(rows).toHaveLength(3);

      // Verify strict descending order: newest -> middle -> older
      expect(rows[0]).toHaveAttribute("data-testid", "activity-row-tx-newest");
      expect(rows[1]).toHaveAttribute("data-testid", "activity-row-tx-middle");
      expect(rows[2]).toHaveAttribute("data-testid", "activity-row-tx-older");

      // Verify wallet labels and type badges are present
      expect(within(rows[0]).getByText("Trading Account")).toBeInTheDocument();
      expect(within(rows[0]).getByTestId("badge-type-deposit")).toBeInTheDocument();
      expect(within(rows[1]).getByText("Main Account")).toBeInTheDocument();
      expect(within(rows[1]).getByTestId("badge-type-borrow")).toBeInTheDocument();
    });

    it("displays wallet badge with truncated address and copy functionality", async () => {
      const user = userEvent.setup();
      const mockTx = createMockTransaction({
        id: "tx-copy-test",
        walletAddress: TEST_ACCOUNTS[0].publicKey,
      });

      const customFetcher = vi.fn(async () => ({
        transactions: [mockTx],
        nextPage: null,
        hasMore: false,
        totalCount: 1,
      }));

      // Mock clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-copy-test")).toBeInTheDocument();
      });

      const copyBtn = screen.getByTitle("Copy wallet address");
      await user.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith(TEST_ACCOUNTS[0].publicKey);
    });
  });

  // ── 3. Infinite Scrolling Pagination ───────────────────────────────────

  describe("Infinite Scrolling Pagination using @tanstack/react-query", () => {
    it("loads subsequent pages smoothly via the manual button and appends transactions", async () => {
      const user = userEvent.setup();
      const now = Date.now();

      const page1: StreamTransaction[] = [
        createMockTransaction({ id: "p1-tx1", timestamp: now }),
        createMockTransaction({ id: "p1-tx2", timestamp: now - 1000 }),
      ];

      const page2: StreamTransaction[] = [
        createMockTransaction({ id: "p2-tx1", timestamp: now - 2000 }),
        createMockTransaction({ id: "p2-tx2", timestamp: now - 3000 }),
      ];

      const customFetcher = vi.fn(async (page: number) => {
        if (page === 1) {
          return {
            transactions: page1,
            nextPage: 2,
            hasMore: true,
            totalCount: 4,
          };
        }
        return {
          transactions: page2,
          nextPage: null,
          hasMore: false,
          totalCount: 4,
        };
      });

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
          pageSize={2}
        />
      );

      // Verify page 1 items are displayed
      await waitFor(() => {
        expect(screen.getByTestId("activity-row-p1-tx1")).toBeInTheDocument();
        expect(screen.getByTestId("activity-row-p1-tx2")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("activity-row-p2-tx1")).not.toBeInTheDocument();

      // Trigger next page using the Load More button
      const loadMoreBtn = screen.getByTestId("manual-load-more-btn");
      expect(loadMoreBtn).toBeInTheDocument();
      await user.click(loadMoreBtn);

      // Verify page 2 items are appended smoothly
      await waitFor(() => {
        expect(screen.getByTestId("activity-row-p2-tx1")).toBeInTheDocument();
        expect(screen.getByTestId("activity-row-p2-tx2")).toBeInTheDocument();
      });

      // Total of 4 items present in stream
      expect(screen.getAllByTestId(/^activity-row-/)).toHaveLength(4);

      // End of stream indicator is rendered
      expect(screen.getByTestId("activity-end-of-stream")).toBeInTheDocument();
      expect(screen.queryByTestId("manual-load-more-btn")).not.toBeInTheDocument();
    });

    it("triggers fetchNextPage when sentinel intersects via IntersectionObserver", async () => {
      const now = Date.now();
      const page1: StreamTransaction[] = [
        createMockTransaction({ id: "obs-p1", timestamp: now }),
      ];
      const page2: StreamTransaction[] = [
        createMockTransaction({ id: "obs-p2", timestamp: now - 1000 }),
      ];

      const customFetcher = vi.fn(async (page: number) => {
        if (page === 1) {
          return {
            transactions: page1,
            nextPage: 2,
            hasMore: true,
          };
        }
        return {
          transactions: page2,
          nextPage: null,
          hasMore: false,
        };
      });

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-obs-p1")).toBeInTheDocument();
      });

      // Trigger intersection
      expect(MockIntersectionObserver.activeInstances.length).toBeGreaterThan(0);
      const observerInstance = MockIntersectionObserver.activeInstances[0];
      observerInstance.triggerIntersect(true);

      // Verify page 2 is fetched and rendered
      await waitFor(() => {
        expect(screen.getByTestId("activity-row-obs-p2")).toBeInTheDocument();
      });
    });
  });

  // ── 4. Interactive Filters (Category & Account) ─────────────────────────

  describe("Interactive Filtering & Search", () => {
    it("filters transactions by type badge category", async () => {
      const user = userEvent.setup();
      const now = Date.now();

      const mixedTxs: StreamTransaction[] = [
        createMockTransaction({ id: "tx-swap", type: "swap", timestamp: now }),
        createMockTransaction({ id: "tx-remittance", type: "remittance", timestamp: now - 100 }),
        createMockTransaction({ id: "tx-bridge", type: "bridge", timestamp: now - 200 }),
      ];

      const customFetcher = vi.fn(
        async (_page: number, _size: number, _accs: string[], typeFilter: string) => {
          const filtered =
            typeFilter === "all"
              ? mixedTxs
              : mixedTxs.filter((tx) => tx.type === typeFilter);
          return {
            transactions: filtered,
            nextPage: null,
            hasMore: false,
          };
        }
      );

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-swap")).toBeInTheDocument();
      });

      expect(screen.getByTestId("activity-row-tx-remittance")).toBeInTheDocument();
      expect(screen.getByTestId("activity-row-tx-bridge")).toBeInTheDocument();

      // Click "Remittances" filter pill
      const remittanceFilter = screen.getByTestId("filter-type-remittance");
      await user.click(remittanceFilter);

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-remittance")).toBeInTheDocument();
        expect(screen.queryByTestId("activity-row-tx-swap")).not.toBeInTheDocument();
        expect(screen.queryByTestId("activity-row-tx-bridge")).not.toBeInTheDocument();
      });
    });

    it("filters transactions by wallet account selector dropdown", async () => {
      const user = userEvent.setup();
      const now = Date.now();

      const mixedTxs: StreamTransaction[] = [
        createMockTransaction({
          id: "tx-acc1",
          walletAddress: TEST_ACCOUNTS[0].publicKey,
          timestamp: now,
        }),
        createMockTransaction({
          id: "tx-acc2",
          walletAddress: TEST_ACCOUNTS[1].publicKey,
          timestamp: now - 100,
        }),
      ];

      const customFetcher = vi.fn(
        async (_p: number, _s: number, _accs: string[], _tf: string, accountFilter: string) => {
          const filtered =
            accountFilter === "all"
              ? mixedTxs
              : mixedTxs.filter((tx) => tx.walletAddress === accountFilter);
          return {
            transactions: filtered,
            nextPage: null,
            hasMore: false,
          };
        }
      );

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-acc1")).toBeInTheDocument();
        expect(screen.getByTestId("activity-row-tx-acc2")).toBeInTheDocument();
      });

      // Select second account
      const select = screen.getByTestId("account-filter-select");
      await user.selectOptions(select, TEST_ACCOUNTS[1].publicKey);

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-acc2")).toBeInTheDocument();
        expect(screen.queryByTestId("activity-row-tx-acc1")).not.toBeInTheDocument();
      });
    });

    it("supports client-side search across memo, asset and counterparty", async () => {
      const user = userEvent.setup();
      const now = Date.now();

      const mockTxs: StreamTransaction[] = [
        createMockTransaction({
          id: "tx-ngn",
          primaryAsset: "USD",
          secondaryAsset: "NGN",
          memo: "Family Support",
          timestamp: now,
        }),
        createMockTransaction({
          id: "tx-eth",
          primaryAsset: "ETH",
          secondaryAsset: "wETH",
          memo: "Allbridge bridge",
          timestamp: now - 100,
        }),
      ];

      const customFetcher = vi.fn(async () => ({
        transactions: mockTxs,
        nextPage: null,
        hasMore: false,
      }));

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-ngn")).toBeInTheDocument();
        expect(screen.getByTestId("activity-row-tx-eth")).toBeInTheDocument();
      });

      // Search for "Family Support"
      const searchInput = screen.getByTestId("activity-search-input");
      await user.type(searchInput, "Family");

      expect(screen.getByTestId("activity-row-tx-ngn")).toBeInTheDocument();
      expect(screen.queryByTestId("activity-row-tx-eth")).not.toBeInTheDocument();
    });
  });

  // ── 5. Empty & Error States ────────────────────────────────────────────

  describe("Empty and Error States", () => {
    it("renders empty state and allows resetting filters", async () => {
      const user = userEvent.setup();
      const customFetcher = vi.fn(async () => ({
        transactions: [],
        nextPage: null,
        hasMore: false,
        totalCount: 0,
      }));

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
          initialTypeFilter="swap"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-empty-state")).toBeInTheDocument();
      });

      const resetBtn = screen.getByTestId("reset-filters-btn");
      await user.click(resetBtn);

      // Verify filter resets to "all"
      const allFilterTab = screen.getByTestId("filter-type-all");
      expect(allFilterTab).toHaveAttribute("aria-selected", "true");
    });

    it("renders error state when fetchPage rejects and offers retry button", async () => {
      const user = userEvent.setup();
      let shouldFail = true;

      const customFetcher = vi.fn(async () => {
        if (shouldFail) {
          throw new Error("RPC Network Timeout");
        }
        return {
          transactions: [createMockTransaction({ id: "tx-recovered" })],
          nextPage: null,
          hasMore: false,
        };
      });

      renderWithClient(
        <MultiWalletActivityStream
          accounts={TEST_ACCOUNTS}
          fetchPage={customFetcher}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("activity-error-state")).toBeInTheDocument();
      });

      expect(screen.getByText("RPC Network Timeout")).toBeInTheDocument();

      // Resolve error on retry
      shouldFail = false;
      const retryBtn = screen.getByRole("button", { name: /retry/i });
      await user.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByTestId("activity-row-tx-recovered")).toBeInTheDocument();
      });
    });
  });
});
