import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  Skeleton,
  LoadingContainer,
  CardSkeleton,
  TableSkeleton,
  ChartSkeleton,
} from "./Skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder with custom classes", () => {
    render(<Skeleton className="h-12 w-12" data-testid="skeleton" />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.className).toContain("animate-pulse");
    expect(skeleton.className).toContain("h-12 w-12");
  });

  it("forwards HTML attributes", () => {
    render(<Skeleton aria-label="loading" />);
    expect(screen.getByLabelText("loading")).toBeInTheDocument();
  });
});

describe("LoadingContainer", () => {
  it("shows the fallback while loading and flags the container busy", () => {
    render(
      <LoadingContainer isLoading fallback={<span>Loading…</span>}>
        <p>Loaded content</p>
      </LoadingContainer>,
    );

    const wrapper = screen.getByText("Loaded content").closest("[aria-busy]")!;
    expect(wrapper).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("reveals content once loading finishes", () => {
    const { rerender } = render(
      <LoadingContainer isLoading fallback={<span>Busy</span>}>
        <p>Ready</p>
      </LoadingContainer>,
    );

    rerender(
      <LoadingContainer isLoading={false} fallback={<span>Busy</span>}>
        <p>Ready</p>
      </LoadingContainer>,
    );

    const wrapper = screen.getByText("Ready").closest("[aria-busy]")!;
    expect(wrapper).toHaveAttribute("aria-busy", "false");
  });

  it("applies custom classes to the wrapper", () => {
    render(
      <LoadingContainer isLoading={false} fallback={<span>Busy</span>} className="my-custom">
        <p>Ready</p>
      </LoadingContainer>,
    );

    const wrapper = screen.getByText("Ready").closest("[aria-busy]")!;
    expect(wrapper.className).toContain("my-custom");
  });
});

describe("CardSkeleton", () => {
  it("renders a dashboard card layout with busy semantics", () => {
    const { container } = render(<CardSkeleton />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(4);
  });
});

describe("TableSkeleton", () => {
  it("renders the configured number of rows", () => {
    const { container } = render(<TableSkeleton rows={4} />);

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).toBeInTheDocument();
    // 4 body rows × 4 cells each
    const cells = busy!.querySelectorAll(".animate-pulse");
    expect(cells.length).toBeGreaterThanOrEqual(4 * 4);
  });
});

describe("ChartSkeleton", () => {
  it("renders a chart layout with animated bars", () => {
    const { container } = render(<ChartSkeleton />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(12);
  });
});