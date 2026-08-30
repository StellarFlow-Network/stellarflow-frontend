import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import { PageTransition, AnimatedActionButton } from "./PageTransition";

describe("PageTransition", () => {
  afterEach(() => {
    cleanup();
  });

  it("wraps and renders its children", () => {
    render(
      <PageTransition>
        <p>Page content</p>
      </PageTransition>,
    );

    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("applies a custom className to the motion wrapper", () => {
    const { container } = render(
      <PageTransition className="max-w-3xl">
        <span>Content</span>
      </PageTransition>,
    );

    const wrapper = container.querySelector(".max-w-3xl");
    expect(wrapper).toBeInTheDocument();
  });
});

describe("AnimatedActionButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an animated button and forwards clicks", async () => {
    const onClick = vi.fn();
    render(
      <AnimatedActionButton onClick={onClick} className="cta">
        Press me
      </AnimatedActionButton>,
    );

    const button = screen.getByRole("button", { name: /Press me/i });
    expect(button.className).toContain("cta");
    expect(button).toHaveAttribute("type", "button");

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type button for safety", () => {
    render(<AnimatedActionButton>Label</AnimatedActionButton>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});