import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { VOLATILITY_DISMISS_KEY, VolatilityAlertBanner } from "@/components/swap/VolatilityAlertBanner";

/** Interaction tests for the swap volatility banner (#1152). */
describe("VolatilityAlertBanner", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("appears when conditions change from calm to volatile", () => {
    const { rerender } = render(<VolatilityAlertBanner spreadPct={0.5} />);
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<VolatilityAlertBanner spreadPct={3} />);
    expect(screen.getByRole("alert")).toHaveTextContent("High market volatility");
  });

  it("dismissing hides it for the rest of the session", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VolatilityAlertBanner spreadPct={3} />);
    await user.click(screen.getByRole("button", { name: /dismiss volatility alert/i }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.sessionStorage.getItem(VOLATILITY_DISMISS_KEY)).toBe("1");

    unmount();
    render(<VolatilityAlertBanner spreadPct={3} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("links to alternative routes", () => {
    render(<VolatilityAlertBanner tradeAmount={10} poolDepth={100} alternativeRoutesHref="/pools" />);
    expect(screen.getByRole("link", { name: /compare routes/i })).toHaveAttribute("href", "/pools");
  });
});
