import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormErrorSummary } from "@/components/forms/FormErrorSummary";

/** Interaction tests for the form error summary (#1175). */
function Form({ errors, setFocus }: { errors: Record<string, { message?: string }>; setFocus?: (n: string) => void }) {
  return (
    <form>
      <FormErrorSummary errors={errors} labels={{ amount: "Amount" }} setFocus={setFocus} />
      <label htmlFor="field-amount">Amount</label>
      <input id="field-amount" name="amount" />
      <input name="memo" aria-label="Memo" />
    </form>
  );
}

describe("FormErrorSummary", () => {
  it("lists every error inside an assertive live region", () => {
    render(<Form errors={{ amount: { message: "Required" }, memo: { message: "Too long" } }} />);
    const region = screen.getByRole("alert");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("link", { name: "Amount: Required" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Too long" })).toBeInTheDocument();
  });

  it("moves focus to the input by id when a link is clicked", async () => {
    const user = userEvent.setup();
    render(<Form errors={{ amount: { message: "Required" } }} />);
    await user.click(screen.getByRole("link", { name: "Amount: Required" }));
    expect(screen.getByLabelText("Amount")).toHaveFocus();
  });

  it("falls back to the name attribute when no element has the id", async () => {
    const user = userEvent.setup();
    render(<Form errors={{ memo: { message: "Too long" } }} />);
    await user.click(screen.getByRole("link", { name: "Too long" }));
    expect(screen.getByLabelText("Memo")).toHaveFocus();
  });

  it("delegates to React Hook Form's setFocus when given", async () => {
    const user = userEvent.setup();
    const setFocus = vi.fn();
    render(<Form errors={{ amount: { message: "Required" } }} setFocus={setFocus} />);
    await user.click(screen.getByRole("link", { name: "Amount: Required" }));
    expect(setFocus).toHaveBeenCalledWith("amount");
  });

  it("focuses the summary after a failed submit and stays empty when valid", () => {
    const { rerender } = render(<FormErrorSummary errors={{}} focusKey={0} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    act(() => {
      rerender(<FormErrorSummary errors={{ amount: { message: "Required" } }} focusKey={1} />);
    });
    expect(screen.getByRole("alert")).toHaveFocus();
  });
});
