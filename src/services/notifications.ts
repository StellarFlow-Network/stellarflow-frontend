/**
 * Web Push notification service (#599)
 *
 * Opt-in browser push for executed swaps, filled limit orders,
 * remittance payouts, and governance vote outcomes.
 *
 * Handles permission, PushManager subscription, preference persistence,
 * and backend registration of the subscription endpoint.
 */

export type PushAlertCategory =
  | "swaps"
  | "limitOrders"
  | "governanceVotes"
  | "remittancePayouts";

export type PushEventType =
  | "swap"
  | "limit_order"
  | "remittance"
  | "governance";

export interface NotificationPreferences {
  /** Master switch — must be true for any push to be delivered. */
  enabled: boolean;
  swaps: boolean;
  limitOrders: boolean;
  governanceVotes: boolean;
  remittancePayouts: boolean;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  type: PushEventType;
  txHash: string;
  /** Optional extra fields for the details modal */
  meta?: Record<string, string | number | boolean | null>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  swaps: true,
  limitOrders: true,
  governanceVotes: false,
  remittancePayouts: true,
};

const PREFS_STORAGE_KEY = "sf.push.preferences.v1";
const SUB_STORAGE_KEY = "sf.push.subscription.v1";

/** Map alert category → push event type for deep links / filtering. */
export const CATEGORY_TO_EVENT: Record<PushAlertCategory, PushEventType> = {
  swaps: "swap",
  limitOrders: "limit_order",
  governanceVotes: "governance",
  remittancePayouts: "remittance",
};

export const EVENT_TO_CATEGORY: Record<PushEventType, PushAlertCategory> = {
  swap: "swaps",
  limit_order: "limitOrders",
  governance: "governanceVotes",
  remittance: "remittancePayouts",
};

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function loadPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return normalizePreferences(parsed);
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export function savePreferences(prefs: NotificationPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(normalizePreferences(prefs)));
}

export function normalizePreferences(
  input: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    enabled: Boolean(input?.enabled),
    swaps: input?.swaps ?? true,
    limitOrders: input?.limitOrders ?? true,
    governanceVotes: input?.governanceVotes ?? false,
    remittancePayouts: input?.remittancePayouts ?? true,
  };
}

/** Whether a given push event type is allowed by current preferences. */
export function isCategoryEnabled(
  prefs: NotificationPreferences,
  type: PushEventType,
): boolean {
  if (!prefs.enabled) return false;
  const category = EVENT_TO_CATEGORY[type];
  return Boolean(prefs[category]);
}

/**
 * Build the deep-link path opened when a notification is clicked.
 * Consumed by PushNotificationProvider + TransactionDetailsModal.
 */
export function buildNotificationDeepLink(payload: Pick<PushPayload, "txHash" | "type">): string {
  const params = new URLSearchParams({
    tx: payload.txHash,
    type: payload.type,
  });
  return `/?${params.toString()}`;
}

export function parseNotificationDeepLink(
  search: string | URLSearchParams,
): { txHash: string; type: PushEventType } | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  const txHash = params.get("tx");
  const type = params.get("type") as PushEventType | null;
  if (!txHash || !type) return null;
  if (!["swap", "limit_order", "remittance", "governance"].includes(type)) return null;
  return { txHash, type };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function subscriptionToJSON(sub: PushSubscription): PushSubscriptionJSON {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
  };
}

function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

function getPushApiBase(): string {
  // Prefer same-origin Next API routes which proxy to the backend.
  return "/api/push";
}

async function postSubscription(
  path: "subscribe" | "unsubscribe",
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${getPushApiBase()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Push ${path} failed (${res.status}): ${text || res.statusText}`);
  }
}

/**
 * Ensure a service worker is ready. Prefer next-pwa's generated worker;
 * fall back to registering /sw.js if present.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) {
    throw new Error("Web Push is not supported in this browser");
  }
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  // next-pwa emits /sw.js in production; in development it may be disabled.
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // Custom push-only worker shipped with this feature
    return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
  }
}

export async function getExistingSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    return subscriptionToJSON(sub);
  } catch {
    return null;
  }
}

/**
 * Request permission, subscribe via PushManager, and register with the backend.
 */
export async function subscribeToPush(
  prefs: NotificationPreferences = loadPreferences(),
  walletAddress?: string | null,
): Promise<PushSubscriptionJSON> {
  if (!isPushSupported()) {
    throw new Error("Web Push is not supported in this browser");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const vapidKey = getVapidPublicKey();
  if (!vapidKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY — cannot create a push subscription",
    );
  }

  const registration = await ensureServiceWorker();
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  const json = subscriptionToJSON(subscription);
  const normalized = normalizePreferences({ ...prefs, enabled: true });
  savePreferences(normalized);

  await postSubscription("subscribe", {
    subscription: json,
    preferences: normalized,
    walletAddress: walletAddress ?? null,
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(json));
  }

  return json;
}

export async function unsubscribeFromPush(
  walletAddress?: string | null,
): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  const endpoint =
    subscription?.endpoint ??
    (typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem(SUB_STORAGE_KEY) || "null") as PushSubscriptionJSON | null)
          ?.endpoint
      : null);

  if (subscription) {
    await subscription.unsubscribe().catch(() => undefined);
  }

  if (endpoint) {
    await postSubscription("unsubscribe", {
      endpoint,
      walletAddress: walletAddress ?? null,
    }).catch(() => undefined);
  }

  const prefs = loadPreferences();
  savePreferences({ ...prefs, enabled: false });
  if (typeof window !== "undefined") {
    localStorage.removeItem(SUB_STORAGE_KEY);
  }
}

/**
 * Persist preference toggles and sync to backend when subscribed.
 */
export async function updatePushPreferences(
  prefs: NotificationPreferences,
  walletAddress?: string | null,
): Promise<NotificationPreferences> {
  const normalized = normalizePreferences(prefs);
  savePreferences(normalized);

  const sub = await getExistingSubscription();
  if (sub && normalized.enabled) {
    await postSubscription("subscribe", {
      subscription: sub,
      preferences: normalized,
      walletAddress: walletAddress ?? null,
    });
  } else if (!normalized.enabled && sub) {
    await unsubscribeFromPush(walletAddress);
  }

  return normalized;
}

/** Human-readable labels for the preferences UI. */
export const PREFERENCE_LABELS: Record<
  Exclude<keyof NotificationPreferences, "enabled">,
  { title: string; description: string }
> = {
  swaps: {
    title: "Swaps",
    description: "Alert when a swap executes successfully.",
  },
  limitOrders: {
    title: "Limit Orders",
    description: "Alert when a limit order is filled.",
  },
  governanceVotes: {
    title: "Governance Votes",
    description: "Alert when your governance vote is confirmed.",
  },
  remittancePayouts: {
    title: "Remittance Payouts",
    description: "Alert when a remittance payout completes.",
  },
};
