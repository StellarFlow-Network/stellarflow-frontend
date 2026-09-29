import { defineConfig } from "cypress";

/**
 * Cypress configuration for the cross-border remittance suite (#1078).
 *
 * The suite drives an already-running app at `baseUrl`. CI builds and starts
 * the app before invoking Cypress, so no dev server is booted here; run
 * `npm run dev` alongside `npm run test:cypress:open` to iterate locally.
 */
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    fixturesFolder: false,
    // CI captures artifacts for the failure triage upload; local runs skip the
    // encoding cost and keep the run fast.
    video: Boolean(process.env.CI),
    screenshotOnRunFailure: Boolean(process.env.CI),
    defaultCommandTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 800,
    // The suite is long; on CI the renderer has to survive the whole spec.
    experimentalMemoryManagement: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
  },
});
