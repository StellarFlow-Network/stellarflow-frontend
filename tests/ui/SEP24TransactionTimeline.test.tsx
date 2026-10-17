import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SEP24TransactionTimeline,
  DEFAULT_ANCHORS,
  DEFAULT_HISTORICAL_TRANSACTIONS,
  formatTimelineTimestamp,
  OperationBadge,
  OverallStatusBadge,
  AnchorPartnerBadge,
} from "@/components/remittance/SEP24TransactionTimeline";
import type {
  SEP24HistoricalTransaction,
  SEP24OverallStatus,
} from "@/types/sep24Timeline";

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: SEP24TransactionTimeline (Issue #1198)
// ─────────────────────────────────────────────────────────────────────────────

describe("SEP24TransactionTimeline Component (Issue #1198)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps fixture transactions labeled as samples and never simulates settlement", async () => {
    render(
      <SEP24TransactionTimeline initialSelectedId="sep24-dep-9003" />
    );

    expect(screen.getByTestId("sep24-demo-data-badge")).toHaveTextContent("Sample data");
    expect(screen.getAllByTestId("badge-status-pending_anchor")).toHaveLength(2);
    expect(screen.queryByTestId("anchor-receipt-portal-link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh timeline status" })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });

    expect(screen.getAllByTestId("badge-status-pending_anchor")).toHaveLength(2);
    expect(screen.queryByTestId("anchor-receipt-portal-link")).not.toBeInTheDocument();
  });

  it("does not poll or enable refresh for no_market status", async () => {
    const noMarketTx: SEP24HistoricalTransaction = {
      ...DEFAULT_HISTORICAL_TRANSACTIONS[0],
      id: "no-market-tx",
      status: "no_market",
      moreInfoUrl: undefined,
    };
    const poller = vi.fn().mockResolvedValue({ status: "completed" });

    render(
      <SEP24TransactionTimeline transactions={[noMarketTx]} onPollStatus={poller} />
    );

    expect(screen.getByRole("button", { name: "Refresh timeline status" })).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(poller).not.toHaveBeenCalled();
  });

  // ── 1. Unit Tests for Badges & Helpers ──────────────────────────────────

  describe("Subcomponents & Presentation Helpers", () => {
    it("formats ISO timestamps into localized readable representations", () => {
      const iso = "2026-10-17T03:14:22Z";
      const formatted = formatTimelineTimestamp(iso);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe("string");
    });

    it("renders OperationBadge correctly for deposits and withdrawals", () => {
      const { unmount: u1 } = render(<OperationBadge operation="deposit" />);
      const depBadge = screen.getByTestId("badge-op-deposit");
      expect(depBadge).toBeInTheDocument();
      expect(depBadge).toHaveTextContent(/deposit/i);
      u1();

      const { unmount: u2 } = render(<OperationBadge operation="withdrawal" />);
      const wdBadge = screen.getByTestId("badge-op-withdrawal");
      expect(wdBadge).toBeInTheDocument();
      expect(wdBadge).toHaveTextContent(/withdrawal/i);
      u2();
    });

    it("renders OverallStatusBadge for completed, failed, and pending statuses", () => {
      const { unmount: u1 } = render(<OverallStatusBadge status="completed" />);
      expect(screen.getByTestId("badge-status-completed")).toHaveTextContent(/completed/i);
      u1();

      const { unmount: u2 } = render(<OverallStatusBadge status="failed" />);
      expect(screen.getByTestId("badge-status-failed")).toHaveTextContent(/failed/i);
      u2();

      const { unmount: u3 } = render(<OverallStatusBadge status="pending_anchor" />);
      expect(screen.getByTestId("badge-status-pending_anchor")).toHaveTextContent(/processing/i);
      u3();

    const { unmount: u4 } = render(<OverallStatusBadge status="no_market" />);
    expect(screen.getByTestId("badge-status-no_market")).toHaveTextContent(/no market/i);
    u4();
    });

    it("renders AnchorPartnerBadge with partner name, domain, and region", () => {
      render(<AnchorPartnerBadge anchor={DEFAULT_ANCHORS.cowrie} />);
      const badge = screen.getByTestId("anchor-badge-cowrie");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("Cowrie Integrated Systems");
      expect(badge).toHaveTextContent("cowrie.exchange");
      expect(badge).toHaveTextContent("Nigeria (NGN)");
    });
  });

  // ── 2. Historical Timeline & Itemized Step Logs ─────────────────────────

  describe("Historical Timeline & Itemized Step Logs Rendering", () => {
    it("renders historical fiat transaction timeline with itemized step logs and timestamps", () => {
      render(
        <SEP24TransactionTimeline
          transactions={DEFAULT_HISTORICAL_TRANSACTIONS}
          initialSelectedId="sep24-dep-9001"
        />
      );

      // Verify selected transaction amounts
      expect(screen.getAllByText(/750000 NGN/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/500 USDC/)[0]).toBeInTheDocument();

      // Verify anchor badge
      expect(screen.getByTestId("anchor-badge-cowrie")).toBeInTheDocument();

      // Verify step logs list
      const stepList = screen.getByTestId("sep24-step-logs-list");
      expect(stepList).toBeInTheDocument();

      // Verify all 5 steps of the deposit exist with titles and descriptions
      expect(screen.getByTestId("step-log-node-interactive_auth")).toHaveTextContent(
        "Interactive Webview Auth & KYC"
      );
      expect(screen.getByTestId("step-log-node-fiat_transfer")).toHaveTextContent(
        "Fiat Payment Received via NIBSS"
      );
      expect(screen.getByTestId("step-log-node-anchor_clearing")).toHaveTextContent(
        "Anchor Compliance & FX Conversion"
      );
      expect(screen.getByTestId("step-log-node-stellar_issuance")).toHaveTextContent(
        "Stellar Minting & Transfer"
      );
      expect(screen.getByTestId("step-log-node-completed")).toHaveTextContent(
        "Transfer Settlement Complete"
      );

      // Verify external reference and Stellar Tx hash links
      expect(screen.getByText(/Ref: NIBSS-TRF-884920194/)).toBeInTheDocument();
      expect(screen.getByText(/Tx: 4f7a2b…0c2e4f/)).toBeInTheDocument();
    });

    it("renders direct link to anchor receipt portal for completed transactions", () => {
      render(
        <SEP24TransactionTimeline
          transactions={DEFAULT_HISTORICAL_TRANSACTIONS}
          initialSelectedId="sep24-dep-9001"
        />
      );

      // Direct receipt portal link should be visible with verified attributes
      const receiptLink = screen.getByTestId("anchor-receipt-portal-link");
      expect(receiptLink).toBeInTheDocument();
      expect(receiptLink).toHaveAttribute("target", "_blank");
      expect(receiptLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(receiptLink).toHaveAttribute(
        "href",
        "https://anchor.cowrie.exchange/receipts/sep24-dep-9001"
      );

      // Completed summary banner
      expect(screen.getByTestId("completed-summary-banner")).toBeInTheDocument();
    });
  });

  // ── 3. Dynamic Status Progression (Acceptance Criteria 2) ───────────────

  describe("Dynamic Status Updates (Acceptance Criteria 2)", () => {
    it("updates status badge dynamically as active transactions progress", async () => {
      // Create an in-flight transaction
      const inFlightTx: SEP24HistoricalTransaction = {
        id: "sep24-live-active",
        operation: "deposit",
        status: "pending_anchor",
        anchor: DEFAULT_ANCHORS.tempo,
        amountIn: 150,
        assetIn: "EUR",
        amountOut: 150,
        assetOut: "EURC",
        startedAt: "2026-10-17T05:00:00Z",
        updatedAt: "2026-10-17T05:01:00Z",
        stepLogs: [
          {
            id: "s1",
            stepKey: "interactive_auth",
            title: "Interactive Auth",
            description: "SEPA transfer initiated.",
            status: "completed",
            timestamp: "2026-10-17T05:00:00Z",
          },
          {
            id: "s2",
            stepKey: "anchor_clearing",
            title: "Anchor Processing",
            description: "Tempo clearing inbound payment.",
            status: "in_progress",
            timestamp: "2026-10-17T05:01:00Z",
          },
        ],
      };

      const onStatusChangeMock = vi.fn();

      // Custom status poller that advances the transaction to completed on poll
      const onPollStatusMock = vi.fn().mockImplementation(async () => {
        return {
          status: "completed" as SEP24OverallStatus,
          completedAt: "2026-10-17T05:03:00Z",
          updatedAt: "2026-10-17T05:03:00Z",
          moreInfoUrl: "https://tempo.eu.com/receipts/sep24-live-active",
          stepLogs: [
            {
              id: "s1",
              stepKey: "interactive_auth",
              title: "Interactive Auth",
              description: "SEPA transfer initiated.",
              status: "completed" as const,
              timestamp: "2026-10-17T05:00:00Z",
            },
            {
              id: "s2",
              stepKey: "anchor_clearing",
              title: "Anchor Processing",
              description: "Payment confirmed by Tempo.",
              status: "completed" as const,
              timestamp: "2026-10-17T05:02:00Z",
            },
            {
              id: "s3",
              stepKey: "completed",
              title: "Settlement Complete",
              description: "EURC 150 issued to wallet.",
              status: "completed" as const,
              timestamp: "2026-10-17T05:03:00Z",
            },
          ],
        };
      });

      render(
        <SEP24TransactionTimeline
          transactions={[inFlightTx]}
          initialSelectedId="sep24-live-active"
          pollInterval={2000}
          onPollStatus={onPollStatusMock}
          onStatusChange={onStatusChangeMock}
        />
      );

      // Initially active with Processing status badge
      expect(screen.getAllByTestId("badge-status-pending_anchor")[0]).toHaveTextContent(
        /processing/i
      );
      expect(screen.queryByTestId("badge-status-completed")).not.toBeInTheDocument();
      expect(screen.queryByTestId("anchor-receipt-portal-link")).not.toBeInTheDocument();

      // Advance fake timers by poll interval
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Verify poller was called
      expect(onPollStatusMock).toHaveBeenCalledWith("sep24-live-active");

      // Verify status badge updated dynamically to Completed
      expect(screen.getAllByTestId("badge-status-completed")[0]).toBeInTheDocument();
      expect(screen.queryByTestId("badge-status-pending_anchor")).not.toBeInTheDocument();

      // Verify callback was triggered
      expect(onStatusChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "sep24-live-active",
          status: "completed",
        })
      );

      // Verify anchor receipt portal link is now unlocked and rendered
      const receiptLink = screen.getByTestId("anchor-receipt-portal-link");
      expect(receiptLink).toBeInTheDocument();
      expect(receiptLink).toHaveAttribute(
        "href",
        "https://tempo.eu.com/receipts/sep24-live-active"
      );

      // Verify new step was added to timeline
      expect(screen.getByTestId("step-log-node-completed")).toBeInTheDocument();
    });
  });

  // ── 4. Interactive Navigation & Filtering ───────────────────────────────

  describe("Interactive Navigation & Filtering", () => {
    it("filters transactions by operation kind (Deposits vs Withdrawals)", async () => {
      vi.useRealTimers(); // UserEvent works best with real timers
      const user = userEvent.setup();

      render(
        <SEP24TransactionTimeline
          transactions={DEFAULT_HISTORICAL_TRANSACTIONS}
        />
      );

      // Initially "All" shows both deposits and withdrawals in list
      expect(screen.getByTestId("tx-select-btn-sep24-dep-9001")).toBeInTheDocument();
      expect(screen.getByTestId("tx-select-btn-sep24-wd-9002")).toBeInTheDocument();

      // Click "Deposits" filter
      const depFilterBtn = screen.getByTestId("filter-op-deposit");
      await user.click(depFilterBtn);

      expect(screen.getByTestId("tx-select-btn-sep24-dep-9001")).toBeInTheDocument();
      expect(screen.getByTestId("tx-select-btn-sep24-dep-9003")).toBeInTheDocument();
      expect(screen.queryByTestId("tx-select-btn-sep24-wd-9002")).not.toBeInTheDocument();

      // Click "Withdrawals" filter
      const wdFilterBtn = screen.getByTestId("filter-op-withdrawal");
      await user.click(wdFilterBtn);

      expect(screen.getByTestId("tx-select-btn-sep24-wd-9002")).toBeInTheDocument();
      expect(screen.getByTestId("tx-select-btn-sep24-wd-9004")).toBeInTheDocument();
      expect(screen.queryByTestId("tx-select-btn-sep24-dep-9001")).not.toBeInTheDocument();
    });

    it("switches active transaction when clicked in the history list", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      render(
        <SEP24TransactionTimeline
          transactions={DEFAULT_HISTORICAL_TRANSACTIONS}
          initialSelectedId="sep24-dep-9001"
        />
      );

      // Currently Cowrie deposit is active
      expect(screen.getByTestId("anchor-badge-cowrie")).toBeInTheDocument();

      // Click Kotani withdrawal in list
      const kotaniBtn = screen.getByTestId("tx-select-btn-sep24-wd-9002");
      await user.click(kotaniBtn);

      // Now Kotani withdrawal details should be active
      expect(screen.getByTestId("anchor-badge-kotani")).toBeInTheDocument();
      expect(screen.getAllByText(/26000 KES/)[0]).toBeInTheDocument();
      expect(screen.getByTestId("step-log-node-stellar_payment")).toHaveTextContent(
        "Stellar Payment to Anchor Vault"
      );
    });
  });
});
