import React from "react";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastQueue";

function Harness() {
  const { addToast, updateToast } = useToast();
  const idRef = React.useRef<string | null>(null);
  return (
    <>
      <button
        onClick={() => {
          idRef.current = addToast({
            title: "Swap started",
            description: "Submitting to Soroban...",
            status: "processing",
          });
        }}
      >
        add-processing
      </button>
      <button
        onClick={() => {
          idRef.current = addToast({
            title: "Swap complete",
            description: "1 XLM received",
            status: "confirmed",
            txHash: "0xabc123",
          });
        }}
      >
        add-confirmed
      </button>
      <button
        onClick={() => {
          idRef.current = addToast({
            title: "Swap failed",
            description: "Network error",
            status: "failed",
          });
        }}
      >
        add-failed
      </button>
      <button
        onClick={() => {
          if (idRef.current) {
            updateToast(idRef.current, {
              status: "confirmed",
              title: "Updated title",
            });
          }
        }}
      >
        update-confirmed
      </button>
    </>
  );
}

function renderQueue() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

describe("ToastQueue", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders an empty notifications region by default", () => {
    renderQueue();

    expect(
      screen.getByRole("region", { name: /Notifications/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Swap started")).not.toBeInTheDocument();
  });

  it("renders a processing toast with title and description", () => {
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: "add-processing" }));

    expect(screen.getByText("Swap started")).toBeInTheDocument();
    expect(screen.getByText("Submitting to Soroban...")).toBeInTheDocument();
  });

  it("links confirmed toasts to the explorer when a tx hash exists", () => {
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: "add-confirmed" }));

    const link = screen.getByRole("link", { name: /View on Stellar Expert/i });
    expect(link).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/0xabc123",
    );
  });

  it("dismisses a toast via its close button", () => {
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: "add-failed" }));
    expect(screen.getByText("Swap failed")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close notification" }),
    );

    expect(screen.queryByText("Swap failed")).not.toBeInTheDocument();
  });

  it("auto-dismisses confirmed toasts after 5 seconds", () => {
    vi.useFakeTimers();
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: "add-confirmed" }));
    expect(screen.getByText("Swap complete")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Swap complete")).not.toBeInTheDocument();
  });

  it("auto-dismisses updated toasts once they turn confirmed", () => {
    vi.useFakeTimers();
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: "add-processing" }));
    expect(screen.getByText("Swap started")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "update-confirmed" }));
    expect(screen.getByText("Updated title")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Updated title")).not.toBeInTheDocument();
  });

  it("renders several toasts simultaneously", () => {
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: "add-processing" }));
    fireEvent.click(screen.getByRole("button", { name: "add-failed" }));

    expect(screen.getByText("Swap started")).toBeInTheDocument();
    expect(screen.getByText("Swap failed")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Close notification" }),
    ).toHaveLength(2);
  });
});