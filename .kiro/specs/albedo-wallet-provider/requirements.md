# Requirements Document

## Introduction

This document defines requirements for integrating the Albedo web wallet as a signing and authorization provider within the StellarFlow frontend. Albedo is a browser-based Stellar wallet that operates via popup window (no browser extension required), using the `@albedo-link/intent` library to invoke cryptographic intents such as public key retrieval, transaction signing, and payment. The integration must follow the same provider component pattern established by `XBullWalletProvider` and `LedgerConnectModal`, store the active session public key in the global `WalletProvider` context, and handle popup-blocker restrictions gracefully with a clear user-facing prompt modal.

## Glossary

- **Albedo_Provider**: The `AlbedoWalletProvider` React component that manages the Albedo wallet connection lifecycle and transaction signing within a dialog.
- **Albedo_Intent**: The `@albedo-link/intent` JavaScript library that opens an Albedo popup window to handle cryptographic operations on the Stellar network.
- **Popup_Blocker**: A browser mechanism that prevents windows opened by `window.open()` from appearing unless triggered by a direct user gesture.
- **Popup_Blocker_Modal**: A secondary modal rendered when a popup-blocker condition is detected, guiding the user to allow popups and retry the operation.
- **Intent_Result**: The payload returned by `@albedo-link/intent` after a successful operation, containing a `pubkey` and, for signing intents, a `signed_envelope_xdr` or `tx_hash`.
- **WalletProvider**: The existing `WalletProvider` React context (at `src/app/components/providers/WalletProvider.tsx`) that holds the global wallet `publicKey` and `connected` state.
- **Session_Public_Key**: The Stellar G-address obtained from the `public_key` intent and stored in `WalletProvider` context via `refreshWalletState`.
- **Transaction_XDR**: A Base64-encoded Stellar transaction envelope in XDR format, passed to the `tx` intent for signing.
- **Signed_XDR**: The signed XDR string returned by Albedo after the user approves a transaction in the popup.
- **Network_Passphrase**: The Stellar network passphrase string that disambiguates testnet from mainnet for transaction signing.
- **AlbedoConnectionStep**: A discriminated union of lifecycle states (`idle`, `connecting`, `connected`, `signing`, `error`) used to drive UI state within the `Albedo_Provider`.
- **useAlbedoWallet**: The companion React hook that manages modal open/close state and bridges Albedo connection events into the `WalletProvider` context.

---

## Requirements

### Requirement 1: Albedo Provider Component

**User Story:** As a StellarFlow user, I want to connect my Albedo web wallet so that I can authorize transactions without installing a browser extension.

#### Acceptance Criteria

1. THE `Albedo_Provider` SHALL render as a modal dialog using the existing `OptimizedDialog` component.
2. WHEN the `Albedo_Provider` dialog is opened, THE `Albedo_Provider` SHALL display a step-by-step connection guide consistent with the visual style used by `XBullWalletProvider`.
3. THE `Albedo_Provider` SHALL accept `isOpen`, `onClose`, `onConnected`, `onDisconnected`, and `onSignTransaction` props matching the shape of `XBullWalletProvider`.
4. THE `Albedo_Provider` SHALL accept an optional `defaultNetwork` prop of type `"testnet" | "mainnet"` with a default value of `"testnet"`.
5. WHEN the dialog is closed while a connection attempt is in flight, THE `Albedo_Provider` SHALL ignore any subsequent `Intent_Result` so that `onConnected` does not fire after the dialog has been closed and state has been reset to `idle`.

---

### Requirement 2: Public Key Authorization Intent

**User Story:** As a StellarFlow user, I want to authorize StellarFlow to know my Albedo public key so that my wallet address is displayed in the application.

#### Acceptance Criteria

1. WHEN the user clicks the "Connect Albedo" button, THE `Albedo_Provider` SHALL invoke the `public_key` intent from `@albedo-link/intent` to retrieve the user's Stellar public key.
2. WHEN the `public_key` intent succeeds and returns a `pubkey`, THE `Albedo_Provider` SHALL store the `pubkey` as the `Session_Public_Key` and transition to the `connected` step.
3. WHEN the `public_key` intent succeeds, THE `Albedo_Provider` SHALL invoke the `onConnected` callback with the retrieved `pubkey`.
4. WHEN the `public_key` intent call resolves successfully but the returned `pubkey` is empty or absent, THE `Albedo_Provider` SHALL treat the resolved payload as invalid, transition to the `error` step, and display the message "Albedo returned an empty public key."
5. WHILE in the `connected` step, THE `Albedo_Provider` SHALL display the `Session_Public_Key` in a monospace, break-all text element within the status card.

---

### Requirement 3: Transaction Signing Intent

**User Story:** As a StellarFlow user, I want to sign Stellar transactions using Albedo so that I can submit authorized operations to the network.

#### Acceptance Criteria

1. WHILE in the `connected` step, THE `Albedo_Provider` SHALL display a `Transaction_XDR` textarea and a network selector (testnet / mainnet).
2. WHEN the user provides a non-empty `Transaction_XDR` and clicks the sign button, THE `Albedo_Provider` SHALL invoke the `tx` intent from `@albedo-link/intent` with the `xdr`, `pubkey`, and `network` parameters.
3. WHEN the `tx` intent succeeds and returns a `signed_envelope_xdr`, THE `Albedo_Provider` SHALL invoke the `onSignTransaction` callback with the `Signed_XDR` and the `Session_Public_Key`.
4. WHEN the `tx` intent succeeds, THE `Albedo_Provider` SHALL clear the `Transaction_XDR` textarea and transition back to the `connected` step.
5. WHILE the `tx` intent is in flight, THE `Albedo_Provider` SHALL display a toast with status `"processing"` and the message "Review and approve the transaction in Albedo."
6. WHEN the `tx` intent succeeds, THE `Albedo_Provider` SHALL update the processing toast to status `"confirmed"` with the message "Transaction signed successfully."
7. IF the `tx` intent rejects or throws, THEN THE `Albedo_Provider` SHALL update the processing toast to status `"failed"` and display an inline sign-error message without leaving the `connected` step.

---

### Requirement 4: Payment Intent Support

**User Story:** As a StellarFlow developer, I want the Albedo provider to support the `pay` intent so that payment flows can be authorized through Albedo when needed.

#### Acceptance Criteria

1. THE `Albedo_Provider` SHALL expose a `triggerPayIntent` method (via a forwarded ref or callback prop) that invokes the `pay` intent from `@albedo-link/intent`; the method is considered satisfied by its presence and invocability regardless of the exact parameter set.
2. WHEN the `pay` intent succeeds, THE `Albedo_Provider` SHALL invoke the `onSignTransaction` callback with the `tx_hash` and `Session_Public_Key`.
3. IF the `pay` intent is invoked while the `Albedo_Provider` is not in the `connected` step, THEN THE `Albedo_Provider` SHALL throw an `Error` with the message "Albedo wallet is not connected."

---

### Requirement 5: Session Public Key Storage in WalletProvider Context

**User Story:** As a StellarFlow developer, I want the Albedo session public key to be reflected in the global WalletProvider context so that all wallet-aware components display the correct address.

#### Acceptance Criteria

1. WHEN the `Albedo_Provider` invokes `onConnected` with a `pubkey`, THE `useAlbedoWallet` hook SHALL persist the `pubkey` to `localStorage` under the key `"stellarflow.wallet.albedo.publicKey"`.
2. WHEN the `Albedo_Provider` invokes `onConnected` with a `pubkey`, THE `useAlbedoWallet` hook SHALL call `refreshWalletState()` from `useWalletActions` so the global `WalletProvider` context reflects the new connection.
3. WHEN the `Albedo_Provider` invokes `onDisconnected`, THE `useAlbedoWallet` hook SHALL remove the `"stellarflow.wallet.albedo.publicKey"` key from `localStorage` and call `refreshWalletState()`.
4. WHEN `useAlbedoWallet` is called outside the `WalletProvider` (or `WalletSessionProvider`) boundary, THE `useAlbedoWallet` hook SHALL throw synchronously during render with a descriptive error message.

---

### Requirement 6: Popup Blocker Error Handling

**User Story:** As a StellarFlow user, I want to receive clear guidance when my browser blocks the Albedo popup so that I know exactly how to enable it and proceed.

#### Acceptance Criteria

1. WHEN invoking any Albedo intent causes an error whose message matches the pattern `/popup.*block|block.*popup/i` or whose error type is `"popup_blocked"`, THE `Albedo_Provider` SHALL treat the failure as a popup-blocker condition and display the message "Albedo popup was blocked. Please allow popups and try again."
2. WHEN a popup-blocker condition is detected, THE `Albedo_Provider` SHALL render the `Popup_Blocker_Modal` in addition to the primary dialog.
3. THE `Popup_Blocker_Modal` SHALL display the heading "Popup Blocked" and SHALL list browser-specific instructions for allowing popups for the current origin.
4. THE `Popup_Blocker_Modal` SHALL include a primary action button labeled "I've Enabled Popups — Retry" that dismisses the modal and re-invokes the blocked intent.
5. THE `Popup_Blocker_Modal` SHALL include a secondary action button labeled "Cancel" that dismisses the modal and transitions the `Albedo_Provider` back to the `idle` step.
6. IF the retry invocation also triggers a popup-blocker condition, THEN THE `Albedo_Provider` SHALL re-display the `Popup_Blocker_Modal` without incrementing a retry counter or otherwise limiting the number of retries.

---

### Requirement 7: Error Normalization and User Messaging

**User Story:** As a StellarFlow user, I want connection and signing errors to be presented in plain language so that I understand what went wrong and how to recover.

#### Acceptance Criteria

1. WHEN an Albedo intent throws an error, THE `Albedo_Provider` SHALL classify the error as one of: `popup_blocked`, `user_rejected`, or `unknown`.
2. WHEN the error classification is `user_rejected` (message matches `/reject|cancel|denied|user refused/i`), THE `Albedo_Provider` SHALL display the message "The request was cancelled in Albedo. Please try again."
3. WHEN the error classification is `unknown`, THE `Albedo_Provider` SHALL display the raw error message prefixed with "Albedo error: ".
4. WHEN the `Albedo_Provider` transitions to the `error` step, THE `Albedo_Provider` SHALL add a toast notification with the normalized error message and status `"failed"`.
5. THE `Albedo_Provider` SHALL display a "Retry" button in the `error` step that resets state to `idle` and allows the user to attempt connection again.

---

### Requirement 8: SSR Safety and Accessibility

**User Story:** As a StellarFlow developer, I want the Albedo provider to be safe for server-side rendering and accessible to keyboard and screen-reader users so that it meets the application's quality standards.

#### Acceptance Criteria

1. THE `Albedo_Provider` SHALL guard all `window`, `document`, and `@albedo-link/intent` invocations behind `typeof window !== "undefined"` checks so that Next.js server-side rendering does not throw.
2. THE `Albedo_Provider` SHALL be marked `"use client"` at the top of the file.
3. THE `Albedo_Provider` SHALL include `aria-live="polite"` regions for status updates so screen readers announce connection and signing progress.
4. THE `Popup_Blocker_Modal` SHALL have `role="alertdialog"` and `aria-describedby` pointing to its instruction text.
5. WHEN the `Albedo_Provider` dialog is open, THE `Albedo_Provider` SHALL not prevent existing keyboard focus-trap behavior provided by `OptimizedDialog`.
