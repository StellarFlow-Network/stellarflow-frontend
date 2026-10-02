/**
 * Multisig co-signer notification service (#962)
 *
 * Everything the {@link MultisigNotificationProvider} needs to alert a
 * co-signer that a pending multisig envelope is waiting on their signature:
 *
 *  - the {@link MultisigSignatureRequest} contract spoken by the realtime
 *    channel, the service-worker relay and the local demo seed,
 *  - the queue maths the top-bar badge renders (count / filter by signer),
 *  - the deep link that opens the multisig approval drawer filtered to the
 *    requests still awaiting *this* signer,
 *  - the Web Push payload + delivery helper, gated on the existing
 *    notification preferences so alerts stay opt-in.
 *
 * This module is intentionally dependency-free and side-effect-free at import
 * time so it can be unit tested with `node --test` (see
 * `multisigNotifications.test.ts`) and imported from both server-rendered and
 * client components. Browser APIs are only touched inside the helpers that
 * need them, and every one of those is guarded by a feature check.
 */

/** Lifecycle of an envelope from the point of view of one co-signer. */
export type MultisigSignatureRequestStatus =
  | "pending"
  | "approved"
  | "revoked"
  | "executed";

export type MultisigRequestCategory =
  | "treasury"
  | "operations"
  | "upgrade"
  | "emergency";

/**
 * A pending multisig transaction that is waiting on a specific co-signer.
 *
 * The backend only needs to know *who* must sign next, so the request carries
 * `signerPublicKey` rather than the whole co-signer roster: it is already
 * addressed to one signer and is therefore safe to fan out per key.
 */
export interface MultisigSignatureRequest {
  /** Envelope id, e.g. `TX-MSIG-2048`. Unique per transaction. */
  id: string;
  /** Public key of the co-signer this request is addressed to. */
  signerPublicKey: string;
  /** Public key of the signer who submitted the envelope. */
  initiatorPublicKey?: string;
  /** Human label for the initiator, when the backend knows it. */
  initiatorName?: string;
  title: string;
  description: string;
  category: MultisigRequestCategory;
  amount?: string;
  asset?: string;
  destination?: string;
  /** Signatures required to execute (weight or count). */
  threshold: number;
  /** Signatures already collected. */
  collectedWeight: number;
  /** ISO timestamp of when the signature request was raised. */
  requestedAt: string;
  expiresAt?: string;
  status: MultisigSignatureRequestStatus;
}

/** Structural subset of `NotificationPreferences` used to gate alerts. */
export interface MultisigAlertPreferences {
  enabled: boolean;
  multisigRequests?: boolean;
}

/** Everything the service worker needs to render + route the alert. */
export interface MultisigPushPayload {
  title: string;
  body: string;
  /** Collapses repeat alerts for the same envelope into one notification. */
  tag: string;
  /** Deep link opened when the notification is clicked. */
  url: string;
  data: {
    type: typeof MULTISIG_PUSH_MESSAGE_TYPE;
    requestId: string;
    signerPublicKey: string;
    url: string;
  };
}

/** Web Push wire format sent by the backend for a signature request. */
export interface MultisigPushEnvelope {
  type: typeof MULTISIG_PUSH_MESSAGE_TYPE;
  title?: string;
  body?: string;
  url?: string;
  request?: unknown;
}

/** Message type the service worker relays to open tabs. */
export const MULTISIG_PUSH_MESSAGE_TYPE = "SF_MULTISIG_SIGNATURE_REQUEST" as const;

/** In-app bus event raised for every new signature request. */
export const MULTISIG_REQUEST_EVENT = "sf:multisig-signature-request" as const;

/** In-app bus event raised when a request is signed, revoked or executed. */
export const MULTISIG_RESOLUTION_EVENT = "sf:multisig-signature-resolved" as const;

/** Realtime channel message types emitted by the backend socket. */
export const MULTISIG_SOCKET_REQUEST_TYPE = "multisig_signature_request" as const;
export const MULTISIG_SOCKET_RESOLUTION_TYPE = "multisig_signature_resolved" as const;

/** localStorage key mirroring the pending queue for reloads + cross-tab sync. */
export const MULTISIG_REQUESTS_STORAGE_KEY = "sf.multisig.pending.v1" as const;

export const MULTISIG_APPROVAL_PATH = "/multisig" as const;

/** `?filter=` value that narrows the queue to requests awaiting this signer. */
export const MULTISIG_PENDING_FILTER = "pending" as const;

/** Upper bound on tracked requests so a busy queue cannot grow unbounded. */
export const MAX_TRACKED_REQUESTS = 25;

/**
 * Placeholder co-signer key used by the demo envelopes on `/multisig`.
 *
 * The multisig queue ships with demo payloads that address this key; keeping
 * the constant here lets the badge count them for a visitor who has not
 * connected an extension yet, instead of showing an empty top bar.
 */
export const DEMO_CO_SIGNER_PUBLIC_KEY =
  "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXDV90210" as const;

export type MultisigQueueFilter = "all" | "pending";

export interface MultisigApprovalParams {
  filter: MultisigQueueFilter;
  requestId: string | null;
}

// ---------------------------------------------------------------------------
// Signer targeting + queue maths
// ---------------------------------------------------------------------------

/** Stellar keys are upper-case base32; compare them case/whitespace-insensitively. */
function normalizeKey(publicKey: string | null | undefined): string {
  return typeof publicKey === "string" ? publicKey.trim().toUpperCase() : "";
}

/**
 * Whether a request is addressed to `publicKey`.
 *
 * Requests for other co-signers must never reach this user's badge or inbox,
 * so every consumer filters through here first.
 */
export function isRequestTargetingSigner(
  request: Pick<MultisigSignatureRequest, "signerPublicKey">,
  publicKey: string | null | undefined,
): boolean {
  const target = normalizeKey(publicKey);
  if (!target) return false;
  return normalizeKey(request.signerPublicKey) === target;
}

/** True while the request is open *and* waiting on `publicKey`. */
export function isAwaitingSignature(
  request: MultisigSignatureRequest,
  publicKey: string | null | undefined,
): boolean {
  return (
    request.status === "pending" && isRequestTargetingSigner(request, publicKey)
  );
}

/**
 * Minimal shape of a queue envelope (see `MultisigTransaction`) needed to
 * decide whether this signer still has to approve it.
 */
export interface MultisigEnvelopeSignatureState {
  status: string;
  threshold: number;
  currentWeight: number;
  coSigners: readonly { publicKey: string; status: string }[];
}

/**
 * Whether `publicKey` still has to sign `envelope` before it can execute.
 *
 * Backs the "Awaiting my signature" queue filter the top-bar badge deep links
 * into: an envelope that already reached quorum is ready to broadcast, not
 * waiting on anyone.
 */
export function isEnvelopeAwaitingSigner(
  envelope: MultisigEnvelopeSignatureState,
  publicKey: string | null | undefined,
): boolean {
  const target = normalizeKey(publicKey);
  if (!target) return false;
  if (envelope.status !== "pending_signatures") return false;
  if (envelope.currentWeight >= envelope.threshold) return false;
  const signer = envelope.coSigners.find(
    (coSigner) => normalizeKey(coSigner.publicKey) === target,
  );
  return signer?.status === "pending";
}

/** Requests still awaiting this signer's approval, newest first. */
export function filterPendingSignatureRequests(
  requests: readonly MultisigSignatureRequest[],
  publicKey: string | null | undefined,
): MultisigSignatureRequest[] {
  return requests.filter((request) => isAwaitingSignature(request, publicKey));
}

/** Badge counter — number of pending transactions awaiting this signer. */
export function countPendingSignatureRequests(
  requests: readonly MultisigSignatureRequest[],
  publicKey: string | null | undefined,
): number {
  return filterPendingSignatureRequests(requests, publicKey).length;
}

function parseTimestamp(value: string | null | undefined): number {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Merge incoming requests into the tracked queue.
 *
 * Incoming entries win for a given id so a re-broadcast with updated
 * `collectedWeight` / `status` refreshes the existing row instead of
 * duplicating it, and the queue is capped to {@link MAX_TRACKED_REQUESTS}
 * (newest first).
 */
export function mergeSignatureRequests(
  current: readonly MultisigSignatureRequest[],
  incoming: readonly MultisigSignatureRequest[],
  max = MAX_TRACKED_REQUESTS,
): MultisigSignatureRequest[] {
  const byId = new Map<string, MultisigSignatureRequest>();
  for (const request of current) byId.set(request.id, request);
  for (const request of incoming) byId.set(request.id, request);

  return [...byId.values()]
    .sort(
      (a, b) => parseTimestamp(b.requestedAt) - parseTimestamp(a.requestedAt),
    )
    .slice(0, Math.max(0, max));
}

/** Drop a request from the queue (executed / rejected / expired). */
export function removeSignatureRequest(
  requests: readonly MultisigSignatureRequest[],
  requestId: string,
): MultisigSignatureRequest[] {
  return requests.filter((request) => request.id !== requestId);
}

/**
 * Record a decision taken in this tab so the badge drops immediately, without
 * waiting for the backend to echo the resolution back over the socket.
 */
export function markSignatureRequestResolved(
  requests: readonly MultisigSignatureRequest[],
  requestId: string,
  status: MultisigSignatureRequestStatus = "approved",
  collectedWeight?: number,
): MultisigSignatureRequest[] {
  return requests.map((request) =>
    request.id === requestId
      ? {
          ...request,
          status,
          collectedWeight:
            typeof collectedWeight === "number"
              ? collectedWeight
              : request.collectedWeight,
        }
      : request,
  );
}

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

/**
 * Deep link into the multisig approval drawer, filtered to pending requests.
 * `requestId` additionally focuses one envelope.
 */
export function buildMultisigApprovalDeepLink(
  requestId?: string | null,
): string {
  const params = new URLSearchParams({ filter: MULTISIG_PENDING_FILTER });
  const id = requestId?.trim();
  if (id) params.set("request", id);
  return `${MULTISIG_APPROVAL_PATH}?${params.toString()}`;
}

/**
 * Accepted shapes for the approval deep link: a query string, a
 * `URLSearchParams`, or the plain record Next.js hands a server component as
 * its `searchParams` prop.
 */
export type MultisigApprovalSearch =
  | string
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function toSearchParams(search: MultisigApprovalSearch): URLSearchParams {
  if (!search) return new URLSearchParams();
  if (typeof search === "string") {
    return new URLSearchParams(search.replace(/^\?/, ""));
  }
  if (typeof (search as URLSearchParams).get === "function") {
    return search as URLSearchParams;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(key, first);
  }
  return params;
}

/** Parse `?filter=&request=` off a URL search string, params object or record. */
export function parseMultisigApprovalParams(
  search: MultisigApprovalSearch,
): MultisigApprovalParams {
  const params = toSearchParams(search);

  const filter: MultisigQueueFilter =
    params.get("filter") === MULTISIG_PENDING_FILTER ? "pending" : "all";
  const requestId = params.get("request")?.trim() || null;

  return { filter, requestId };
}

/** Parse the `filter`/`request` params off a full URL (push click payloads). */
export function parseMultisigApprovalUrl(
  url: string | null | undefined,
): MultisigApprovalParams | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://stellarflow.local");
    if (!parsed.pathname.startsWith(MULTISIG_APPROVAL_PATH)) return null;
    return parseMultisigApprovalParams(parsed.search);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Push payload + delivery
// ---------------------------------------------------------------------------

function shortKey(publicKey: string | null | undefined): string | null {
  const key = normalizeKey(publicKey);
  if (key.length < 12) return key || null;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function formatAmount(request: MultisigSignatureRequest): string | null {
  if (!request.amount) return null;
  return [request.amount, request.asset].filter(Boolean).join(" ");
}

/** Build the browser notification shown when a signature request arrives. */
export function buildMultisigPushPayload(
  request: MultisigSignatureRequest,
): MultisigPushPayload {
  const url = buildMultisigApprovalDeepLink(request.id);
  const initiator =
    request.initiatorName?.trim() ||
    shortKey(request.initiatorPublicKey) ||
    "A co-signer";
  const amount = formatAmount(request);

  const body = [
    `${initiator} requested your signature on ${request.id}.`,
    amount ? `Amount: ${amount}.` : null,
    `${request.collectedWeight} of ${request.threshold} signatures collected.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `${
      request.category === "emergency" ? "🚨" : "🔑"
    } ${request.title}`,
    body,
    tag: `sf-multisig-${request.id}`,
    url,
    data: {
      type: MULTISIG_PUSH_MESSAGE_TYPE,
      requestId: request.id,
      signerPublicKey: request.signerPublicKey,
      url,
    },
  };
}

/**
 * Master gate for signature-request alerts.
 *
 * Mirrors `isMultisigRequestAlertsEnabled` in `./notifications` but typed
 * against the structural subset so this module stays import-free.
 */
export function isMultisigAlertEnabled(
  prefs: MultisigAlertPreferences | null | undefined,
): boolean {
  if (!prefs?.enabled) return false;
  return prefs.multisigRequests !== false;
}

/**
 * Show a browser notification for a new signature request.
 *
 * Resolves `false` (rather than throwing) whenever the alert cannot be shown —
 * unsupported browser, permission not granted, no service worker — because the
 * caller is a fire-and-forget realtime listener and a failed push must never
 * break the in-app badge.
 */
export async function notifySignerOfSignatureRequest(
  request: MultisigSignatureRequest,
  prefs: MultisigAlertPreferences | null | undefined,
): Promise<boolean> {
  if (!isMultisigAlertEnabled(prefs)) return false;
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  if (!("serviceWorker" in navigator)) return false;

  const payload = buildMultisigPushPayload(request);

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      data: { ...payload.data },
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

const REQUEST_STATUSES: readonly MultisigSignatureRequestStatus[] = [
  "pending",
  "approved",
  "revoked",
  "executed",
];

const REQUEST_CATEGORIES: readonly MultisigRequestCategory[] = [
  "treasury",
  "operations",
  "upgrade",
  "emergency",
];

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Validate an untrusted payload (socket frame, service-worker message or
 * cached JSON) into a {@link MultisigSignatureRequest}. Returns `null` when
 * the payload is missing fields the UI depends on.
 */
export function toSignatureRequest(
  value: unknown,
): MultisigSignatureRequest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const id = asString(raw.id);
  const signerPublicKey = asString(raw.signerPublicKey);
  const requestedAt = asString(raw.requestedAt);
  if (!id || !signerPublicKey || !requestedAt) return null;

  const status = REQUEST_STATUSES.includes(
    raw.status as MultisigSignatureRequestStatus,
  )
    ? (raw.status as MultisigSignatureRequestStatus)
    : "pending";

  const category = REQUEST_CATEGORIES.includes(
    raw.category as MultisigRequestCategory,
  )
    ? (raw.category as MultisigRequestCategory)
    : "operations";

  return {
    id,
    signerPublicKey,
    initiatorPublicKey: asString(raw.initiatorPublicKey) ?? undefined,
    initiatorName: asString(raw.initiatorName) ?? undefined,
    title: asString(raw.title) ?? id,
    description: asString(raw.description) ?? "",
    category,
    amount: asString(raw.amount) ?? undefined,
    asset: asString(raw.asset) ?? undefined,
    destination: asString(raw.destination) ?? undefined,
    threshold: Math.max(1, asNumber(raw.threshold, 1)),
    collectedWeight: Math.max(0, asNumber(raw.collectedWeight, 0)),
    requestedAt,
    expiresAt: asString(raw.expiresAt) ?? undefined,
    status,
  };
}

function toRequestId(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  if (value && typeof value === "object") {
    return asString((value as Record<string, unknown>).requestId);
  }
  return null;
}

/**
 * Decode a realtime socket frame.
 *
 * The transport forwards `{ type, data }` envelopes, so this normalises both
 * the `multisig_signature_request` and `multisig_signature_resolved` frames and
 * returns `null` for anything else (price ticks, order book snapshots…).
 */
export function parseMultisigSocketEvent(
  raw: unknown,
):
  | { request: MultisigSignatureRequest; resolvedRequestId?: undefined }
  | { request?: undefined; resolvedRequestId: string }
  | null {
  if (!raw || typeof raw !== "object") return null;
  const message = raw as { type?: unknown; data?: unknown };

  if (message.type === MULTISIG_SOCKET_REQUEST_TYPE) {
    const request = toSignatureRequest(message.data);
    return request ? { request } : null;
  }

  if (message.type === MULTISIG_SOCKET_RESOLUTION_TYPE) {
    const resolvedRequestId = toRequestId(message.data);
    return resolvedRequestId ? { resolvedRequestId } : null;
  }

  return null;
}

/** Decode a service-worker `SF_MULTISIG_SIGNATURE_REQUEST` message. */
export function parseServiceWorkerSignatureRequest(
  raw: unknown,
): MultisigSignatureRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const message = raw as Partial<MultisigPushEnvelope>;
  if (message.type !== MULTISIG_PUSH_MESSAGE_TYPE) return null;
  return toSignatureRequest(message.request);
}

// ---------------------------------------------------------------------------
// Persistence (reload + cross-tab)
// ---------------------------------------------------------------------------

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Private browsing / sandboxed frame.
    return null;
  }
}

/** Parse the cached queue JSON into validated requests (never throws). */
export function parseSignatureRequests(raw: string | null | undefined): MultisigSignatureRequest[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { requests?: unknown })?.requests)
      ? ((parsed as { requests: unknown[] }).requests)
      : [];
    return list
      .map(toSignatureRequest)
      .filter((request): request is MultisigSignatureRequest => request !== null);
  } catch {
    return [];
  }
}

export function loadCachedSignatureRequests(
  storage?: Storage | null,
): MultisigSignatureRequest[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    return parseSignatureRequests(store.getItem(MULTISIG_REQUESTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveCachedSignatureRequests(
  requests: readonly MultisigSignatureRequest[],
  storage?: Storage | null,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(
      MULTISIG_REQUESTS_STORAGE_KEY,
      JSON.stringify(requests.slice(0, MAX_TRACKED_REQUESTS)),
    );
  } catch {
    // Quota exceeded — the in-memory queue still drives the badge.
  }
}

// ---------------------------------------------------------------------------
// In-app realtime bus
// ---------------------------------------------------------------------------

type SignatureRequestHandler = (request: MultisigSignatureRequest) => void;
type SignatureResolutionHandler = (requestId: string) => void;

export interface SignatureRequestHandlers {
  onRequest?: SignatureRequestHandler;
  onResolution?: SignatureResolutionHandler;
}

function resolveEventTarget(target?: EventTarget | null): EventTarget | null {
  if (target) return target;
  if (typeof window === "undefined") return null;
  return window;
}

/** Announce a new signature request to every listener in this tab. */
export function publishSignatureRequest(
  request: MultisigSignatureRequest,
  target?: EventTarget | null,
): void {
  const bus = resolveEventTarget(target);
  if (!bus || typeof CustomEvent === "undefined") return;
  bus.dispatchEvent(
    new CustomEvent(MULTISIG_REQUEST_EVENT, { detail: request }),
  );
}

/** Announce that a request no longer needs this signer. */
export function publishSignatureResolution(
  requestId: string,
  target?: EventTarget | null,
): void {
  const bus = resolveEventTarget(target);
  if (!bus || typeof CustomEvent === "undefined") return;
  bus.dispatchEvent(
    new CustomEvent(MULTISIG_RESOLUTION_EVENT, { detail: requestId }),
  );
}

/**
 * Subscribe to signature-request traffic.
 *
 * Three sources feed the same handlers:
 *  1. `CustomEvent`s raised in this tab by {@link publishSignatureRequest},
 *  2. `storage` events from another tab writing the shared queue,
 *  3. (via {@link subscribeToServiceWorkerSignatureRequests}) pushes relayed
 *     by the service worker.
 *
 * `target` exists so tests can drive the bus with a bare `EventTarget`
 * instead of a DOM `window`.
 */
export function subscribeToSignatureRequestEvents(
  handlers: SignatureRequestHandlers,
  target?: EventTarget | null,
): () => void {
  const bus = resolveEventTarget(target);
  if (!bus) return () => {};
  const usingWindowBus = !target;

  const onRequestEvent = (event: Event) => {
    const request = toSignatureRequest((event as CustomEvent).detail);
    if (request) handlers.onRequest?.(request);
  };

  const onResolutionEvent = (event: Event) => {
    const requestId = toRequestId((event as CustomEvent).detail);
    if (requestId) handlers.onResolution?.(requestId);
  };

  const onStorageEvent = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key !== MULTISIG_REQUESTS_STORAGE_KEY) return;
    for (const request of parseSignatureRequests(storageEvent.newValue)) {
      handlers.onRequest?.(request);
    }
  };

  bus.addEventListener(MULTISIG_REQUEST_EVENT, onRequestEvent);
  bus.addEventListener(MULTISIG_RESOLUTION_EVENT, onResolutionEvent);
  if (usingWindowBus && handlers.onRequest) {
    bus.addEventListener("storage", onStorageEvent);
  }

  return () => {
    bus.removeEventListener(MULTISIG_REQUEST_EVENT, onRequestEvent);
    bus.removeEventListener(MULTISIG_RESOLUTION_EVENT, onResolutionEvent);
    if (usingWindowBus && handlers.onRequest) {
      bus.removeEventListener("storage", onStorageEvent);
    }
  };
}

/**
 * Listen for signature requests re-broadcast by the service worker while a tab
 * is open (the notification is shown either way).
 */
export function subscribeToServiceWorkerSignatureRequests(
  onRequest: SignatureRequestHandler,
): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }
  const handler = (event: MessageEvent) => {
    const request = parseServiceWorkerSignatureRequest(event.data);
    if (request) onRequest(request);
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () =>
    navigator.serviceWorker.removeEventListener("message", handler);
}

// ---------------------------------------------------------------------------
// Demo seed
// ---------------------------------------------------------------------------

/**
 * Whether the app is running without a backend, following the demo-mode
 * convention used by the remittance status page (`!NEXT_PUBLIC_API_URL`).
 * Drives the demo seed default in {@link MultisigNotificationProvider}.
 */
export function isMultisigDemoMode(
  apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): boolean {
  return !apiUrl;
}

/**
 * Demo signature requests.
 *
 * There is no backend endpoint yet that streams "multisig envelopes awaiting
 * your signature" for a public key, so — following the same convention as
 * `lib/demoPendingTransactions.ts` — the queue is seeded with two realistic
 * envelopes addressed to the connected signer. Replace this with the real
 * subscription (`subscribeToSignatureRequestEvents` / socket frames) once the
 * backend emits them; only the seed disappears, the provider is unchanged.
 */
export function buildDemoSignatureRequests(
  signerPublicKey: string | null | undefined,
  now: number = Date.now(),
): MultisigSignatureRequest[] {
  const target = normalizeKey(signerPublicKey) || DEMO_CO_SIGNER_PUBLIC_KEY;
  const at = (ageMs: number) => new Date(now - ageMs).toISOString();

  return [
    {
      id: "TX-MSIG-2048",
      signerPublicKey: target,
      initiatorPublicKey:
        "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      initiatorName: "Elena (Lead Treasury)",
      title: "Treasury Quarterly Liquidity Allocation",
      description:
        "Disburse 50,000 USDC from the reserve multisig into StellarFlow AMM Pool #4 (USDC/XLM).",
      category: "treasury",
      amount: "50,000.00",
      asset: "USDC",
      destination:
        "GBUSDCPOOLRESERVE777XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX492",
      threshold: 3,
      collectedWeight: 2,
      requestedAt: at(25 * 60_000),
      expiresAt: new Date(now + 20 * 60 * 60_000).toISOString(),
      status: "pending",
    },
    {
      id: "TX-MSIG-7721",
      signerPublicKey: target,
      initiatorPublicKey:
        "GCIXQ7BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ94827104ABC",
      initiatorName: "Marcus (Security Officer)",
      title: "Relayer Reserve Top-Up & Gas Subsidies",
      description:
        "Transfer 5,000 XLM to bridge relayers for sponsored transaction fee coverage.",
      category: "operations",
      amount: "5,000.00",
      asset: "XLM",
      destination:
        "GARELAYERGASPOOL999XXXXXXXXXXXXXXXXXXXXXXXXXXXXX1028",
      threshold: 3,
      collectedWeight: 1,
      requestedAt: at(60 * 60_000),
      status: "pending",
    },
  ];
}
