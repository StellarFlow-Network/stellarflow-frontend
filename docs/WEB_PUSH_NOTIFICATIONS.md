# Web Push Notifications (#599)

Opt-in browser Web Push for executed swaps, filled limit orders, remittance payouts, and governance votes.

## Architecture

| Piece | Path |
|-------|------|
| Client service | `src/services/notifications.ts` |
| Preferences modal | `src/components/notifications/NotificationPreferencesModal.tsx` |
| Transaction details modal | `src/components/notifications/TransactionDetailsModal.tsx` |
| Deep-link provider | `src/components/notifications/PushNotificationProvider.tsx` |
| next-pwa push handlers | `worker/index.js` |
| Dev fallback SW | `public/sw-push.js` |
| API proxy | `src/app/api/push/subscribe` · `unsubscribe` |

## Flow

1. User opens **Settings → Push Notifications** (or `openPushPreferencesModal()`).
2. Master toggle requests `Notification` permission and creates a `PushManager` subscription with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
3. Subscription + category preferences are POSTed to `/api/push/subscribe` (proxied to `${NEXT_PUBLIC_API_URL}/push/subscribe` when configured).
4. Backend sends a Web Push payload:

```json
{
  "title": "Limit order filled",
  "body": "Sold 100 XLM for USDC",
  "type": "limit_order",
  "txHash": "abc…",
  "meta": { "pair": "XLM/USDC" }
}
```

5. The service worker shows the notification. On click it opens `/?tx=<hash>&type=<type>`.
6. `PushNotificationProvider` reads the query string and opens **Transaction details**.

## Preferences

| Toggle | Event `type` |
|--------|----------------|
| Swaps | `swap` |
| Limit Orders | `limit_order` |
| Governance Votes | `governance` |
| Remittance Payouts | `remittance` |
| Multisig Signature Requests | *(own deep link — see below)* |

Stored in `localStorage` (`sf.push.preferences.v1`) and synced with the subscription.

## Multisig co-signer alerts (#962)

Separate from transaction-outcome pushes: these tell a co-signer that a pending
multisig envelope is blocked on their signature.

| Piece | Path |
|-------|------|
| Notification service | `src/services/multisigNotifications.ts` |
| Provider (badge state + listeners) | `src/components/multisig/MultisigNotificationProvider.tsx` |
| Top-bar badge | `src/components/multisig/MultisigNotificationBadge.tsx` |
| Approval queue (filtered view) | `src/components/multisig/MultisigQueueView.tsx` |

Flow

1. A request arrives over `/ws` (`multisig_signature_request`), the in-app bus
   (`sf:multisig-signature-request`), or the service worker relay.
2. Requests addressed to another key are dropped; requests for the connected
   key increment the top-bar counter and are mirrored to
   `localStorage` (`sf.multisig.pending.v1`) for reloads and cross-tab sync.
3. If the **Multisig Signature Requests** toggle is on and permission is granted,
   a browser notification is raised (deduped per envelope id via its `tag`).
4. Clicking either the notification or the badge opens
   `/multisig?filter=pending[&request=<id>]`, which preselects the
   *Awaiting my signature* filter in the approval drawer.

Push payload (uses `url` instead of `txHash`/`type`):

```json
{
  "title": "🔑 Treasury Quarterly Liquidity Allocation",
  "body": "Elena (Lead Treasury) requested your signature on TX-MSIG-2048. Amount: 50,000.00 USDC. 2 of 3 signatures collected.",
  "url": "/multisig?filter=pending&request=TX-MSIG-2048",
  "type": "SF_MULTISIG_SIGNATURE_REQUEST",
  "request": { "id": "TX-MSIG-2048", "signerPublicKey": "G…", "status": "pending" }
}
```

Manual test checklist

1. Dispatch a request without a backend:
   `window.dispatchEvent(new CustomEvent('sf:multisig-signature-request', { detail: { id: 'TX-1', signerPublicKey: '<your key>', title: 'Test', description: '', category: 'operations', threshold: 3, collectedWeight: 1, requestedAt: new Date().toISOString(), status: 'pending' } }))`.
2. The badge counter increments immediately; clicking it opens the filtered queue.
3. Sign the envelope from the queue and confirm the counter drops.

## Environment

```bash
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<base64-url vapid public key>
```

Without `NEXT_PUBLIC_API_URL`, subscribe/unsubscribe still succeed locally (useful for UI development).

## Backend contract

- `POST /push/subscribe` — body `{ subscription, preferences, walletAddress }`
- `POST /push/unsubscribe` — body `{ endpoint, walletAddress }`

## Manual test checklist

1. Production build (`next-pwa` disabled in `development`): enable push, grant permission.
2. Toggle Swaps / Limit Orders / Governance independently.
3. Simulate a push (browser DevTools → Application → Service Workers → Push) with the JSON above.
4. Click the notification → transaction details modal opens for that `txHash`.
