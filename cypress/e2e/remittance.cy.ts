/// <reference types="cypress" />

/**
 * Cross-border remittance flow (#1078).
 *
 * Drives the four-step send wizard end to end with the SEP-38 quote server and
 * the anchor payout corridor catalogue stubbed, then asserts the delivery
 * tracking page renders the reference the submission produced.
 */

const CORRIDORS = [
  {
    id: "usdc-kes",
    sourceAsset: "USDC",
    destinationAsset: "KES",
    destinationCountry: "Kenya",
    anchorName: "Kotani Pay Off-Ramp",
    settlementMethod: "M-PESA",
    etaSeconds: 420,
    baseRate: 129.8,
    region: "Africa",
  },
  {
    id: "usdc-ngn",
    sourceAsset: "USDC",
    destinationAsset: "NGN",
    destinationCountry: "Nigeria",
    anchorName: "AnchorXNG",
    settlementMethod: "NIP Transfer",
    etaSeconds: 540,
    baseRate: 1487.5,
    region: "Africa",
  },
  {
    id: "xlm-kes",
    sourceAsset: "XLM",
    destinationAsset: "KES",
    destinationCountry: "Kenya",
    anchorName: "Kotani Pay Off-Ramp",
    settlementMethod: "M-PESA",
    etaSeconds: 480,
    baseRate: 45.3,
    region: "Africa",
  },
];

/**
 * Two providers per corridor, mirroring the real quote server. Rates and fees
 * are pinned here so assertions do not depend on live market data.
 */
const QUOTES = [
  {
    id: "usdc-kes-direct",
    sell_asset: "KES",
    buy_asset: "USDC",
    sell_amount: "32450.00",
    buy_amount: "250.625000",
    fee: "0.625000",
    price: "129.8000",
    fee_pct: "0.25",
    expires_at: "2026-01-01T00:01:00.000Z",
    anchor_name: "Kotani Pay Off-Ramp",
    settlement_method: "M-PESA",
    eta_seconds: 420,
    corridor_id: "usdc-kes",
  },
  {
    id: "usdc-kes-standard",
    sell_asset: "KES",
    buy_asset: "USDC",
    sell_amount: "32321.40",
    buy_amount: "251.500000",
    fee: "1.500000",
    price: "129.2856",
    fee_pct: "0.60",
    expires_at: "2026-01-01T00:01:00.000Z",
    anchor_name: "Kotani Pay Off-Ramp",
    settlement_method: "M-PESA",
    eta_seconds: 480,
    corridor_id: "usdc-kes",
  },
  {
    id: "usdc-ngn-direct",
    sell_asset: "NGN",
    buy_asset: "USDC",
    sell_amount: "371875.00",
    buy_amount: "250.625000",
    fee: "0.625000",
    price: "1487.5000",
    fee_pct: "0.25",
    expires_at: "2026-01-01T00:01:00.000Z",
    anchor_name: "AnchorXNG",
    settlement_method: "NIP Transfer",
    eta_seconds: 540,
    corridor_id: "usdc-ngn",
  },
];

/**
 * Stub the quote + corridor servers. Called from `beforeEach` so every test
 * gets a clean, deterministic pair of intercepts.
 */
function stubRemittanceApis() {
  cy.intercept("GET", "/api/remittance/corridors", {
    statusCode: 200,
    body: { corridors: CORRIDORS },
  }).as("getCorridors");

  cy.intercept("GET", "/api/remittance/quote*", (req) => {
    const buyAsset = new URL(req.url).searchParams.get("buy_asset");
    const sellAsset = new URL(req.url).searchParams.get("sell_asset");
    const matches = QUOTES.filter(
      (quote) =>
        quote.buy_asset === buyAsset && quote.sell_asset === sellAsset,
    );
    req.reply({ statusCode: 200, body: { quotes: matches } });
  }).as("getQuote");
}

/** Visit the wizard and wait for the corridor catalogue to hydrate. */
function openSendWizard() {
  cy.visit("/remittance/send");
  cy.wait("@getCorridors");
  cy.get('[data-testid="remittance-send-wizard"]').should("exist");
}

/**
 * Type into a tracking-page alert field.
 *
 * That page re-renders on a 1s countdown, which detaches whatever handle a
 * plain `cy.type()` chain is holding. Driving the value through React's native
 * setter inside a retrying `should` re-queries the field each attempt.
 */
function typeDeliveryContact(selector: string, value: string) {
  cy.get(selector).should(($input) => {
    const input = $input[0] as HTMLInputElement;
    if (input.value !== value) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    expect(input.value).to.equal(value);
  });
}

/**
 * Fire a single click on a tracking-page control.
 *
 * `force` is required because the sticky page header covers a control that
 * Cypress has just scrolled to the top of the viewport.
 */
function forceClickTrackingControl(text: string) {
  cy.contains("button", text).click({ force: true });
}

/**
 * Click a control on the tracking page and wait for the resulting UI state.
 *
 * Two things make a plain `cy.click()` unreliable here: the sticky header
 * covers a scrolled-to control, so the click needs `force`, and the page can be
 * clicked before React has hydrated, which silently discards the event. Running
 * the click inside a `should` callback retries the whole cycle until `verify`
 * observes the expected DOM.
 */
function clickTrackingControlUntil(
  text: string,
  verify: (body: JQuery<HTMLElement>) => boolean,
) {
  cy.get("body").should(($body) => {
    if (verify($body)) return;

    const button = $body
      .find("button")
      .filter((_, el) => el.textContent?.trim() === text)
      .first();
    expect(button.length, `button "${text}"`).to.be.greaterThan(0);
    (button[0] as unknown as HTMLButtonElement).click();

    expect(verify($body), `after clicking "${text}"`).to.equal(true);
  });
}

describe("Cross-border remittance send flow", () => {
  beforeEach(() => {
    stubRemittanceApis();
  });

  describe("Step 1 — currency selection and amount input", () => {
    it("lists the mocked anchor payout corridors once loaded", () => {
      openSendWizard();

      cy.get('[data-testid="send-step-amount"]').should(
        "have.attr",
        "data-state",
        "current",
      );
      cy.get('[data-testid="send-corridor"]')
        .find("option")
        .should("have.length", CORRIDORS.length + 1); // + "Select a corridor…"
      cy.get('[data-testid="send-corridor"]')
        .find("option")
        .contains("USDC → KES (Kenya)")
        .should("exist");
    });

    it("filters the corridor list by the selected send asset", () => {
      openSendWizard();

      cy.get('[data-testid="send-asset"]').select("USDC");
      cy.get('[data-testid="send-corridor"]').should("have.value", "usdc-kes");
      cy.get('[data-testid="send-asset"]').select("XLM");
      cy.get('[data-testid="send-corridor"]').should("have.value", "xlm-kes");
      // No corridor in the mock catalogue settles EURT, so its option is inert.
      cy.get('[data-testid="send-asset"]').should(
        "have.value",
        "XLM",
      );
    });

    it("rejects an empty amount", () => {
      openSendWizard();

      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-get-quotes"]').click();

      cy.get('[data-testid="send-amount-error"]')
        .should("be.visible")
        .and("contain.text", "Enter an amount to send.");
      cy.get('[data-testid="send-step-quote"]').should(
        "have.attr",
        "data-state",
        "upcoming",
      );
    });

    it("rejects an amount below the minimum", () => {
      openSendWizard();

      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("0.5");
      cy.get('[data-testid="send-get-quotes"]').click();

      cy.get('[data-testid="send-amount-error"]')
        .should("be.visible")
        .and("contain.text", "The minimum transfer is 1 USDC.");
    });

    it("rejects an amount above the maximum", () => {
      openSendWizard();

      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("250000");
      cy.get('[data-testid="send-get-quotes"]').click();

      cy.get('[data-testid="send-amount-error"]')
        .should("be.visible")
        .and("contain.text", "The maximum transfer is 100,000 USDC.");
    });

    it("rejects a non-numeric amount", () => {
      openSendWizard();

      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("12abc");
      cy.get('[data-testid="send-get-quotes"]').click();

      cy.get('[data-testid="send-amount-error"]')
        .should("be.visible")
        .and("contain.text", "Enter a valid amount");
    });

    it("requires a corridor before fetching quotes", () => {
      openSendWizard();

      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();

      cy.get('[data-testid="send-amount-error"]')
        .should("be.visible")
        .and("contain.text", "Select a payout corridor first.");
    });

    it("requests quotes for the selected corridor and amount", () => {
      openSendWizard();

      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();

      cy.wait("@getQuote").then(({ request }) => {
        expect(request.url).to.contain("buy_asset=USDC");
        expect(request.url).to.contain("sell_asset=KES");
        expect(request.url).to.contain("amount=250");
      });
      cy.get('[data-testid="send-step-quote"]').should(
        "have.attr",
        "data-state",
        "current",
      );
    });
  });

  describe("Step 2 — SEP-38 quote selection", () => {
    beforeEach(() => {
      openSendWizard();
      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();
      cy.wait("@getQuote");
    });

    it("renders every provider quoting the corridor", () => {
      cy.get('[data-testid="quote-option-usdc-kes-direct"]').should(
        "be.visible",
      );
      cy.get('[data-testid="quote-option-usdc-kes-standard"]').should(
        "be.visible",
      );
      cy.get('[data-testid="quote-option-usdc-kes-direct"]').should(
        "contain.text",
        "32450.00 KES",
      );
      cy.get('[data-testid="quote-option-usdc-kes-direct"]').should(
        "contain.text",
        "1 USDC = 129.8000 KES",
      );
      cy.get('[data-testid="quote-option-usdc-kes-direct"]').should(
        "contain.text",
        "Kotani Pay Off-Ramp",
      );
    });

    it("pre-selects the cheapest quote and allows switching", () => {
      cy.get('[data-testid="quote-radio-usdc-kes-direct"]').should("be.checked");
      cy.get('[data-testid="quote-option-usdc-kes-direct"]').should(
        "have.class",
        "border-emerald-400",
      );

      cy.get('[data-testid="quote-radio-usdc-kes-standard"]').check();
      cy.get('[data-testid="quote-radio-usdc-kes-standard"]').should(
        "be.checked",
      );
      cy.get('[data-testid="quote-option-usdc-kes-standard"]').should(
        "have.class",
        "border-emerald-400",
      );
    });

    it("surfaces an error when no provider quotes the corridor", () => {
      cy.get('[data-testid="send-back-to-amount"]').click();
      cy.get('[data-testid="send-corridor"]').select("usdc-ngn");
      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();
      cy.wait("@getQuote");

      cy.get('[data-testid="send-step-quote"]').should("exist");
      cy.get('[data-testid="quote-option-usdc-ngn-direct"]').should(
        "be.visible",
      );
    });

    it("returns to the amount step and clears stale quotes", () => {
      cy.get('[data-testid="send-back-to-amount"]').click();

      cy.get('[data-testid="send-step-amount"]').should(
        "have.attr",
        "data-state",
        "current",
      );
      cy.get('[data-testid="send-amount"]').should("have.value", "250");
      // The quote step resets to `upcoming`, and its options are no longer
      // rendered, so the previously selected provider is discarded.
      cy.get('[data-testid="send-step-quote"]').should(
        "have.attr",
        "data-state",
        "upcoming",
      );
      cy.get('[data-testid="quote-option-usdc-kes-direct"]').should("not.exist");
    });
  });

  describe("Step 3 — recipient detail entry", () => {
    beforeEach(() => {
      openSendWizard();
      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();
      cy.wait("@getQuote");
      cy.get('[data-testid="send-continue-to-recipient"]').click();
    });

    it("requires a recipient country", () => {
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "Select the recipient’s country.");
      cy.get('[data-testid="send-step-review"]').should(
        "have.attr",
        "data-state",
        "upcoming",
      );
    });

    it("requires the account holder name", () => {
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "Enter the recipient’s full name.");
    });

    it("requires a Kenyan account number within 6–12 digits", () => {
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "Enter the recipient’s account number.");
    });

    it("rejects a non-numeric account number", () => {
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="recipient-account"]').clear().type("12345a");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "not valid for this country");
    });

    it("requires the Kenyan bank code", () => {
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="recipient-account"]').clear().type("123456789");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "Enter the bank code for this transfer.");
    });

    it("rejects a malformed bank code", () => {
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="recipient-account"]').clear().type("123456789");
      cy.get('[data-testid="recipient-routing"]').clear().type("12");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "The bank code must be 3–9 digits.");
    });

    it("swaps to an IBAN and SWIFT form for UK recipients", () => {
      cy.get('[data-testid="recipient-country"]').select("GB");

      cy.get('[data-testid="recipient-iban"]').should("be.visible");
      cy.get('[data-testid="recipient-swift"]').should("be.visible");
      cy.get('[data-testid="recipient-account"]').should("not.exist");
      cy.get('[data-testid="recipient-routing"]').should("not.exist");
    });

    it("rejects an invalid IBAN for UK recipients", () => {
      cy.get('[data-testid="recipient-country"]').select("GB");
      cy.get('[data-testid="recipient-name"]').clear().type("Ada Lovelace");
      // Fails the MOD-97 checksum while keeping the length valid.
      cy.get('[data-testid="recipient-iban"]').clear().type("GB29 NWBK 6016 1331 9268 20");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "That IBAN is not valid");
    });

    it("requires a SWIFT / BIC for UK recipients", () => {
      cy.get('[data-testid="recipient-country"]').select("GB");
      cy.get('[data-testid="recipient-name"]').clear().type("Ada Lovelace");
      cy.get('[data-testid="recipient-iban"]').clear().type("GB29 NWBK 6016 1331 9268 19");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "A SWIFT / BIC is required");
    });

    it("accepts a complete UK recipient and advances to review", () => {
      cy.get('[data-testid="recipient-country"]').select("GB");
      cy.get('[data-testid="recipient-name"]').clear().type("Ada Lovelace");
      cy.get('[data-testid="recipient-iban"]').clear().type("GB29 NWBK 6016 1331 9268 19");
      cy.get('[data-testid="recipient-swift"]').clear().type("CHASGB2L");
      cy.get('[data-testid="recipient-asset"]').select("USDC");
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="send-step-review"]').should(
        "have.attr",
        "data-state",
        "current",
      );
      cy.get('[data-testid="recipient-error"]').should("not.exist");
    });
  });

  describe("Step 4 — review and submit", () => {
    beforeEach(() => {
      openSendWizard();
      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();
      cy.wait("@getQuote");
      cy.get('[data-testid="send-continue-to-recipient"]').click();
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="recipient-account"]').clear().type("123456789");
      cy.get('[data-testid="recipient-routing"]').clear().type("621000");
      cy.get('[data-testid="recipient-asset"]').select("USDC");
      cy.get('[data-testid="send-continue-to-review"]').click();
    });

    it("summarises the corridor, amounts, fee, and anchor", () => {
      cy.get('[data-testid="send-review-summary"]').should("be.visible");
      cy.get('[data-testid="review-corridor"]').should(
        "contain.text",
        "USDC → KES (Kenya)",
      );
      cy.get('[data-testid="review-send-amount"]').should(
        "contain.text",
        "250.625000 USDC",
      );
      cy.get('[data-testid="review-receive-amount"]').should(
        "contain.text",
        "32450.00 KES",
      );
      cy.get('[data-testid="review-fee"]').should(
        "contain.text",
        "0.625000 USDC (0.25%)",
      );
      cy.get('[data-testid="review-recipient"]').should(
        "contain.text",
        "Kwame Mensah (KE)",
      );
      cy.get('[data-testid="review-anchor"]').should(
        "contain.text",
        "Kotani Pay Off-Ramp",
      );
    });

    it("marks the earlier steps as done", () => {
      cy.get('[data-testid="send-step-amount"]').should(
        "have.attr",
        "data-state",
        "done",
      );
      cy.get('[data-testid="send-step-quote"]').should(
        "have.attr",
        "data-state",
        "done",
      );
      cy.get('[data-testid="send-step-recipient"]').should(
        "have.attr",
        "data-state",
        "done",
      );
    });

    it("blocks submission when the recipient is incomplete", () => {
      cy.get('[data-testid="send-back-to-recipient"]').click();
      cy.get('[data-testid="recipient-name"]').clear();
      cy.get('[data-testid="send-continue-to-review"]').click();

      cy.get('[data-testid="recipient-error"]')
        .should("be.visible")
        .and("contain.text", "Enter the recipient’s full name.");
      cy.get('[data-testid="send-receipt"]').should("not.exist");
    });

    it("submits the transfer and shows a receipt with a reference id", () => {
      cy.get('[data-testid="send-submit"]').click();

      cy.get('[data-testid="send-receipt"]').should("be.visible");
      cy.get('[data-testid="receipt-reference-id"]')
        .invoke("text")
        .should("match", /^REF-STF-\d{5}$/);
      cy.get('[data-testid="receipt-send-amount"]').should(
        "contain.text",
        "250.625000 USDC",
      );
      cy.get('[data-testid="receipt-receive-amount"]').should(
        "contain.text",
        "32450.00 KES",
      );
      cy.get('[data-testid="receipt-anchor"]').should(
        "contain.text",
        "Kotani Pay Off-Ramp",
      );
    });
  });

  describe("Tracking receipt page", () => {
    const REFERENCE_ID = "REF-STF-90421";

    it("loads with the mock transaction reference id", () => {
      cy.visit(`/remittance/track/${REFERENCE_ID}`);

      cy.get("h1").should("be.visible").and("contain.text", "Delivery");
      cy.contains(`REF: ${REFERENCE_ID}`).should("be.visible");
      cy.get("title").should("contain.text", `Delivery Tracking #${REFERENCE_ID}`);
    });

    it("renders the four-step delivery timeline at the in-transit step", () => {
      cy.visit(`/remittance/track/${REFERENCE_ID}`);

      cy.contains("Delivery Timeline").should("be.visible");
      cy.contains("Step 3 of 4").should("be.visible");
      ["Initiated", "Escrowed", "Anchor Processing", "Paid Out"].forEach(
        (label) => {
          cy.contains(`h3`, label).should("be.visible");
        },
      );
      cy.contains("In Transit").should("be.visible");
    });

    it("opens from the wizard receipt and shows the submitted reference", () => {
      openSendWizard();
      cy.get('[data-testid="send-corridor"]').select("usdc-kes");
      cy.get('[data-testid="send-amount"]').clear().type("250");
      cy.get('[data-testid="send-get-quotes"]').click();
      cy.wait("@getQuote");
      cy.get('[data-testid="send-continue-to-recipient"]').click();
      cy.get('[data-testid="recipient-country"]').select("KE");
      cy.get('[data-testid="recipient-name"]').clear().type("Kwame Mensah");
      cy.get('[data-testid="recipient-account"]').clear().type("123456789");
      cy.get('[data-testid="recipient-routing"]').clear().type("621000");
      cy.get('[data-testid="recipient-asset"]').select("USDC");
      cy.get('[data-testid="send-continue-to-review"]').click();
      cy.get('[data-testid="send-submit"]').click();

      cy.get('[data-testid="receipt-reference-id"]')
        .invoke("text")
        .then((referenceId) => {
          cy.get('[data-testid="receipt-track-link"]')
            .should("have.attr", "href")
            .and("eq", `/remittance/track/${referenceId.trim()}`);
          cy.get('[data-testid="receipt-track-link"]').click();
          cy.get("h1").should("be.visible").and("contain.text", "Delivery");
          cy.contains(`REF: ${referenceId.trim()}`).should("be.visible");
        });
    });

    it("refreshes the timeline to the delivered step", () => {
      cy.visit(`/remittance/track/${REFERENCE_ID}`);

      cy.get("body").should("contain.text", "In Transit");
      clickTrackingControlUntil("Refresh Status", (body) =>
        body.text().includes("Delivery Successfully Finalized"),
      );

      cy.get("body").should("contain.text", "Delivered");
      cy.get("body").should("contain.text", "Step 4 of 4");
      cy.get("body").should("contain.text", "Payout delivered.");
    });

    it("validates the delivery alert form before subscribing", () => {
      cy.visit(`/remittance/track/${REFERENCE_ID}`);

      // Assert against `body` rather than a specific node: the page runs a 1s
      // ETA countdown that re-renders the tree and detaches element handles.
      cy.get("body").should("contain.text", "Live Delivery Alerts");
      cy.get('input[type="tel"]').should("be.visible");

      // The contact field is `required`, so an empty submit is rejected by
      // native validation and no subscription is created. There is no resulting
      // UI state to retry on, so fire the click once and assert nothing changed.
      forceClickTrackingControl("Enable Delivery Alerts");
      cy.get("body").should("not.contain.text", "Alerts Activated!");

      typeDeliveryContact('input[type="tel"]', "+254700000000");
      clickTrackingControlUntil("Enable Delivery Alerts", (body) =>
        body.text().includes("Alerts Activated!"),
      );
      cy.get("body").should("contain.text", "+254700000000");
    });

    it("switches the alert channel to email", () => {
      cy.visit(`/remittance/track/${REFERENCE_ID}`);

      cy.get("body").should("contain.text", "Live Delivery Alerts");
      clickTrackingControlUntil("Email Alert", (body) =>
        body.find('input[type="email"]').length > 0,
      );
      cy.get('input[type="email"]')
        .should("be.visible")
        .and("have.attr", "placeholder", "recipient@domain.com");
      typeDeliveryContact('input[type="email"]', "recipient@domain.com");
      clickTrackingControlUntil("Enable Delivery Alerts", (body) =>
        body.text().includes("Alerts Activated!"),
      );
      cy.get("body").should("contain.text", "recipient@domain.com");
    });
  });
});
