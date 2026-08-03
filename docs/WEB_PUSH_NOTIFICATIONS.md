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

Stored in `localStorage` (`sf.push.preferences.v1`) and synced with the subscription.

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
