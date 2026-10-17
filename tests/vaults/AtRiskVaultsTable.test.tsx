import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import AtRiskVaultsTable from "@/components/vaults/AtRiskVaultsTable";
import RecentLiquidations from "@/components/vaults/RecentLiquidations";
import { sortAtRiskVaults, type RiskVault } from "@/components/vaults/vaultRisk";

// jsdom does not implement the browser's modal dialog methods.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

const vaults: RiskVault[] = [
  { id: "warning", healthFactor: 1.4, debtUsd: 900, collateralUsd: 1600, collateralSymbol: "XLM" },
  { id: "critical", healthFactor: 0.8, debtUsd: 10000, collateralUsd: 10000, collateralSymbol: "USDC" },
  { id: "boundary", healthFactor: 1, debtUsd: 2000, collateralUsd: 2500, collateralSymbol: "XLM" },
  { id: "near", healthFactor: 0.9999, debtUsd: 500, collateralUsd: 600, collateralSymbol: "XLM" },
  { id: "safe", healthFactor: 2, debtUsd: 100, collateralUsd: 500, collateralSymbol: "XLM" },
];

const ids = () => screen.getAllByRole("rowheader").map((row) => row.textContent);

describe("at-risk vaults", () => {
  it("filters safe/invalid health factors, sorts numerically and preserves input", () => {
    const input = [...vaults, { ...vaults[0], id: "invalid", healthFactor: NaN }];
    expect(sortAtRiskVaults(input).map((v) => v.id)).toEqual(["critical", "near", "boundary", "warning"]);
    expect(input[0].id).toBe("warning");
    expect(sortAtRiskVaults([{ ...vaults[0], healthFactor: 1.5 }])).toHaveLength(1);
    expect(sortAtRiskVaults([{ ...vaults[0], healthFactor: -1 }])).toHaveLength(0);
  });

  it("defaults to ascending health factor and toggles every numeric column", () => {
    render(<AtRiskVaultsTable vaults={vaults} />);
    expect(ids()).toEqual(["critical", "near", "boundary", "warning"]);
    fireEvent.click(screen.getByRole("button", { name: "Health factor" }));
    expect(ids()).toEqual(["warning", "boundary", "near", "critical"]);
    for (const label of ["Debt amount (USD)", "Collateral (USD)"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(ids()).toEqual(["near", "warning", "boundary", "critical"]);
      expect(screen.getByRole("columnheader", { name: label })).toHaveAttribute("aria-sort", "ascending");
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(ids()).toEqual(["critical", "boundary", "warning", "near"]);
    }
  });

  it("opens the drawer with the exact eligible ID and never submits on selection", () => {
    const confirm = vi.fn();
    render(<AtRiskVaultsTable vaults={vaults} onConfirmLiquidation={confirm} />);
    expect(screen.getByRole("button", { name: "Liquidate vault boundary" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Liquidate vault warning" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault near" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByLabelText("Vault ID")).toHaveValue("near");
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close liquidation drawer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables live submission without an adapter and renders empty states", () => {
    const view = render(<AtRiskVaultsTable vaults={vaults} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault critical" }));
    expect(screen.getByRole("button", { name: "Confirm liquidation" })).toBeDisabled();
    expect(screen.getByText(/Preview only/)).toBeInTheDocument();
    view.rerender(<AtRiskVaultsTable vaults={[]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("No at-risk vaults.")).toBeInTheDocument();
  });

  it("rechecks eligibility when a selected vault changes", () => {
    const confirm = vi.fn();
    const view = render(<AtRiskVaultsTable vaults={vaults} onConfirmLiquidation={confirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault critical" }));
    view.rerender(<AtRiskVaultsTable vaults={vaults.map((v) => v.id === "critical" ? { ...v, healthFactor: 1 } : v)} onConfirmLiquidation={confirm} />);
    expect(screen.getByRole("button", { name: "Confirm liquidation" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("no longer eligible");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("submits only the selected ID, prevents repeat submissions and closes on success", async () => {
    let resolve!: () => void;
    const confirm = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<AtRiskVaultsTable vaults={vaults} onConfirmLiquidation={confirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault critical" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm liquidation" }));
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    expect(confirm).toHaveBeenCalledExactlyOnceWith("critical");
    resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the drawer available after a failed submission", async () => {
    render(<AtRiskVaultsTable vaults={vaults} onConfirmLiquidation={vi.fn().mockRejectedValue(new Error("failed"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault critical" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm liquidation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be submitted");
    expect(screen.getByRole("button", { name: "Confirm liquidation" })).toBeEnabled();
  });

  it("does not close a new selection when a removed vault's request finishes", async () => {
    let resolve!: () => void;
    const confirm = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const view = render(<AtRiskVaultsTable vaults={vaults} onConfirmLiquidation={confirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault critical" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm liquidation" }));
    view.rerender(<AtRiskVaultsTable vaults={vaults.filter((v) => v.id !== "critical")} onConfirmLiquidation={confirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquidate vault near" }));
    resolve();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
    expect(screen.getByLabelText("Vault ID")).toHaveValue("near");
  });
});

it("shows newest liquidation first with a badge and network-specific transaction link", () => {
  render(<RecentLiquidations events={[
    { id: "old", vaultId: "older", transactionHash: "a".repeat(64), network: "public", occurredAt: "2026-10-01T00:00:00Z", debtRepaidUsd: 500 },
    { id: "new", vaultId: "newer", transactionHash: "b".repeat(64), network: "testnet", occurredAt: "2026-10-02T00:00:00Z", debtRepaidUsd: 1000 },
  ]} />);
  const items = screen.getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("newer");
  expect(within(items[0]).getByText("Liquidated")).toBeInTheDocument();
  expect(within(items[0]).getByRole("link")).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${"b".repeat(64)}`);
  expect(within(items[1]).getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
});

it("shows an empty liquidation history", () => {
  render(<RecentLiquidations events={[]} />);
  expect(screen.getByText("No recent liquidations.")).toBeInTheDocument();
});
