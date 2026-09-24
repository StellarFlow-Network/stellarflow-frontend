/**
 * Unit tests — #762 Granular Wallet Balance Breakdown by Asset Protocol Lock
 *
 * Coverage:
 *  1. PortfolioSummaryData type shape — breakdownByAsset field is present and
 *     well-formed when populated.
 *  2. Mock-data invariants — totals per-asset equal the sum of their breakdown
 *     fields; grand totals across assets sum correctly.
 *  3. WalletBalanceBreakdown rendering — all four category rows, Manage
 *     buttons, and asset chips render with correct labels and testids.
 *  4. Quick-action callback invocation — clicking each Manage button fires
 *     the correct handler exactly once.
 *
 * The test uses React Testing Library rendered against the plain DOM (jsdom).
 * Run with:
 *   npx jest src/components/analytics/__tests__/walletBalanceBreakdown.test.tsx
 * or after adding a jest/vitest runner to the project.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import WalletBalanceBreakdown from "../WalletBalanceBreakdown";
import type {
  PerAssetBreakdown,
  PortfolioSummaryData,
  ProtocolLockBreakdown,
} from "@/types/portfolio";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SAMPLE_ASSETS: PerAssetBreakdown[] = [
  {
    symbol: "XLM",
    name: "Stellar Lumens",
    totalUsd: 5680.4,
    breakdown: {
      availableUsd: 2100.0,
      limitOrdersUsd: 980.4,
      vaultsUsd: 1250.0,
      liquidityPoolsUsd: 1350.0,
    },
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    totalUsd: 2739.91,
    breakdown: {
      availableUsd: 1020.0,
      limitOrdersUsd: 419.91,
      vaultsUsd: 800.0,
      liquidityPoolsUsd: 500.0,
    },
  },
];

/** Sum all four breakdown fields for one asset — should equal totalUsd. */
function breakdownSum(b: ProtocolLockBreakdown): number {
  return b.availableUsd + b.limitOrdersUsd + b.vaultsUsd + b.liquidityPoolsUsd;
}

// ─── 1. Type-shape tests (compile-time validated, runtime-checked) ──────────

describe("PerAssetBreakdown type shape", () => {
  it("has all required fields on each asset fixture", () => {
    for (const asset of SAMPLE_ASSETS) {
      expect(typeof asset.symbol).toBe("string");
      expect(typeof asset.name).toBe("string");
      expect(typeof asset.totalUsd).toBe("number");
      expect(typeof asset.breakdown).toBe("object");
      expect(typeof asset.breakdown.availableUsd).toBe("number");
      expect(typeof asset.breakdown.limitOrdersUsd).toBe("number");
      expect(typeof asset.breakdown.vaultsUsd).toBe("number");
      expect(typeof asset.breakdown.liquidityPoolsUsd).toBe("number");
    }
  });

  it("breakdownByAsset can be attached to a PortfolioSummaryData shape", () => {
    // Verify that our type is compatible — TypeScript enforces this at build
    // time; this runtime check confirms the duck-typing is correct.
    const partialData: Partial<PortfolioSummaryData> = {
      breakdownByAsset: SAMPLE_ASSETS,
    };
    expect(partialData.breakdownByAsset).toHaveLength(2);
  });
});

// ─── 2. Mock-data invariant tests ───────────────────────────────────────────

describe("Mock-data shape invariants", () => {
  it("each asset: breakdown fields sum to totalUsd (within floating-point tolerance)", () => {
    for (const asset of SAMPLE_ASSETS) {
      const sum = breakdownSum(asset.breakdown);
      expect(sum).toBeCloseTo(asset.totalUsd, 2);
    }
  });

  it("aggregate category totals are non-negative", () => {
    const totals = SAMPLE_ASSETS.reduce(
      (acc, a) => ({
        availableUsd: acc.availableUsd + a.breakdown.availableUsd,
        limitOrdersUsd: acc.limitOrdersUsd + a.breakdown.limitOrdersUsd,
        vaultsUsd: acc.vaultsUsd + a.breakdown.vaultsUsd,
        liquidityPoolsUsd: acc.liquidityPoolsUsd + a.breakdown.liquidityPoolsUsd,
      }),
      {
        availableUsd: 0,
        limitOrdersUsd: 0,
        vaultsUsd: 0,
        liquidityPoolsUsd: 0,
      },
    );

    expect(totals.availableUsd).toBeGreaterThan(0);
    expect(totals.limitOrdersUsd).toBeGreaterThan(0);
    expect(totals.vaultsUsd).toBeGreaterThan(0);
    expect(totals.liquidityPoolsUsd).toBeGreaterThan(0);
  });

  it("no asset has a negative breakdown value", () => {
    for (const asset of SAMPLE_ASSETS) {
      expect(asset.breakdown.availableUsd).toBeGreaterThanOrEqual(0);
      expect(asset.breakdown.limitOrdersUsd).toBeGreaterThanOrEqual(0);
      expect(asset.breakdown.vaultsUsd).toBeGreaterThanOrEqual(0);
      expect(asset.breakdown.liquidityPoolsUsd).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── 3. WalletBalanceBreakdown rendering ────────────────────────────────────

describe("WalletBalanceBreakdown rendering", () => {
  it("renders all four category rows with correct labels", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />);

    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Locked in Limit Orders")).toBeInTheDocument();
    expect(screen.getByText("Staked in Vaults")).toBeInTheDocument();
    expect(screen.getByText("Held in Liquidity Pools")).toBeInTheDocument();
  });

  it("renders four Manage quick-action buttons", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />);

    const manageButtons = screen.getAllByRole("button", { name: /manage/i });
    expect(manageButtons).toHaveLength(4);
  });

  it("renders a Manage button for each specific category", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />);

    expect(
      screen.getByRole("button", { name: /manage available/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage locked in limit orders/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage staked in vaults/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage held in liquidity pools/i }),
    ).toBeInTheDocument();
  });

  it("renders each asset symbol as a chip in the asset footer", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />);

    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("renders testid data-attributes for each row and manage button", () => {
    const { container } = render(
      <WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />,
    );

    const categories = [
      "available",
      "limitOrders",
      "vaults",
      "liquidityPools",
    ] as const;
    for (const cat of categories) {
      expect(
        container.querySelector(`[data-testid="breakdown-row-${cat}"]`),
      ).not.toBeNull();
      expect(
        container.querySelector(`[data-testid="manage-btn-${cat}"]`),
      ).not.toBeNull();
    }
  });

  it("shows section with accessible aria-label", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />);

    const section = screen.getByRole("region", {
      name: /wallet balance breakdown by protocol lock/i,
    });
    expect(section).toBeInTheDocument();
  });

  it("renders with an empty breakdownByAsset without crashing", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={[]} />);

    // Still has four rows
    expect(screen.getByText("Available")).toBeInTheDocument();
    // No asset chips section
    expect(screen.queryByText("XLM")).toBeNull();
  });
});

// ─── 4. Quick-action callback invocation ────────────────────────────────────

describe("WalletBalanceBreakdown quick-action callbacks", () => {
  it("calls onManageAvailable when Available Manage button is clicked", () => {
    const handleAvailable = jest.fn();
    render(
      <WalletBalanceBreakdown
        breakdownByAsset={SAMPLE_ASSETS}
        onManageAvailable={handleAvailable}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manage available/i }));
    expect(handleAvailable).toHaveBeenCalledTimes(1);
  });

  it("calls onManageLimitOrders when Limit Orders Manage button is clicked", () => {
    const handler = jest.fn();
    render(
      <WalletBalanceBreakdown
        breakdownByAsset={SAMPLE_ASSETS}
        onManageLimitOrders={handler}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /manage locked in limit orders/i }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls onManageVaults when Vaults Manage button is clicked", () => {
    const handler = jest.fn();
    render(
      <WalletBalanceBreakdown
        breakdownByAsset={SAMPLE_ASSETS}
        onManageVaults={handler}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /manage staked in vaults/i }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls onManagePools when Liquidity Pools Manage button is clicked", () => {
    const handler = jest.fn();
    render(
      <WalletBalanceBreakdown
        breakdownByAsset={SAMPLE_ASSETS}
        onManagePools={handler}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /manage held in liquidity pools/i }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not throw when no onManage* callbacks are provided", () => {
    render(<WalletBalanceBreakdown breakdownByAsset={SAMPLE_ASSETS} />);

    expect(() => {
      fireEvent.click(
        screen.getByRole("button", { name: /manage available/i }),
      );
    }).not.toThrow();
  });
});
