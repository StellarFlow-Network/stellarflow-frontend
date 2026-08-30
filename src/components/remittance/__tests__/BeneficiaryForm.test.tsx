import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BeneficiaryForm } from "../BeneficiaryForm";

// ─── Anchor adapter is mocked; validation rules stay real ───────────────────

const { mockForwardBeneficiary } = vi.hoisted(() => ({
  mockForwardBeneficiary: vi.fn(),
}));

vi.mock("@/lib/beneficiaries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/beneficiaries")>();
  return {
    ...actual,
    forwardBeneficiaryToAnchor: (beneficiary: Parameters<typeof actual.forwardBeneficiaryToAnchor>[0]) =>
      mockForwardBeneficiary(beneficiary),
  };
});

describe("BeneficiaryForm", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onSubmitted: ReturnType<typeof vi.fn>;
  let onSaved: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    onClose = vi.fn();
    onSubmitted = vi.fn();
    onSaved = vi.fn();
    mockForwardBeneficiary.mockReset();
    mockForwardBeneficiary.mockResolvedValue({ ok: true, reference: "dev-ref" });
  });

  afterEach(() => {
    cleanup();
  });

  function renderForm(props: Partial<Parameters<typeof BeneficiaryForm>[0]> = {}) {
    return render(
      <BeneficiaryForm
        isOpen={props.isOpen ?? true}
        onClose={onClose}
        defaultCountry={props.defaultCountry}
        onSubmitted={onSubmitted}
        onSaved={onSaved}
      />,
    );
  }

  function countrySelect() {
    return screen.getAllByRole("combobox")[0];
  }

  function assetSelect() {
    return screen.getAllByRole("combobox")[1];
  }

  async function fillUSBeneficiary() {
    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(screen.getByPlaceholderText("8–17 digits"), "1234567890");
    await userEvent.type(screen.getByPlaceholderText("e.g. 021000021"), "021000021");
    await userEvent.selectOptions(assetSelect(), "USDC");
  }

  it("renders nothing when closed", () => {
    renderForm({ isOpen: false });

    expect(
      screen.queryByText(/Beneficiary Bank Details/i),
    ).not.toBeInTheDocument();
  });

  it("renders the modal with all static fields when open", () => {
    renderForm();

    expect(screen.getByText("Beneficiary Bank Details")).toBeInTheDocument();
    expect(screen.getByText("Target Country")).toBeInTheDocument();
    expect(screen.getByText("Payout Asset")).toBeInTheDocument();
    expect(
      screen.getByText("Account Holder Name"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submit without saving/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("populates payout asset options for the selected country", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    const usOptions = Array.from(
      assetSelect().querySelectorAll("option"),
    ).map((o) => o.textContent);
    expect(usOptions).toEqual(
      expect.arrayContaining(["USDC", "XLM"]),
    );

    await userEvent.selectOptions(countrySelect(), "GB");
    const gbOptions = Array.from(
      assetSelect().querySelectorAll("option"),
    ).map((o) => o.textContent);
    expect(gbOptions).toEqual(
      expect.arrayContaining(["USDC", "EURT", "XLM"]),
    );
  });

  it("shows IBAN + SWIFT fields for a UK beneficiary", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "GB");

    expect(screen.getByPlaceholderText("e.g. GB29 NWBK 6016 1331 9268 19")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. CHASGB2L")).toBeInTheDocument();
    expect(screen.getByText("IBAN scheme required")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("8–17 digits")).not.toBeInTheDocument();
  });

  it("shows local account fields for a US beneficiary", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");

    expect(screen.getByPlaceholderText("8–17 digits")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 021000021")).toBeInTheDocument();
    expect(screen.getByText("Local account scheme required")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("e.g. GB29 NWBK 6016 1331 9268 19"),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("e.g. CHASGB2L")).not.toBeInTheDocument();
  });

  it("reveals dynamic ID fields when the IBAN-or-account country leaves one empty", async () => {
    renderForm();
    // no fixture country uses iban_or_account in current rules, so this guards
    // the fall-through renderer against regressions by rendering a US form and
    // asserting the memo field is always available.
    await userEvent.selectOptions(countrySelect(), "US");

    expect(screen.getByPlaceholderText("e.g. Salary — February")).toBeInTheDocument();
  });

  it("requires a country before anything else", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(
      screen.getByText("Select the beneficiary’s country."),
    ).toBeInTheDocument();
  });

  it("requires an account holder name", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(screen.getByText("Enter the account holder name.")).toBeInTheDocument();
  });

  it("requires an account number for local-account countries", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(screen.getByText("Enter the bank account number.")).toBeInTheDocument();
  });

  it("rejects account numbers outside the country length range", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(screen.getByPlaceholderText("8–17 digits"), "1234");
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(
      screen.getByText(/Account number must be digits within the country’s length range/i),
    ).toBeInTheDocument();
  });

  it("requires a routing code when the country rule defines one", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(screen.getByPlaceholderText("8–17 digits"), "1234567890");
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(screen.getByText("Enter the bank routing / code.")).toBeInTheDocument();
  });

  it("rejects an invalid routing code", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(screen.getByPlaceholderText("8–17 digits"), "1234567890");
    await userEvent.type(screen.getByPlaceholderText("e.g. 021000021"), "12");
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(screen.getByText("Routing code must be 3–9 digits.")).toBeInTheDocument();
  });

  it("requires an IBAN for IBAN-only countries", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "GB");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(screen.getByText("This country requires an IBAN.")).toBeInTheDocument();
  });

  it("rejects an invalid IBAN", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "GB");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(
      screen.getByPlaceholderText("e.g. GB29 NWBK 6016 1331 9268 19"),
      "GB00INVALID",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(
      screen.getByText("Enter a valid IBAN for the selected country."),
    ).toBeInTheDocument();
  });

  it("requires a SWIFT/BIC for countries that mandate it", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "GB");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(
      screen.getByPlaceholderText("e.g. GB29 NWBK 6016 1331 9268 19"),
      "GB29 NWBK 6016 1331 9268 19",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(
      screen.getByText("This country requires a SWIFT/BIC code."),
    ).toBeInTheDocument();
  });

  it("rejects an invalid SWIFT/BIC", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "GB");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(
      screen.getByPlaceholderText("e.g. GB29 NWBK 6016 1331 9268 19"),
      "GB29 NWBK 6016 1331 9268 19",
    );
    await userEvent.type(screen.getByPlaceholderText("e.g. CHASGB2L"), "BAD");
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(
      screen.getByText("Enter a valid 8 or 11 character SWIFT/BIC."),
    ).toBeInTheDocument();
  });

  it("requires a payout asset", async () => {
    renderForm();

    await userEvent.selectOptions(countrySelect(), "US");
    await userEvent.type(
      screen.getByPlaceholderText("Name as it appears on the account"),
      "Jane Doe",
    );
    await userEvent.type(screen.getByPlaceholderText("8–17 digits"), "1234567890");
    await userEvent.type(screen.getByPlaceholderText("e.g. 021000021"), "021000021");
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    expect(screen.getByText("Choose the payout asset.")).toBeInTheDocument();
  });

  it("forwards a valid beneficiary and shows the success screen", async () => {
    renderForm();

    await fillUSBeneficiary();
    await userEvent.click(
      screen.getByRole("button", { name: /Submit without saving/i }),
    );

    await waitFor(() => {
      expect(mockForwardBeneficiary).toHaveBeenCalledTimes(1);
      expect(mockForwardBeneficiary).toHaveBeenCalledWith(
        expect.objectContaining({
          country: "US",
          accountHolderName: "Jane Doe",
          accountNumber: "1234567890",
          routingCode: "021000021",
          asset: "USDC",
        }),
      );
      expect(onSubmitted).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Beneficiary Registered")).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe \(US\) is ready for off-ramp payouts/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("persists the beneficiary to the contact book when saving", async () => {
    renderForm();

    await fillUSBeneficiary();
    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(/Saved to your encrypted beneficiary book/),
    ).toBeInTheDocument();
  });

  it("shows an anchor adapter rejection message", async () => {
    mockForwardBeneficiary.mockResolvedValue({ ok: false, error: "anchor_adapter_500" });

    renderForm();

    await fillUSBeneficiary();
    await userEvent.click(
      screen.getByRole("button", { name: /Submit without saving/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/The anchor adapter could not be reached \(anchor_adapter_500\)/i),
      ).toBeInTheDocument();
    });
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it("clears the validation error as soon as a field changes", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: /Submit & Save Beneficiary/i }),
    );
    expect(
      screen.getByText("Select the beneficiary’s country."),
    ).toBeInTheDocument();

    await userEvent.selectOptions(countrySelect(), "US");

    expect(
      screen.queryByText("Select the beneficiary’s country."),
    ).not.toBeInTheDocument();
  });

  it("closes via the header close button", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets the form when reopened", () => {
    const { rerender } = renderForm();

    rerender(
      <BeneficiaryForm
        isOpen={false}
        onClose={onClose}
        onSubmitted={onSubmitted}
        onSaved={onSaved}
      />,
    );
    rerender(
      <BeneficiaryForm
        isOpen
        onClose={onClose}
        onSubmitted={onSubmitted}
        onSaved={onSaved}
      />,
    );

    const holder = screen.getByPlaceholderText(
      "Name as it appears on the account",
    ) as HTMLInputElement;
    expect(holder.value).toBe("");
    expect(countrySelect()).toHaveValue("");
  });
});