import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const { mockContext } = vi.hoisted(() => ({
  mockContext: {
    mounted: true,
    isDark: false,
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
    theme: "light" as "light" | "dark" | "system",
    resolvedTheme: "light" as "light" | "dark",
  },
}));

vi.mock("@/context/ThemeContext", () => ({
  useThemeContext: () => mockContext,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockContext.mounted = true;
    mockContext.isDark = false;
    mockContext.toggleTheme.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing interactive before mount", () => {
    mockContext.mounted = false;

    render(<ThemeToggle />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers switching to dark mode in light theme", async () => {
    render(<ThemeToggle size={24} />);

    const button = screen.getByRole("button", { name: /Switch to dark mode/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(mockContext.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("offers switching to light mode in dark theme", () => {
    mockContext.isDark = true;

    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: /Switch to light mode/i }),
    ).toBeInTheDocument();
  });

  it("applies the provided className", () => {
    render(<ThemeToggle className="ring-2" />);
    expect(
      screen.getByRole("button", { name: /Switch to dark mode/i }).className,
    ).toContain("ring-2");
  });
});