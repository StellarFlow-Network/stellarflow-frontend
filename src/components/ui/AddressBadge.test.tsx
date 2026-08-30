import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AddressBadge,
  JazziconAvatar,
  truncateAddress,
  generateAvatarColors,
} from "./AddressBadge";

const PUBLIC_KEY = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234";

describe("truncateAddress", () => {
  it("truncates a long address to head…tail form", () => {
    expect(truncateAddress(PUBLIC_KEY)).toBe("GABCDE…1234");
  });

  it("honors custom head/tail/separator lengths", () => {
    expect(
      truncateAddress(PUBLIC_KEY, { head: 4, tail: 6, separator: "..." }),
    ).toBe("GABC...YZ1234");
  });

  it("returns short addresses unchanged", () => {
    expect(truncateAddress("ABC")).toBe("ABC");
  });

  it("returns an empty string for missing input", () => {
    expect(truncateAddress("")).toBe("");
  });
});

describe("generateAvatarColors", () => {
  it("produces a deterministic palette for a key", () => {
    const first = generateAvatarColors(PUBLIC_KEY);
    const second = generateAvatarColors(PUBLIC_KEY);
    expect(first).toEqual(second);
    expect(first.background).toMatch(/^hsl\(/);
    expect(first.shapes).toHaveLength(5);
  });

  it("clamps the shape count to the supported range", () => {
    expect(generateAvatarColors(PUBLIC_KEY, 99).shapes).toHaveLength(8);
    expect(generateAvatarColors(PUBLIC_KEY, -1).shapes).toHaveLength(1);
  });

  it("is stable for the same seed across calls", () => {
    expect(generateAvatarColors(PUBLIC_KEY, 3).shapes).toEqual(
      generateAvatarColors(PUBLIC_KEY, 3).shapes,
    );
  });
});

describe("JazziconAvatar", () => {
  it("renders an accessible deterministic avatar", () => {
    render(
      <JazziconAvatar publicKey={PUBLIC_KEY} size={40} aria-label="Avatar for GABCDE" />,
    );

    const svg = screen.getByRole("img", { name: /Avatar for GABCDE/i });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "40");
    expect(svg).toHaveAttribute("height", "40");
  });
});

describe("AddressBadge", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the truncated address and the copy button", () => {
    render(<AddressBadge publicKey={PUBLIC_KEY} />);

    expect(screen.getByText("GABCDE…1234")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy address/i }),
    ).toBeInTheDocument();
  });

  it("hides the avatar when hideAvatar is true", () => {
    render(<AddressBadge publicKey={PUBLIC_KEY} hideAvatar />);

    expect(
      screen.queryByRole("img", { name: /Wallet avatar/i }),
    ).not.toBeInTheDocument();
  });

  it("renders an avatar for the wallet address by default", () => {
    render(<AddressBadge publicKey={PUBLIC_KEY} />);

    expect(
      screen.getByRole("img", { name: /Avatar for GABCDE…1234/i }),
    ).toBeInTheDocument();
  });

  it("copies the full key and shows confirmation", async () => {
    const onCopy = vi.fn();
    render(<AddressBadge publicKey={PUBLIC_KEY} onCopy={onCopy} />);

    await userEvent.click(screen.getByRole("button", { name: /Copy address/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(PUBLIC_KEY);
      expect(onCopy).toHaveBeenCalledWith(PUBLIC_KEY);
    });

    expect(
      screen.getByRole("button", { name: /Address copied/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copied!");
  });

  it("swallows clipboard failures without crashing", async () => {
    writeText.mockRejectedValue(new Error("Permission denied"));
    render(<AddressBadge publicKey={PUBLIC_KEY} />);

    await userEvent.click(screen.getByRole("button", { name: /Copy address/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    // Still rendered, still copyable.
    expect(
      screen.getByRole("button", { name: /Copy address/i }),
    ).toBeInTheDocument();
  });

  it("applies size-specific truncation lengths", () => {
    render(<AddressBadge publicKey={PUBLIC_KEY} size="lg" />);

    // lg default head = 8 → GABCDEFG…1234
    expect(screen.getByText("GABCDEFG…1234")).toBeInTheDocument();
  });

  it("supports custom truncation overrides", () => {
    render(
      <AddressBadge publicKey={PUBLIC_KEY} truncateHead={3} truncateTail={3} />,
    );

    expect(screen.getByText("GAB…234")).toBeInTheDocument();
  });
});