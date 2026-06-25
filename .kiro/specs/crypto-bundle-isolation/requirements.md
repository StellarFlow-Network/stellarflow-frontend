# Requirements Document

## Introduction

The stellarflow-frontend dashboard serves users who primarily read public price feeds, relayer status, and governance data. Currently, the project is structured to add heavy cryptographic keypair utilities (e.g., Stellar keypair generation, Ed25519 signature validation) directly into shared module scope. Because these libraries are not tree-shakable in their common distribution forms, any static import causes the entire cryptographic payload to be bundled into the main dashboard chunk — inflating the initial download for every user regardless of whether they ever interact with keypair or signing features.

This feature establishes the architectural rules, dynamic-import wrappers, dedicated utility entry points, and automated compilation checks that ensure cryptographic keypair utilities are permanently excluded from the main dashboard bundle. The existing bundle-size enforcement pipeline (`check-bundle-size.js`, `.bundle-limits.json`, and the GitHub Actions workflow) is extended to include crypto-specific exclusion assertions.

## Glossary

- **Bundle_Checker**: The Node.js script at `scripts/check-bundle-size.js` that analyses `.next/static/chunks/` after a build and reports size violations.
- **Crypto_Wrapper**: A dedicated TypeScript module (e.g., `src/lib/crypto/keypairUtils.ts`) that re-exports keypair and signature utilities and is only ever imported via `next/dynamic` or `import()`.
- **Dashboard_Bundle**: The main JavaScript chunk(s) emitted by Next.js for the root layout and the public-facing dashboard page (`src/app/page.tsx` and `src/app/layout.tsx`).
- **Dynamic_Import**: A JavaScript `import()` expression or Next.js `dynamic()` call that causes the module graph to be split at that boundary, deferring the load of the target module until it is actually needed at runtime.
- **Exclusion_Assertion**: A compile-time or post-build check that fails the build if a forbidden module identifier is detected inside a specified bundle.
- **Keypair_Utility**: Any function that creates, derives, or validates a cryptographic keypair or digital signature, including but not limited to Stellar `Keypair.random()`, `Keypair.fromSecret()`, and Ed25519 `sign` / `verify` primitives.
- **Lazy_Crypto_Page**: A Next.js page route (e.g., `src/app/crypto-tools/page.tsx`) whose sole purpose is to host keypair and signature UI, loaded entirely on demand.
- **Static_Import**: A top-level `import … from '…'` statement that is resolved at compile time and always included in the bundle that contains the importing module.
- **XDR_Worker**: The existing Web Worker at `src/app/logs/xdr-worker.ts` that performs base64 XDR decoding off the main thread; it does not use keypair utilities and must remain unaffected.

## Requirements

### Requirement 1: Crypto_Wrapper Module Isolation

**User Story:** As a frontend engineer, I want all keypair and signature utilities to live behind a single dedicated wrapper module, so that there is one authoritative place to add or remove cryptographic dependencies without risking accidental static imports elsewhere.

#### Acceptance Criteria

1. THE Crypto_Wrapper SHALL export all Keypair_Utility functions used by the application.
2. THE Crypto_Wrapper SHALL NOT contain any top-level side-effectful code that executes on module evaluation (e.g., key generation at import time).
3. WHEN a Keypair_Utility function is invoked, THE Crypto_Wrapper SHALL return the result synchronously or via a Promise, depending on the underlying library's API contract.
4. IF the underlying cryptographic library is unavailable at runtime, THEN THE Crypto_Wrapper SHALL throw a descriptive error identifying the missing dependency by name.
5. THE Crypto_Wrapper SHALL be the only module in the `src/` tree that contains a Static_Import of any cryptographic keypair library.

---

### Requirement 2: Dynamic Import Enforcement for Keypair Features

**User Story:** As a performance-conscious engineer, I want every consumer of keypair utilities to load them through a Dynamic_Import, so that the cryptographic payload is never included in the initial page load for dashboard readers.

#### Acceptance Criteria

1. WHEN a UI component requires a Keypair_Utility, THE component SHALL load the Crypto_Wrapper exclusively via a Dynamic_Import or `next/dynamic` call.
2. WHEN the Dynamic_Import is in flight, THE component SHALL render a non-blocking loading indicator rather than blocking the render tree.
3. WHEN the Dynamic_Import resolves, THE component SHALL make the Keypair_Utility available to the user without a full page reload.
4. IF the Dynamic_Import fails (e.g., network error, module parse error), THEN THE component SHALL display a user-visible error message and SHALL NOT silently swallow the failure.
5. THE Dashboard_Bundle SHALL NOT contain any module identifier matching the Crypto_Wrapper's file path after a production build.

---

### Requirement 3: Lazy_Crypto_Page Route

**User Story:** As a developer, I want a dedicated standalone page route for keypair and signature tooling, so that users who need those features can navigate to them on demand without affecting the dashboard's initial load performance.

#### Acceptance Criteria

1. THE Lazy_Crypto_Page SHALL be reachable at a distinct URL path (e.g., `/crypto-tools`) that is separate from the main dashboard route.
2. WHEN a user navigates to the Lazy_Crypto_Page, THE Next.js Router SHALL load the page's JavaScript chunk independently of the Dashboard_Bundle.
3. THE Lazy_Crypto_Page SHALL import the Crypto_Wrapper using a Dynamic_Import so that the cryptographic library chunk is deferred until the page is rendered.
4. WHEN the Lazy_Crypto_Page is rendered, THE page SHALL display at minimum a keypair generation UI and a signature validation UI.
5. THE Lazy_Crypto_Page chunk SHALL NOT be included in the Dashboard_Bundle's dependency graph.

---

### Requirement 4: Static Import Prohibition Lint Rule

**User Story:** As a team lead, I want an automated lint check that prevents engineers from accidentally adding a Static_Import of any cryptographic keypair library outside the Crypto_Wrapper, so that bundle isolation is enforced continuously rather than relying on manual code review.

#### Acceptance Criteria

1. THE Bundle_Checker SHALL include an Exclusion_Assertion that scans the built Dashboard_Bundle for the presence of known cryptographic library identifiers (e.g., `stellar-sdk`, `tweetnacl`, `@noble/ed25519`).
2. WHEN a forbidden identifier is detected in the Dashboard_Bundle, THE Bundle_Checker SHALL emit a named violation entry in the `.bundle-report.json` output.
3. WHEN running in strict mode (`--strict` flag), THE Bundle_Checker SHALL exit with a non-zero status code if any Exclusion_Assertion violation is found.
4. THE GitHub Actions workflow SHALL invoke the Bundle_Checker in strict mode on every pull request targeting `main` or `develop`.
5. IF no forbidden identifiers are found in the Dashboard_Bundle, THEN THE Bundle_Checker SHALL emit a confirmation message indicating that crypto isolation is verified.

---

### Requirement 5: Bundle Size Regression Guard for Crypto Isolation

**User Story:** As a CI/CD maintainer, I want the bundle size limits to be tightened to reflect the expected savings from crypto isolation, so that any future regression that re-introduces heavy crypto into the main bundle is caught automatically.

#### Acceptance Criteria

1. WHEN crypto isolation is active, THE Bundle_Checker SHALL enforce a `maxMainBundle` limit that is at most 250 KB (gzipped), consistent with the existing `.bundle-limits.json` configuration.
2. WHEN a new cryptographic dependency is added to the project, THE developer SHALL update the Crypto_Wrapper and SHALL NOT increase the `maxMainBundle` limit in `.bundle-limits.json` without a documented justification comment in the pull request.
3. THE Bundle_Checker SHALL report the gzipped size of the Crypto_Wrapper's lazy chunk separately from the Dashboard_Bundle in the `.bundle-report.json` output.
4. WHEN the Crypto_Wrapper's lazy chunk exceeds 150 KB gzipped, THE Bundle_Checker SHALL emit a warning (non-blocking) recommending further code splitting.
5. THE total gzipped size of all bundles SHALL remain within the `maxTotalGzipped` limit defined in `.bundle-limits.json`.

---

### Requirement 6: XDR Worker Non-Interference

**User Story:** As a developer, I want the crypto isolation changes to leave the existing XDR_Worker and its surrounding infrastructure completely unmodified, so that audit log decoding continues to work without regression.

#### Acceptance Criteria

1. THE XDR_Worker at `src/app/logs/xdr-worker.ts` SHALL NOT be modified as part of the crypto isolation implementation.
2. WHILE the Lazy_Crypto_Page is loading, THE XDR_Worker SHALL remain operational and SHALL continue to process `DECODE_XDR` and `BATCH_DECODE` messages.
3. THE Crypto_Wrapper SHALL NOT import from or depend on the XDR_Worker module.
4. THE XDR_Worker SHALL NOT import from or depend on the Crypto_Wrapper module.
5. IF the Crypto_Wrapper's Dynamic_Import fails, THEN THE XDR_Worker's message-handling loop SHALL be unaffected.

---

### Requirement 7: Developer Documentation

**User Story:** As a new contributor, I want clear documentation explaining the crypto bundle isolation architecture, so that I understand where to add new cryptographic utilities and how to verify that isolation is maintained.

#### Acceptance Criteria

1. THE project SHALL contain a documentation file (e.g., `docs/CRYPTO_BUNDLE_ISOLATION.md`) that describes the Crypto_Wrapper pattern, the Lazy_Crypto_Page route, and the Exclusion_Assertion checks.
2. THE documentation SHALL include a code example showing the correct way to consume a Keypair_Utility via Dynamic_Import.
3. THE documentation SHALL include a code example showing an incorrect Static_Import and explain why it violates the isolation contract.
4. THE documentation SHALL describe how to run the Bundle_Checker locally and how to interpret the Exclusion_Assertion output.
5. WHEN a new cryptographic library is added to the project, THE developer SHALL update the documentation to list the new library and its intended use case.
