/// <reference types="cypress" />

const WALLET_PUBLIC_KEY = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

function stubSwapApis() {
  cy.intercept("GET", "/api/v1/balances*", {
    statusCode: 200,
    body: { balance: "250.0000000" },
  }).as("getBalance");

  cy.intercept("GET", "/api/v1/swap/quote*", {
    statusCode: 200,
    body: {
      estimatedOutput: "9.95",
      rate: 0.995,
      priceImpact: 0.1,
    },
  }).as("getSwapQuote");
}

function openSwapWithMockWallet() {
  cy.visit("/swap/trade", {
    onBeforeLoad(window) {
      const walletWindow = window as Window & {
        stellar?: { getPublicKey: () => Promise<string>; isConnected: () => Promise<boolean> };
      };
      walletWindow.stellar = {
        getPublicKey: () => Promise.resolve(WALLET_PUBLIC_KEY),
        isConnected: () => Promise.resolve(true),
      };
      window.localStorage.setItem("stellarflow.wallet.publicKey", WALLET_PUBLIC_KEY);
    },
  });
}

describe("Core token swap flow", () => {
  it("selects assets, reviews a quote, sets slippage, and confirms a mocked swap", () => {
    stubSwapApis();
    openSwapWithMockWallet();

    cy.contains("h1", "Instant asset swap").should("be.visible");
    cy.wait("@getBalance");

    cy.get('[aria-label="Select You Pay token"]').click();
    cy.get('[aria-label="Search tokens, domains, or contract addresses"]').type("EURT");
    cy.get('[role="option"]').contains("EURT").click();

    cy.get("form input[type=number]").not("[readonly]").first().type("10");
    cy.wait("@getSwapQuote");
    cy.get("form input[type=number]").filter("[readonly]").should("have.value", "9.95");
    cy.contains("Minimum Received").should("be.visible");

    cy.contains("button", "slippage").click();
    cy.contains("h2", "Slippage Tolerance").should("be.visible");
    cy.contains("button", /^1%$/).click();
    cy.contains("button", "Save").click();
    cy.contains("button", "1% slippage").should("be.visible");

    cy.contains("button", "Swap Tokens").should("be.enabled").click();
    cy.contains("h4", "Swap complete", { timeout: 5000 }).should("be.visible");
    cy.contains("Your token swap has been successfully executed.").should("be.visible");
  });

  it("keeps the swap disabled until an amount is entered", () => {
    stubSwapApis();
    openSwapWithMockWallet();

    cy.wait("@getBalance");
    cy.contains("button", "Enter an Amount").should("be.disabled");
  });
});
