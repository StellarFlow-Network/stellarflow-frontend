# Implementation Plan: Crypto Bundle Isolation

## Overview

Implement crypto bundle isolation by creating a dedicated `Crypto_Wrapper` module, a `Lazy_Crypto_Page` route, a `CryptoToolsPanel` UI component, and extending the bundle checker with `Exclusion_Assertion` logic. Dependencies (`stellar-sdk`, `tweetnacl`) are added as pinned production dependencies. The main dashboard bundle must never contain any cryptographic library identifiers.

## Tasks

- [ ] 1. Add pinned crypto dependencies and configure `.bundle-limits.json`
  - [ ] 1.1 Add `stellar-sdk@12.3.0` and `tweetnacl@1.0.3` as pinned production dependencies in `package.json`
    - Add both packages under `"dependencies"` with exact versions (no `^` or `~`)
    - _Requirements: 1.1, 1.4, 2.1_

  - [ ] 1.2 Extend `.bundle-limits.json` with crypto isolation fields
    - Add `"cryptoIsolation": true`, `"cryptoWrapperChunkWarningKb": 150`, and `"forbiddenInMainBundle"` array containing `"stellar-sdk"`, `"stellar_sdk"`, `"tweetnacl"`, `"@noble/ed25519"`, `"noble/ed25519"`, `"keypairUtils"`
    - _Requirements: 4.1, 5.1, 5.4_

- [ ] 2. Create the Crypto_Wrapper module
  - [ ] 2.1 Create `src/lib/crypto/keypairUtils.ts` with all exported keypair utility functions
    - Implement `generateKeypair()`, `keypairFromSecret()`, `signPayload()`, and `verifySignature()` exactly as specified in the design
    - Static imports of `stellar-sdk` and `tweetnacl` must appear only in this file
    - No top-level side effects — no key generation at module evaluation time
    - All error messages must name the failing library (`stellar-sdk`, `tweetnacl`)
    - Export `GeneratedKeypair`, `SignResult`, and `VerifyResult` interfaces
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write unit tests for `keypairUtils.ts`
    - Test `generateKeypair()` returns a valid Stellar public key (starts with `G`) and secret key (starts with `S`)
    - Test `keypairFromSecret()` round-trips correctly and throws a descriptive error on a malformed secret
    - Test `signPayload()` produces a hex string and `verifySignature()` returns `{ valid: true }` for a matching pair
    - Test `verifySignature()` returns `{ valid: false }` for a tampered message
    - _Requirements: 1.3, 1.4_

- [ ] 3. Checkpoint — Crypto_Wrapper baseline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create the CryptoToolsPanel UI component
  - [ ] 4.1 Create `src/app/components/crypto/CryptoToolsPanel.tsx`
    - Implement the full panel with keypair generation section and sign/verify section as specified in the design
    - Use a runtime `async function loadCrypto()` (not a static top-level import) to load `keypairUtils`
    - Render a `role="alert"` error div when any crypto operation throws
    - Use `aria-labelledby` on each `<section>` for accessibility
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4_

  - [ ]* 4.2 Write unit tests for `CryptoToolsPanel`
    - Mock `loadCrypto` to return stub implementations
    - Test that clicking "Generate Keypair" calls `generateKeypair` and renders the public/secret key output
    - Test that a rejected `loadCrypto` promise renders the `role="alert"` error element
    - _Requirements: 2.2, 2.4_

- [ ] 5. Create the Lazy_Crypto_Page route
  - [ ] 5.1 Create `src/app/crypto-tools/page.tsx`
    - Mark the file with `'use client'`
    - Import `CryptoToolsPanel` via `next/dynamic` with `ssr: false`
    - Provide a `loading` fallback with `role="status"` and `aria-label="Loading cryptographic tools"` as specified in the design
    - Render a `<main>` wrapper with the page heading and `<CryptoToolsPanel />`
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write unit tests for `CryptoToolsPage`
    - Mock `next/dynamic` to verify `ssr: false` is passed
    - Test that the loading fallback renders while the dynamic import is pending
    - _Requirements: 3.2, 3.3_

- [ ] 6. Checkpoint — UI layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Extend `scripts/check-bundle-size.js` with Exclusion_Assertion
  - [ ] 7.1 Add `runCryptoExclusionAssertion(report, limits, jsDir, files)` function to `check-bundle-size.js`
    - Implement the function exactly as specified in the design: scan `main-*` chunks for each identifier in `limits.forbiddenInMainBundle`, populate `report.cryptoIsolation.cryptoExclusionViolations`, detect the crypto wrapper chunk by filename pattern, emit a non-blocking warning when the chunk exceeds `cryptoWrapperChunkWarningKb`
    - Call `runCryptoExclusionAssertion` inside `analyzeBundles()` after the existing per-file loop
    - Emit `🔐 Crypto isolation verified` on success and `❌ Crypto isolation FAILED` with violation details on failure
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.3, 5.4_

  - [ ]* 7.2 Write unit tests for `runCryptoExclusionAssertion`
    - Test that a `main-*.js` file containing `"stellar-sdk"` produces a violation entry and sets `report.passed = false`
    - Test that a `main-*.js` file with no forbidden identifiers sets `report.cryptoIsolation.verified = true`
    - Test that a non-main chunk containing a forbidden identifier does NOT produce a violation
    - Test that a chunk named `crypto-keypairUtils-xyz.js` is identified as the wrapper chunk and its gzipped size is recorded
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.3_

- [ ] 8. Extend `.github/workflows/bundle-check.yml` PR comment with crypto isolation status
  - [ ] 8.1 Update the `Comment PR with bundle report` step in `bundle-check.yml` to surface crypto isolation status
    - After the existing violations block, add the `if (report.cryptoIsolation)` block from the design: render `🔐 Crypto isolation: ✅ verified` or `❌ FAILED`, list the crypto wrapper chunk name and gzipped size, and list any `cryptoExclusionViolations`
    - _Requirements: 4.4, 5.3_

- [ ] 9. Create developer documentation
  - [ ] 9.1 Create `docs/CRYPTO_BUNDLE_ISOLATION.md`
    - Describe the Crypto_Wrapper pattern, the Lazy_Crypto_Page route, and the Exclusion_Assertion checks
    - Include a correct code example showing Dynamic_Import consumption of a Keypair_Utility
    - Include an incorrect Static_Import example with an explanation of why it violates isolation
    - Describe how to run the Bundle_Checker locally (`npm run build` / `npm run build:strict`) and how to interpret the Exclusion_Assertion output in `.bundle-report.json`
    - Include a section on how to add a new cryptographic library (update Crypto_Wrapper, update `forbiddenInMainBundle`, update this doc)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Tasks 7 and 8 (bundle checker + CI) are independent of tasks 4 and 5 (UI) and can be executed in parallel
- Task 9 (documentation) is last by design — it documents the completed system
- `src/app/logs/xdr-worker.ts`, `src/app/page.tsx`, and `src/app/layout.tsx` must NOT be modified
- The Crypto_Wrapper (`keypairUtils.ts`) is the only file in `src/` permitted to statically import `stellar-sdk` or `tweetnacl`
- Property-based tests are not applicable here — the design has no Correctness Properties section; unit tests cover the relevant invariants

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "7.1"] },
    { "id": 3, "tasks": ["4.2", "5.1", "7.2"] },
    { "id": 4, "tasks": ["5.2", "8.1"] },
    { "id": 5, "tasks": ["9.1"] }
  ]
}
```
