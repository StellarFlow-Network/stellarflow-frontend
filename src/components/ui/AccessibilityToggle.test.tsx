import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AccessibilityToggle } from "./AccessibilityToggle";

const { mockContext } = vi.hoisted(() => ({
  mockContext: {
    highContrast: false,
    toggleHighContrast: vi.fn(),
  },
}));

vi.mock("@/context/AccessibilityContext", () => ({
  useAccessibilityContext: () => mockContext,
}));

describe("AccessibilityToggle", () => {
  beforeEach(() => {
    mockContext.highContrast = false;
    mockContext.toggleHighContrast.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a switch reflecting the current contrast state", () => {
    render(<AccessibilityToggle />);

    const toggle = screen.getByRole("switch", {
      name: /High-contrast colors/i,
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("reports high contrast as checked when enabled", () => {
    mockContext.highContrast = true;

    render(<AccessibilityToggle />);

    expect(
      screen.getByRole("switch", { name: /High-contrast colors/i }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("toggles the contrast setting on click", async () => {
    render(<AccessibilityToggle />);

    await userEvent.click(
      screen.getByRole("switch", { name: /High-contrast colors/i }),
    );

    expect(mockContext.toggleHighContrast).toHaveBeenCalledTimes(1);
  });
});