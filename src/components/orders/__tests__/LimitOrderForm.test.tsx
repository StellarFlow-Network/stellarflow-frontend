import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LimitOrderForm } from "../LimitOrderForm";
import type { ActiveLimitOrder } from "@/lib/limitOrderOps";

// ─── Mock WalletProvider ──────────────────────────────────────────────────────

let mockWalletConnected = false;
let mockPublicKey: string | null = null;

jest.mock("@/app/components/providers/WalletProvider", () => ({
  useWallet: () => ({
    wallet: mockWalletConnected
      ? {
          publicKey: mockPublicKey,
          connected: true,
          source: "extension" as const,
          lastCheckedAt: Date.now(),
        }
      : null,
  }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ─── Mock useSocket ───────────────────────────────────────────────────────────

let mockSpotPrice: number | null = 0.12;

jest.mock("@/app/hooks/useSocket", () => ({
  useSocket: (
    _options?: unknown,
    selector?: (state: unknown) => unknown,
  ) => {
    const state = {
      isConnected: true,
      lastUpdate: mockSpotPrice !== null
        ? { id: "1", assetPair: "USD-XLM" as const, price: mockSpotPrice, decimals: 6, source: "ws", timestamp: Date.now(), confidenceScore: 1 }
        : null,
      error: null,
      reconnectAttempts: 0,
      subscribeToAsset: jest.fn(),
      unsubscribeFromAsset: jest.fn(),
      disconnect: jest.fn(),
      reconnect: jest.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// ─── Mock limit-order operations ──────────────────────────────────────────────

const mockSubmitLimitOrder = jest.fn();
const mockCancelLimitOrder = jest.fn();
const mockFetchActiveOrders = jest.fn();

jest.mock("@/lib/limitOrderOps", () => ({
  submitLimitOrder: (...args: unknown[]) =>
    mockSubmitLimitOrder(...args),
  cancelLimitOrder: (...args: unknown[]) =>
    mockCancelLimitOrder(...args),
  fetchActiveOrders: (...args: unknown[]) =>
    mockFetchActiveOrders(...args),
}));

// ─── Mock Icon component ──────────────────────────────────────────────────────

jest.mock("@/components/icons/Icon", () => ({
  __esModule: true,
  default: ({ id, size, className }: { id: string; size?: number; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} style={{ width: size, height: size }} />
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm() {
  return render(<LimitOrderForm />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LimitOrderForm — form rendering", () => {
  beforeEach(() => {
    mockWalletConnected = false;
    mockPublicKey = null;
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue([]);
  });

  it("renders the limit order form with all inputs", () => {
    renderForm();

    expect(screen.getByLabelText("Trading Pair")).toBeInTheDocument();
    expect(screen.getByLabelText("Target Execution Price")).toBeInTheDocument();
    expect(screen.getByLabelText("Total Trade Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Select expiry window")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Place Limit Order/i }),
    ).toBeInTheDocument();
  });

  it("renders the active orders section header", () => {
    renderForm();

    expect(screen.getByText("Active Orders")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh active orders/i }),
    ).toBeInTheDocument();
  });

  it("displays spot price when available", () => {
    mockSpotPrice = 0.12;
    renderForm();

    expect(screen.getByText(/Spot: 0.12/)).toBeInTheDocument();
  });
});

describe("LimitOrderForm — presets", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue([]);
  });

  it("populates target price when +1% preset is clicked", () => {
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 1% above spot",
    });
    fireEvent.click(preset);

    const priceInput = screen.getByLabelText(
      "Target Execution Price",
    ) as HTMLInputElement;
    // 0.12 * 1.01 = 0.121200 → formatted to 0.12 (6 decimals but trailing zeros stripped)
    expect(priceInput.value).toBe("0.1212");
  });

  it("populates target price when +5% preset is clicked", () => {
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 5% above spot",
    });
    fireEvent.click(preset);

    const priceInput = screen.getByLabelText(
      "Target Execution Price",
    ) as HTMLInputElement;
    // 0.12 * 1.05 = 0.126
    expect(priceInput.value).toBe("0.126");
  });

  it("populates target price when +10% preset is clicked", () => {
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 10% above spot",
    });
    fireEvent.click(preset);

    const priceInput = screen.getByLabelText(
      "Target Execution Price",
    ) as HTMLInputElement;
    // 0.12 * 1.10 = 0.132
    expect(priceInput.value).toBe("0.132");
  });

  it("populates target price when -1% preset is clicked", () => {
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 1% below spot",
    });
    fireEvent.click(preset);

    const priceInput = screen.getByLabelText(
      "Target Execution Price",
    ) as HTMLInputElement;
    // 0.12 * 0.99 = 0.1188
    expect(priceInput.value).toBe("0.1188");
  });

  it("populates target price when -5% preset is clicked", () => {
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 5% below spot",
    });
    fireEvent.click(preset);

    const priceInput = screen.getByLabelText(
      "Target Execution Price",
    ) as HTMLInputElement;
    // 0.12 * 0.95 = 0.114
    expect(priceInput.value).toBe("0.114");
  });

  it("populates target price when -10% preset is clicked", () => {
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 10% below spot",
    });
    fireEvent.click(preset);

    const priceInput = screen.getByLabelText(
      "Target Execution Price",
    ) as HTMLInputElement;
    // 0.12 * 0.90 = 0.108
    expect(priceInput.value).toBe("0.108");
  });

  it("disables presets when spot price is unavailable", () => {
    mockSpotPrice = null;
    renderForm();

    const preset = screen.getByRole("button", {
      name: "Set target price 1% above spot",
    });
    expect(preset).toBeDisabled();
  });
});

describe("LimitOrderForm — valid submission", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue([]);
  });

  it("submits the form with valid inputs", async () => {
    mockSubmitLimitOrder.mockResolvedValue({
      txHash: "tx_hash_123",
      orderId: "order_456",
    });

    renderForm();

    const priceInput = screen.getByLabelText("Target Execution Price");
    const amountInput = screen.getByLabelText("Total Trade Amount");

    fireEvent.change(priceInput, { target: { value: "0.15" } });
    fireEvent.blur(priceInput);

    fireEvent.change(amountInput, { target: { value: "100" } });
    fireEvent.blur(amountInput);

    const submitButton = screen.getByRole("button", {
      name: /Place Limit Order/i,
    });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitLimitOrder).toHaveBeenCalledTimes(1);
    });

    // Verify success message is shown
    await waitFor(() => {
      expect(
        screen.getByText(/Order placed successfully/),
      ).toBeInTheDocument();
    });
  });

  it("shows submitting state during submission", async () => {
    mockSubmitLimitOrder.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ txHash: "tx", orderId: "oid" }), 100)),
    );

    renderForm();

    fireEvent.change(screen.getByLabelText("Target Execution Price"), {
      target: { value: "0.15" },
    });
    fireEvent.blur(screen.getByLabelText("Target Execution Price"));

    fireEvent.change(screen.getByLabelText("Total Trade Amount"), {
      target: { value: "100" },
    });
    fireEvent.blur(screen.getByLabelText("Total Trade Amount"));

    fireEvent.click(screen.getByRole("button", { name: /Place Limit Order/i }));

    expect(
      screen.getByRole("button", { name: /Placing Order/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Placing Order/i }),
    ).toBeDisabled();
  });

  it("shows error when submission fails", async () => {
    mockSubmitLimitOrder.mockRejectedValue(new Error("Network error"));

    renderForm();

    fireEvent.change(screen.getByLabelText("Target Execution Price"), {
      target: { value: "0.15" },
    });
    fireEvent.blur(screen.getByLabelText("Target Execution Price"));

    fireEvent.change(screen.getByLabelText("Total Trade Amount"), {
      target: { value: "100" },
    });
    fireEvent.blur(screen.getByLabelText("Total Trade Amount"));

    fireEvent.click(screen.getByRole("button", { name: /Place Limit Order/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});

describe("LimitOrderForm — invalid input", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue([]);
  });

  it("shows validation error for negative price", () => {
    renderForm();

    const priceInput = screen.getByLabelText("Target Execution Price");
    fireEvent.change(priceInput, { target: { value: "-5" } });
    fireEvent.blur(priceInput);

    expect(
      screen.getByText("Enter a valid positive target price."),
    ).toBeInTheDocument();
  });

  it("shows validation error for zero price", () => {
    renderForm();

    const priceInput = screen.getByLabelText("Target Execution Price");
    fireEvent.change(priceInput, { target: { value: "0" } });
    fireEvent.blur(priceInput);

    expect(
      screen.getByText("Price must be greater than zero."),
    ).toBeInTheDocument();
  });

  it("shows validation error for negative amount", () => {
    renderForm();

    const amountInput = screen.getByLabelText("Total Trade Amount");
    fireEvent.change(amountInput, { target: { value: "-100" } });
    fireEvent.blur(amountInput);

    expect(
      screen.getByText("Enter a valid positive trade amount."),
    ).toBeInTheDocument();
  });

  it("disables submit button when inputs are empty", () => {
    renderForm();

    const submitButton = screen.getByRole("button", {
      name: /Place Limit Order/i,
    });
    expect(submitButton).toBeDisabled();
  });
});

describe("LimitOrderForm — active orders rendering", () => {
  const mockOrders = [
    {
      id: "order_001",
      sellAsset: "native",
      buyAsset: "USDC",
      pair: "XLM/USDC",
      side: "sell",
      targetPrice: "0.145",
      amount: "500",
      status: "open" as const,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      createdAt: Date.now(),
      contractId: "CABC123",
    },
    {
      id: "order_002",
      sellAsset: "USDC",
      buyAsset: "native",
      pair: "USDC/XLM",
      side: "buy",
      targetPrice: "0.105",
      amount: "200",
      status: "open" as const,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 3600,
      createdAt: Date.now(),
      contractId: "CABC123",
    },
  ];

  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue(mockOrders);
  });

  it("displays active orders in the table", async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText("order_001")).toBeInTheDocument();
    });

    expect(screen.getByText("order_002")).toBeInTheDocument();
    expect(screen.getByText("XLM/USDC")).toBeInTheDocument();
    expect(screen.getByText("USDC/XLM")).toBeInTheDocument();
    expect(screen.getByText("sell")).toBeInTheDocument();
    expect(screen.getByText("buy")).toBeInTheDocument();
  });

  it("shows cancel buttons for open orders", async () => {
    renderForm();

    await waitFor(() => {
      const cancelButtons = screen.getAllByRole("button", {
        name: /Cancel order/i,
      });
      expect(cancelButtons.length).toBe(2);
    });
  });
});

describe("LimitOrderForm — empty state", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue([]);
  });

  it("shows empty state when there are no active orders", async () => {
    renderForm();

    await waitFor(() => {
      expect(
        screen.getByText("No active limit orders"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Place a limit order above to get started."),
    ).toBeInTheDocument();
  });
});

describe("LimitOrderForm — cancel order", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
    mockFetchActiveOrders.mockResolvedValue([
      {
        id: "order_001",
        sellAsset: "native",
        buyAsset: "USDC",
        pair: "XLM/USDC",
        side: "sell",
        targetPrice: "0.145",
        amount: "500",
        status: "open" as const,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        createdAt: Date.now(),
        contractId: "CABC123",
      },
    ]);
  });

  it("calls cancelLimitOrder when cancel is clicked", async () => {
    mockCancelLimitOrder.mockResolvedValue({ txHash: "cancel_tx" });

    renderForm();

    await waitFor(() => {
      expect(screen.getByText("order_001")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", {
      name: /Cancel order/i,
    });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockCancelLimitOrder).toHaveBeenCalledTimes(1);
      expect(mockCancelLimitOrder).toHaveBeenCalledWith({
        contractId: "CABC123",
        orderId: "order_001",
      });
    });
  });

  it("shows loading state on cancel button", async () => {
    mockCancelLimitOrder.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ txHash: "cancel_tx" }), 100),
        ),
    );

    renderForm();

    await waitFor(() => {
      expect(screen.getByText("order_001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancel order/i }));

    expect(
      screen.getByRole("button", { name: /Cancel order order_001/i }),
    ).toBeInTheDocument();
  });

  it("shows error when cancellation fails", async () => {
    mockCancelLimitOrder.mockRejectedValue(new Error("Cancel failed"));

    renderForm();

    await waitFor(() => {
      expect(screen.getByText("order_001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancel order/i }));

    await waitFor(() => {
      expect(screen.getByText("Cancel failed")).toBeInTheDocument();
    });
  });
});

describe("LimitOrderForm — loading state", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
  });

  it("shows loading indicator while fetching orders", () => {
    // Use a promise that never resolves to test loading state.
    // Must be cleaned up so it doesn't leak into other tests.
    let resolvePromise: (value: ActiveLimitOrder[]) => void;
    const pendingPromise = new Promise<ActiveLimitOrder[]>((resolve) => {
      resolvePromise = resolve;
    });
    mockFetchActiveOrders.mockReturnValue(pendingPromise);

    renderForm();

    expect(screen.getByText("Loading active orders…")).toBeInTheDocument();

    // Cleanup: resolve the promise and restore default
    resolvePromise!([]);
    mockFetchActiveOrders.mockResolvedValue([]);
  });
});

describe("LimitOrderForm — error state", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockPublicKey = "GABC123";
    mockSpotPrice = 0.12;
    mockSubmitLimitOrder.mockReset();
    mockCancelLimitOrder.mockReset();
    mockFetchActiveOrders.mockReset();
  });

  it("shows error message when orders fetch fails", async () => {
    mockFetchActiveOrders.mockRejectedValue(new Error("Failed to load"));

    renderForm();

    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });
});
