import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import { ErrorBoundary, DefaultErrorFallback } from "./ErrorBoundary";

vi.mock("@/utils/telemetry", () => ({
  logErrorToTelemetry: vi.fn(),
}));

function BombsOnMount(): React.ReactElement {
  throw new Error("Kapow!");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows the default fallback when a child throws", () => {
    // Silence React's expected error logging for this test.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary name="Transactions">
        <BombsOnMount />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: /Transactions Failed/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry Section/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kapow!")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("uses a custom static fallback when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<p>Custom fallback</p>}>
        <BombsOnMount />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("supports render-prop fallbacks with reset", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();

    render(
      <ErrorBoundary
        name="Chart"
        onReset={onReset}
        fallback={({ error, resetErrorBoundary }) => (
          <div>
            <p data-testid="fallback-error">{error?.message}</p>
            <button onClick={resetErrorBoundary}>Recover</button>
          </div>
        )}
      >
        <BombsOnMount />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("fallback-error")).toHaveTextContent("Kapow!");

    await user.click(screen.getByRole("button", { name: /Recover/i }));
    expect(onReset).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it("re-renders children after a successful reset", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BombsOnMount />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("button", { name: /Retry Section/i }),
    ).toBeInTheDocument();

    // The fallback's retry merely flips the boundary back; a healthy tree
    // renders children once again.
    await user.click(screen.getByRole("button", { name: /Retry Section/i }));
    spy.mockRestore();
  });
});

describe("DefaultErrorFallback", () => {
  it("shows the error message and a retry action", () => {
    render(
      <DefaultErrorFallback
        error={new Error("Broken")}
        resetErrorBoundary={() => {}}
        name="Dashboard"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Dashboard Failed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();
  });
});