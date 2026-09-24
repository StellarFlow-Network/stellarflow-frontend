# Automated Portfolio Email Reports

Opt-in delivery of a periodic portfolio performance summary by email (#979).

- **Panel:** `src/components/portfolio/EmailReportSettings.tsx`
- **Service:** `src/services/emailReports.ts`
- **Tests:** `src/services/emailReports.test.ts`

## What the user can do

| Action | Where |
| --- | --- |
| Enter the report address | Email field on the panel |
| Prove they own the mailbox | "Send code" → 6-digit one-time code → "Verify" |
| Choose a cadence | `Weekly Summary` (every Monday 08:00 UTC) or `Monthly Statement` (1st, 08:00 UTC) |
| Choose the contents | `Token Balances`, `Earned Yield`, `Remittance Summary` — at least one |
| Subscribe / update | "Subscribe" / "Update subscription", signed by the wallet |
| Cancel | "Cancel subscription", also signed by the wallet |

## The subscription is wallet-signed

Nothing is stored until the wallet signs a canonical message. The backend can
rebuild the same bytes and recover the signer, so a subscription can only have
been authorised by the wallet that owns the report — and only a wallet can cancel
one, which stops an attacker from silently opting a victim out.

```
StellarFlow Portfolio Email Reports
Action: subscribe | update | cancel
Wallet: G…
Email: trader@example.com
Frequency: weekly | monthly
Contents: tokenBalances,earnedYield
Issued At: 2026-09-24T17:00:00.000Z
Nonce: 0f2c…
```

Every field is a raw value and the sections are in canonical order, so both
sides produce identical bytes. `Nonce` is fresh per request and `Issued At` is
part of the message, so a captured signature cannot be replayed.

Signing uses Freighter's message-signing primitive (`signMessage`) — no
transaction is built and no key material leaves the extension. The wallet
address comes from the `walletAddress` prop when the panel is rendered inside a
provider, and otherwise from the persisted key
(`stellarflow.wallet.publicKey`, `localStorage` then `sessionStorage`), matching
`WalletProvider`.

## Rules the panel enforces

- **A one-time code is required before saving** — but only for a *new* address.
  An address that was already verified in this session stays verified. Changing
  the address clears the verification, so a code sent to `attacker@example.com`
  can never authorise a subscription to `victim@example.com`.
- **Codes expire.** `OTP_TTL_MS` (10 minutes) after they are sent; an absent,
  malformed, or past expiry counts as expired.
- **A code is exactly six digits.** `isValidOtpCode` never truncates, so `1234567`
  is rejected rather than read as `123456`.
- **Reports are never empty.** `toggleSection` refuses to remove the last
  remaining section, and the corresponding checkbox is disabled while it is the
  last one.
- **The signed payload must match the settings.** `submitEmailReportSubscription`
  compares the signed email to the settings being saved and aborts before any
  request is sent if they differ.

## Backend contract

All requests go to `${NEXT_PUBLIC_API_URL}/api/email-reports` (same-origin when
the variable is unset), matching `src/lib/api/delegates.ts`.

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/otp` | `{ email }` → `{ expiresAt? }` |
| `POST` | `/otp/verify` | `{ email, code }` → `{ token?, expiresAt? }` |
| `POST` | `/subscriptions` | `{ action, email, frequency, sections, verificationToken, address, issuedAt, nonce, signature }` → `{ id?, updatedAt? }` |
| `DELETE` | `/subscriptions` | `{ action: "cancel", email, address, issuedAt, nonce, signature }` |

The last acknowledged subscription is cached under
`sf.emailReports.subscription.v1` so the panel can show and manage an existing
report without a round trip. A corrupt or address-less cached value is ignored
rather than surfaced as an error, and every storage access is guarded by
`typeof window`, so the module is safe to import from a Server Component.

## Testing

The repo has no configured unit-test runner, so the service tests run directly on
Node's built-in runner:

```bash
node --experimental-strip-types --test src/services/emailReports.test.ts
```

The service test injects its own `window`, `localStorage`, and `fetch`, so it
needs no browser and no network. The panel itself was verified against jsdom
driving the full lifecycle (request → verify → subscribe → update → cancel)
with a Freighter stub; see the PR description for the harness transcript.
