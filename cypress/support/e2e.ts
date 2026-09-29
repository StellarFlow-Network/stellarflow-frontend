/// <reference types="cypress" />

/**
 * Support file for the Cypress suites.
 *
 * The remittance suite stubs every backend it depends on, so any *unexpected*
 * uncaught exception should fail the test. One exception is filtered out: Next
 * reports a hydration mismatch in the root layout because the Sentry SDK
 * injects a `<script>` tag that is not part of the server-rendered tree. That
 * is a pre-existing, app-wide condition unrelated to the flow under test and
 * fires before any spec assertion runs.
 */
const IGNORED_HYDRATION_MESSAGES = ["Hydration failed", "Text content does not match"];

Cypress.on("uncaught:exception", (error) => {
  const isHydrationNoise = IGNORED_HYDRATION_MESSAGES.some(
    (message) =>
      error.message.includes(message) ||
      (error.stack ?? "").includes("throwOnHydrationMismatch"),
  );
  if (isHydrationNoise) {
    return false;
  }
  return true;
});
