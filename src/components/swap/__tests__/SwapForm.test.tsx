import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SwapForm, type TokenOption } from "../SwapForm";

// ─── Hoisted mutable state shared with mock factories ────────────────────────

const { mockExecuteSwap, mockRefreshWalletState, mockWalletState, mockIsSwapping } =
  vi.hoisted(() => ({
    mockExecuteSwap: vi.fn(),
    mockRefreshWalletState: vi.fn(),
    mockWalletState: {
      current: null as { publicKey: string; connected: boolean } | null,
    },
    mockIsSwapping: { current: false },
  }));

// ─── Wallet plumbing ─────────────────────────────────────────────────────────

vi.mock("@/app/components/providers/WalletProvider", () => ({
  useWallet: () => ({
    wallet: mockWalletState.current,
    isConnected: Boolean(mockWalletState.current?.connected),
  }),
  useWalletActions: () => ({ refreshWalletState: mockRefreshWalletState }),
}));

vi.mock("@/hooks/useSwapExecution", () => ({
  useSwapExecution: () => ({
    executeSwap: mockExecuteSwap,
    isSwapping: mockIsSwapping.current,
  }),
}));

// ─── Path visualizer stub (tested separately) ────────────────────────────────

vi.mock("@/components/swap/PathVisualizer", () => ({
  PathVisualizer: () => <div data-testid="path-visualizer" />,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOKENS: TokenOption[] = [
  { symbol: "XLM", name: "Stellar", address: "CCKQU5UJZCID5TKN7QFAE7S3AWGTRFJVODJ5N3P2S3VZCTIA3S5HQ" },
  { symbol: "USDC", name: "USD Coin", address: "CCP4HS4LNK2P6SKOOMZH3M2Z6CCP5Q3Q5OQ7YQ6QKO3X6ZQ3YWQVHFFD" },
];

describe("SwapForm", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWalletState.current = null;
    mockIsSwapping.current = false;
    mockRefreshWalletState.mockReset();
    mockExecuteSwap.mockReset();
    mockExecuteSwap.mockResolvedValue(undefined);

    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function balanceResponse(balance: string) {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ balance }),
    };
  }

  function quoteResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          estimatedOutput: "95.25",
          rate: 0.9525,
          priceImpact: 3,
          ...overrides,
        }),
    };
  }

  function mockApi(balance: string, quote = quoteResponse()) {
    mockFetch.mockImplementation((url: string) =>
      url.includes("/api/v1/balances") || url.includes("/api/v1/swap/quote")
        ? url.includes("/api/v1/balances")
          ? Promise.resolve(balanceResponse(balance))
          : Promise.resolve(quote)
        : Promise.reject(new Error(`Unexpected URL: ${url}`)),
    );
  }

  function connectWallet() {
    mockWalletState.current = { publicKey: "GABC123", connected: true };
  }

  function renderForm(tokens = TOKENS, onSwapSuccess?: () => void) {
    return render(<SwapForm tokens={tokens} onSwapSuccess={onSwapSuccess} />);
  }

  it("renders the swap panel with token selects and balances", async () => {
    connectWallet();
    mockApi("100.5");

    renderForm();

    expect(screen.getByText("Swap Assets")).toBeInTheDocument();
    expect(screen.getByText("You Pay")).toBeInTheDocument();
    expect(screen.getByText(/You Receive/)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getByText("Balance: 100.5 XLM")).toBeInTheDocument();
    });
  });

  it("shows an enabled Connect Wallet action when no wallet is connected", async () => {
    mockFetch.mockResolvedValue(balanceResponse("0"));
    renderForm();

    const submit = screen.getByRole("button", { name: /Connect Wallet/i });
    expect(submit).toBeEnabled();
  });

  it("disables the submit button until a valid amount is entered", async () => {
    connectWallet();
    mockApi("100");

    renderForm();

    const submit = screen.getByRole("button", { name: /Enter an Amount/i });
    expect(submit).toBeDisabled();
  });

  it("flags an amount above the wallet balance as insufficient", async () => {
    connectWallet();
    mockApi("100");

    renderForm();

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "150");

    const submit = screen.getByRole("button", {
      name: /Insufficient XLM Balance/i,
    });
    expect(submit).toBeDisabled();
  });

  it("submits a swap with the correct parameters on success", async () => {
    connectWallet();
    mockApi("100");
    const onSwapSuccess = vi.fn();

    renderForm(TOKENS, onSwapSuccess);

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "10");

    const submit = screen.getByRole("button", { name: /Swap Tokens/i });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    await waitFor(() => {
      expect(mockExecuteSwap).toHaveBeenCalledWith({
        fromToken: TOKENS[0].address,
        toToken: TOKENS[1].address,
        amount: "10",
        minOutput: "",
      });
      expect(onSwapSuccess).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const fromInputAfter = screen.getAllByPlaceholderText("0.0")[0] as HTMLInputElement;
      expect(fromInputAfter.value).toBe("");
    });
  });

  it("fetches a quote and displays the estimated output and rate", async () => {
    connectWallet();
    mockApi("100");

    renderForm();

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "10");

    await waitFor(() => {
      expect(screen.getByText("1 XLM ≈ 0.9525 USDC")).toBeInTheDocument();
      expect(screen.getByText("3.00%")).toBeInTheDocument();
    });
  });

  it("queries the quote API with the token addresses and amount", async () => {
    connectWallet();
    mockApi("100");

    renderForm();

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "42");

    await waitFor(() => {
      const quoteCall = mockFetch.mock.calls.find(
        ([url]) => typeof url === "string" && url.includes("/api/v1/swap/quote"),
      );
      expect(quoteCall).toBeTruthy();
      expect(quoteCall![0]).toContain(`from=${TOKENS[0].address}`);
      expect(quoteCall![0]).toContain(`to=${TOKENS[1].address}`);
      expect(quoteCall![0]).toContain("amount=42");
    });
  });

  it("refetches balances when the token selection changes", async () => {
    connectWallet();
    mockApi("5");

    renderForm();

    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], TOKENS[1].address);

    await waitFor(() => {
      const balanceCalls = mockFetch.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("/api/v1/balances"),
      );
      expect(balanceCalls.length).toBeGreaterThan(1);
    });
  });

  it("fills the from amount with the full wallet balance via MAX", async () => {
    connectWallet();
    mockApi("77.5");

    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "MAX" }));

    const fromInput = screen.getAllByPlaceholderText("0.0")[0] as HTMLInputElement;
    expect(fromInput.value).toBe("77.5");
  });

  it("swaps the from/to token selections and keeps the entered amount", async () => {
    connectWallet();
    mockApi("100", quoteResponse({ estimatedOutput: "9.5", rate: 0.95 }));

    renderForm();

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "10");

    await waitFor(() => {
      const receiveInput = screen.getAllByPlaceholderText("0.0")[1] as HTMLInputElement;
      expect(receiveInput.value).toBe("9.5");
    });

    await userEvent.click(screen.getByRole("button", { name: "↓↑" }));

    const selects = screen.getAllByRole("combobox");
    await waitFor(() => {
      expect(selects[0]).toHaveValue(TOKENS[1].address);
      expect(selects[1]).toHaveValue(TOKENS[0].address);
    });
  });

  it("shows an executing state while the swap is in flight", async () => {
    connectWallet();
    mockIsSwapping.current = true;
    mockApi("100");

    renderForm();

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "10");

    const submit = screen.getByRole("button", { name: /Executing Swap\.\.\./i });
    expect(submit).toBeDisabled();
  });

  it("renders the path visualizer for valid amounts", async () => {
    connectWallet();
    mockApi("100");

    renderForm();

    const fromInput = screen.getAllByPlaceholderText("0.0")[0];
    await userEvent.type(fromInput, "10");

    await waitFor(() => {
      expect(screen.getByTestId("path-visualizer")).toBeInTheDocument();
    });
  });
});