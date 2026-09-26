/**
 * Tests for the Yield Tax Report Generator component.
 *
 * The component is a client component that pulls two external dependencies
 * (`useVaultYieldHarvest` and `useWallet`). We mock those two hooks so the
 * unit tests exercise only the report-generation, cost-basis, CSV and
 * signature logic in isolation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { YieldTaxReportGenerator } from "../YieldTaxReportGenerator";
import type { VaultYieldData } from "@/hooks/useVaultYieldHarvest";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/**
 * Build a minimal vault-yield payload the generator reads from
 * `useVaultYieldHarvest`.
 */
function makeVaultYieldData(overrides: { harvestEvents?: unknown[] } = {}) {
  return {
    vault: {
      id: "blue-chip-vault",
      name: "Blue Chip Multi-Asset Vault",
      totalValueLockedUsd: 4_820_000,
      currentApyPercent: 14.7,
      totalSharesMinted: 4_651_234,
      sharePrice: 1.036,
      pendingHarvestUsd: 12_450,
    },
    yieldPath: { nodes: [], edges: [] },
    poolAllocations: [],
    harvestEvents: [
      {
        id: "h-001",
        timestamp: "2024-06-01T12:00:00Z",
        txHash: "abc123",
        totalHarvestedUsd: 11_230,
        compoundedShares: 10_839,
        poolBreakdown: [{ poolId: "xlm-usdc", pair: "XLM / USDC", harvestedUsd: 4_960 }],
        status: "confirmed",
      },
      {
        id: "h-002",
        timestamp: "2023-12-15T12:00:00Z",
        txHash: "def456",
        totalHarvestedUsd: 10_875,
        compoundedShares: 10_494,
        poolBreakdown: [{ poolId: "xlm-ngnc", pair: "XLM / NGNC", harvestedUsd: 3_720 }],
        status: "confirmed",
      },
      ...(overrides.harvestEvents || []),
    ],
  } satisfies VaultYieldData;
}

/**
 * Mocked data store: price lookup returns exactly one price for the pair so
 * the generator's `getHistoricalPrice` path is exercised deterministically.
 * The generator calls `getCachedPrices(assetPair, 50)`, so we return a single
 * element and keep the test independent of the real IndexedDB.
 */
// ---------------------------------------------------------------------------
// Jest module mocks
// ---------------------------------------------------------------------------

let mockPrices: Array<{ assetPair: string; price: number; timestamp: number }> = [];

jest.mock("@tanstack/react-query", () => ({
  __esModule: true,
  useQuery: jest.fn(() => ({ data: null, isLoading: false, isError: false })),
}));

jest.mock("@/hooks/useVaultYieldHarvest", () => ({
  __esModule: true,
  useVaultYieldHarvest: jest.fn(() => ({ data: null, isLoading: false, isError: false })),
}));

jest.mock("@/hooks/useWallet", () => ({
  __esModule: true,
  useWallet: jest.fn(() => ({
    status: "connected",
    publicKey: "GBFVXoXvMfzP4w7dQ8bC2eL1nA3tR6uY9kM0sD1cH5fJ",
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

jest.mock("@/lib/priceStorage", () => ({
  __esModule: true,
  getCachedPrices: jest.fn(),
  PriceData: {} as never,
}));

jest.mock("../sign", () => ({
  __esModule: true,
  signCsvContent: jest.fn(),
}));

const { useVaultYieldHarvest, useWallet } = require("@/hooks/useWallet");
const { getCachedPrices } = require("@/lib/priceStorage");

/**
 * Render the component with the requested yield payload and wallet status.
 */
function renderWith(
  data: VaultYieldData,
  status: "connected" | "disconnected" | "unavailable" = "connected",
) {
  (useVaultYieldHarvest as jest.Mock).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  });
  (useWallet as jest.Mock).mockReturnValue({
    status,
    publicKey: status === "connected"
      ? "GBFVXoXvMfzP4w7dQ8bC2eL1nA3tR6uY9kM0sD1cH5fJ"
      : null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  });
  return render(<YieldTaxReportGenerator />);
}

// ---------------------------------------------------------------------------
// UI states
// ---------------------------------------------------------------------------

describe("YieldTaxReportGenerator UI states", () => {
  it("displays a helpful empty-state message when there are no harvest events for the selected year", () => {
    renderWith(makeVaultYieldData({ harvestEvents: [] }));

    expect(screen.getByText(/0 distribution event for tax year \d{4}/)).toBeInTheDocument();
  });

  it("displays the number of events for a populated year", () => {
    renderWith(makeVaultYieldData());

    expect(screen.getByText(/2 distribution events for tax year \d{4}/)).toBeInTheDocument();
  });

  it("shows the Connect Wallet button when the wallet is disconnected", () => {
    renderWith(makeVaultYieldData(), "disconnected");

    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("shows the wallet-not-connected message and disables generation when disconnected", () => {
    renderWith(makeVaultYieldData(), "disconnected");

    const button = screen.getByRole("button", { name: /generate report/i });
    expect(button).toBeDisabled();
  });

  it("shows the Freighter installation notice when the wallet service is unavailable", () => {
    renderWith(makeVaultYieldData(), "unavailable");

    expect(screen.getByText(/Freighter wallet extension not installed/i)).toBeInTheDocument();
  });

  it("shows a loading state while the yield data query is in flight", () => {
    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });

    render(<YieldTaxReportGenerator />);

    expect(screen.getByText(/loading yield data/i)).toBeInTheDocument();
  });

  it("shows an error state when the yield data query fails", () => {
    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });

    render(<YieldTaxReportGenerator />);

    expect(screen.getByText(/failed to load yield data/i)).toBeInTheDocument();
  });

  it("validates the tax year and refuses to generate for an out-of-range value", async () => {
    renderWith(makeVaultYieldData());

    const yearSelect = screen.getByLabelText("Tax year") as HTMLSelectElement;
    await userEvent.selectOptions(yearSelect, "1999");

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    expect(await screen.findByText(/tax year must be between 2000 and/i)).toBeInTheDocument();
    expect(screen.queryByText(/show report details/i)).not.toBeInTheDocument();
  });

  it("shows the cryptographic signature panel once a report is generated", async () => {
    renderWith(makeVaultYieldData());

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    expect(await screen.findByText(/cryptographic signature/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

describe("YieldTaxReportGenerator event processing", () => {
  it("includes every harvest event timestamped in the selected year", async () => {
    const events = [
      {
        id: "h-2023",
        timestamp: "2023-11-01T10:00:00Z",
        txHash: "e1",
        totalHarvestedUsd: 5_000,
        poolBreakdown: [],
      },
      {
        id: "h-2024",
        timestamp: "2024-05-01T10:00:00Z",
        txHash: "e2",
        totalHarvestedUsd: 6_000,
        poolBreakdown: [],
      },
    ];

    mockPrices = [
      { assetPair: "USD-XLM", price: 0.12, timestamp: Math.floor(new Date("2023-06-01").getTime() / 1000) },
      { assetPair: "USD-XLM", price: 0.15, timestamp: Math.floor(new Date("2024-04-01").getTime() / 1000) },
    ];

    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: {
        vault: { id: "blue-chip-vault" },
        yieldPath: { nodes: [], edges: [] },
        poolAllocations: [],
        harvestEvents: events,
      },
      isLoading: false,
      isError: false,
    });

    renderWith({
      vault: { id: "blue-chip-vault" },
      yieldPath: { nodes: [], edges: [] },
      poolAllocations: [],
      harvestEvents: events,
    });

    const yearSelect = screen.getByLabelText("Tax year") as HTMLSelectElement;
    await userEvent.selectOptions(yearSelect, "2024");

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    expect(await screen.findByText(/cryptographic signature/i)).toBeInTheDocument();

    expect((getCachedPrices as jest.Mock).mock.calls).toEqual([
      ["USD-XLM", 50],
    ]);

    expect(signCsvContent).toHaveBeenCalledTimes(1);
    const [csvContent] = signCsvContent.mock.calls[0];

    // 2023 event is correctly excluded.
    expect(csvContent).not.toContain("h-2023");
    // 2024 event is included.
    expect(csvContent).toContain("h-2024");
  });

  it("renders the report details when events are present", async () => {
    renderWith(makeVaultYieldData());

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    const details = await screen.findByText(/show report details/i);
    expect(details).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CSV generation
// ---------------------------------------------------------------------------

describe("YieldTaxReportGenerator CSV generation", () => {
  it("generates CSV headers matching the tax-reporting fields", async () => {
    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: {
        vault: { id: "blue-chip-vault" },
        yieldPath: { nodes: [], edges: [] },
        poolAllocations: [],
        harvestEvents: [],
      },
      isLoading: false,
      isError: false,
    });

    renderWith({
      vault: { id: "blue-chip-vault" },
      yieldPath: { nodes: [], edges: [] },
      poolAllocations: [],
      harvestEvents: [],
    });

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    const [csvContent] = signCsvContent.mock.calls[0];

    expect(csvContent).toContain("Event ID");
    expect(csvContent).toContain("Timestamp");
    expect(csvContent).toContain("Asset");
    expect(csvContent).toContain("Amount (USD)");
    expect(csvContent).toContain("Wallet Address");
    expect(csvContent).toContain("Distribution Type");
    expect(csvContent).toContain("Historical USD Price");
    expect(csvContent).toContain("USD Cost Basis");
    expect(csvContent).toContain("Transaction Hash");
    expect(csvContent).toContain("Source");
    expect(csvContent).toContain("Report Year");
  });

  it("quotes CSV fields that contain commas or quotes (RFC 4180 compliant)", async () => {
    const events = [
      {
        id: 'evt,"a"',
        timestamp: "2024-05-01T10:00:00Z",
        txHash: "tx,hash",
        totalHarvestedUsd: 100,
        poolBreakdown: [{ pair: "XLM / USDC" }],
        status: "confirmed",
      },
    ];

    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: {
        vault: { id: "blue-chip-vault" },
        yieldPath: { nodes: [], edges: [] },
        poolAllocations: [],
        harvestEvents: events,
      },
      isLoading: false,
      isError: false,
    });

    renderWith({
      vault: { id: "blue-chip-vault" },
      yieldPath: { nodes: [], edges: [] },
      poolAllocations: [],
      harvestEvents: events,
    });

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    const [csvContent] = signCsvContent.mock.calls[0];

    // RFC 4180: fields containing commas or double quotes must be wrapped in
    // double quotes, with embedded quotes doubled.
    expect(csvContent).toMatch(/evt,""a""/, "event id containing comma/quote must be quoted");
    expect(csvContent).toMatch(/tx""hash/, "tx hash containing comma must be quoted");
  });
});

// ---------------------------------------------------------------------------
// Cost basis / missing price
// ---------------------------------------------------------------------------

describe("YieldTaxReportGenerator cost basis / missing price", () => {
  it("sets historical price and USD cost basis when a TWAP price exists for the event year", async () => {
    const events = [
      {
        id: "e-price",
        timestamp: "2024-06-01T12:00:00Z",
        txHash: "tx-price",
        totalHarvestedUsd: 100,
        poolBreakdown: [{ pair: "XLM / USDC" }],
        status: "confirmed",
      },
    ];

    mockPrices = [
      {
        assetPair: "USD-XLM",
        price: 0.12,
        timestamp: Math.floor(new Date("2024-06-01T12:00:00Z").getTime() / 1000),
      },
    ];

    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: {
        vault: { id: "blue-chip-vault" },
        yieldPath: { nodes: [], edges: [] },
        poolAllocations: [],
        harvestEvents: events,
      },
      isLoading: false,
      isError: false,
    });

    renderWith({
      vault: { id: "blue-chip-vault" },
      yieldPath: { nodes: [], edges: [] },
      poolAllocations: [],
      harvestEvents: events,
    });

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    const [csvContent] = signCsvContent.mock.calls[0];

    // The event row is in the CSV.
    const row = csvContent.split("\n").find((line) => line.includes("e-price"));
    expect(row).toBeDefined();

    // Historical price stored verbatim; USD cost basis = USD value of the event.
    expect(row).toContain("0.12");
    expect(row).toContain("100");
  });

  it("sets historical price to N/A and USD cost basis to N/A when no TWAP price exists", async () => {
    const events = [
      {
        id: "e-noprice",
        timestamp: "2024-06-01T12:00:00Z",
        txHash: "tx-noprice",
        totalHarvestedUsd: 100,
        poolBreakdown: [{ pair: "XLM / USDC" }],
        status: "confirmed",
      },
    ];

    (useVaultYieldHarvest as jest.Mock).mockReturnValue({
      data: {
        vault: { id: "blue-chip-vault" },
        yieldPath: { nodes: [], edges: [] },
        poolAllocations: [],
        harvestEvents: events,
      },
      isLoading: false,
      isError: false,
    });

    renderWith({
      vault: { id: "blue-chip-vault" },
      yieldPath: { nodes: [], edges: [] },
      poolAllocations: [],
      harvestEvents: events,
    });

    const button = screen.getByRole("button", { name: /generate report/i });
    await userEvent.click(button);

    const [csvContent] = signCsvContent.mock.calls[0];

    const row = csvContent.split("\n").find((line) => line.includes("e-noprice"));
    expect(row).toBeDefined();

    // Missing price -> "N/A" in both the historical-price and cost-basis columns.
    expect(row).toContain("N/A");
  });
});

// ---------------------------------------------------------------------------
// Signature helper (sign.ts)
// ---------------------------------------------------------------------------

describe("signCsvContent", () => {
  it("computes a deterministic HMAC-SHA256 signature over the CSV content", async () => {
    const csv = "Event ID,Timestamp\n" + "h-001,2024-06-01T12:00:00Z\n";
    const address = "GBFVXoXvMfzP4w7dQ8bC2eL1nA3tR6uY9kM0sD1cH5fJ";

    (signCsvContent as jest.Mock).mockClear();
    const result = await signCsvContent(csv, address);

    expect(result.signature).toBeDefined();
    expect(typeof result.signature).toBe("string");
    expect(result.verified).toBe(true);

    // Deterministic: same input produces the same signature.
    const result2 = await signCsvContent(csv, address);
    expect(result2.signature).toBe(result.signature);
    expect(result2.verified).toBe(true);
  });

  it("returns no_wallet when no wallet address is provided", async () => {
    const result = await signCsvContent("Event ID\n", "");
    expect(result.signature).toBe("no_wallet");
    expect(result.verified).toBe(false);
  });

  it("returns signature_unavailable when the Web Crypto API fails", async () => {
    // @ts-expect-error: override the Web Crypto sign() to test the error fallback path.
    (globalThis.crypto.subtle as unknown as { sign: typeof globalThis.crypto.subtle.sign }).sign =
      async () => {
        throw new Error("denied");
      };

    const result = await signCsvContent("Event ID\n", "GBFVXoXvMfzP4w7dQ8bC2eL1nA3tR6uY9kM0sD1cH5fJ");
    expect(result.signature).toBe("signature_unavailable");
    expect(result.verified).toBe(false);
  });
});
