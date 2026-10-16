import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuorumProgressBar } from "@/components/governance/QuorumProgressBar";

/** Live-update behaviour of the quorum bar (#1203). */
describe("QuorumProgressBar", () => {
  it("updates the fill as votes arrive and turns green at quorum", () => {
    const { rerender } = render(<QuorumProgressBar totalVotes={100} quorumRequired={500} eligibleVotes={1000} />);
    const fill = screen.getByTestId("quorum-fill");
    expect(fill).toHaveStyle({ width: "10%" });
    expect(fill).toHaveAttribute("data-reached", "false");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");

    rerender(<QuorumProgressBar totalVotes={500} quorumRequired={500} eligibleVotes={1000} />);
    expect(fill).toHaveStyle({ width: "50%" });
    expect(fill).toHaveAttribute("data-reached", "true");
    expect(fill.className).toContain("bg-emerald-500");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", expect.stringContaining("Quorum reached"));
  });

  it("places the marker at the quorum threshold", () => {
    render(<QuorumProgressBar totalVotes={0} quorumRequired={250} eligibleVotes={1000} />);
    expect(screen.getByTestId("quorum-marker")).toHaveStyle({ left: "25%" });
  });
});
