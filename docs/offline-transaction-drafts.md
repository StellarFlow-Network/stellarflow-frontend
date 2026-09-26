# Offline transaction drafts & auto-sync (issue #995)

Users on weak mobile networks can compose a transaction, lose connectivity, and
still keep everything they entered. Drafts are written to IndexedDB, an
"Offline Draft Saved" banner confirms it, and when connectivity comes back the
app prompts the user to submit the queued drafts.

## Architecture

| Layer | File | Responsibility |
| --- | --- | --- |
| Storage + sync engine | `src/lib/OfflineTransactionQueue.ts` | IndexedDB driver, draft records, retry bookkeeping, external store |
| React binding | `src/app/hooks/useOfflineDraftQueue.ts` | Restores drafts, re-arms/opens the reconnect prompt, exposes actions |
| Banner | `src/components/offline/OfflineDraftBanner.tsx` | "Offline Draft Saved" notification |
| Reconnect prompt | `src/components/offline/OfflineDraftSyncModal.tsx` | "Connection restored — N drafts waiting" modal |
| Queue drawer | `src/components/offline/OfflineDraftQueueDrawer.tsx` | Review / submit / delete pending drafts |
| Global mount | `src/components/offline/OfflineDraftSyncRoot.tsx` | Mounted once in `src/app/layout.tsx` |

## Storage

* Database: `stellarflow-offline-queue` (version 1)
* Object store: `transaction_drafts`, `keyPath: "id"`
* Indexes: `by-created-at` (`createdAt`), `by-status` (`status`)

Drafts are keyed by `draft_<uuid>`, carry the composed `params` verbatim, and
expire after `DEFAULT_DRAFT_TTL_MS` (7 days). A draft left in the transient
`syncing` state by a page reload is recovered back to `pending` on the next
`hydrate()`, so an interrupted submission is never lost.

## Composing offline (integration point)

Compose flows persist their parameters with one call — nothing is queued in
memory only:

```ts
const { saveDraftIfOffline } = useOfflineDraftQueue();

// Wrap the "submit" button handler: while offline the draft is persisted and
// the banner appears; while online the normal signing flow runs.
async function handleSubmit() {
  const draft = await saveDraftIfOffline({
    kind: "swap",
    network: "testnet",
    sourceAccount: publicKey,
    label: `Swap ${amountIn} ${assetIn} → ${assetOut}`,
    params: { amountIn, assetIn, assetOut, slippageBps, path },
  });

  if (draft) return; // saved offline — sync engine takes over

  await submitToWallet();
}
```

`saveDraftIfOffline` returns `null` when the browser is online, so it is safe to
call unconditionally. Use `saveDraft(...)` or `{ force: true }` when a compose
flow wants to queue a draft regardless of connectivity.

## Submitting queued drafts

The queue cannot know how a given flow signs and broadcasts (Freighter, xBull,
Ledger, ...), so submission is a pluggable handler registered by that flow:

```ts
const { registerSubmitHandler } = useOfflineDraftQueue();

useEffect(
  () =>
    registerSubmitHandler("swap", async (draft) => {
      const { hash } = await signAndBroadcast(draft.params);
      return hash;
    }),
  [registerSubmitHandler],
);
```

* Success deletes the draft from IndexedDB and records the transaction hash.
* A thrown error increments `attempts` and keeps the draft `pending` until
  `MAX_DRAFT_ATTEMPTS` (5) is reached, then the draft is marked `failed`.
* A draft whose kind has no registered handler is reported as `no-handler` and
  is **not** counted as a submission attempt — it stays queued untouched.
* A `"*"` handler acts as the fallback for every kind.

## Tests

```bash
node --experimental-strip-types --test src/lib/OfflineTransactionQueue.test.ts
```

The suite covers validation, expiry, sorting/counting, persistence across a
simulated reload, interrupted-submission recovery, purge, retry/attempt
semantics, batch sync and every store action. It runs against the in-memory
driver, which implements the same `OfflineQueueDriver` contract as the IndexedDB
driver.
