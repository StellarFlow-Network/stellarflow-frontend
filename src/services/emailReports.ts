/**
 * Automated portfolio performance report service (#979)
 *
 * Opt-in email delivery of a periodic portfolio performance summary. This module
 * owns the parts that must not live in JSX: address validation, email OTP
 * verification, preference persistence, and the wallet-signed subscription
 * handshake with the backend.
 *
 * Trust boundary
 * ──────────────
 * The backend trusts nothing the client claims. Every subscribe / update /
 * cancel carries a signature over a canonical, replay-resistant message
 * (`buildReportSignatureMessage`), so a request can only have been authorised by
 * the wallet that owns the report. The message is signed with the wallet's
 * message-signing primitive — no transaction is built and no key material ever
 * leaves the extension.
 *
 * Canonical signed message (exactly these lines, `\n` separated, raw enum
 * values so a verifier can rebuild it byte-for-byte):
 *
 * ```
 * StellarFlow Portfolio Email Reports
 * Action: subscribe
 * Wallet: G…
 * Email: trader@example.com
 * Frequency: weekly
 * Contents: tokenBalances,earnedYield
 * Issued At: 2026-09-24T17:00:00.000Z
 * Nonce: 0f2c…
 * ```
 */

export type ReportFrequency = "weekly" | "monthly";

export type ReportSection =
  | "tokenBalances"
  | "earnedYield"
  | "remittanceSummary";

export type ReportAction = "subscribe" | "update" | "cancel";

export interface EmailReportSettings {
  /** Normalized (trimmed, lower-cased) address the report is emailed to. */
  email: string;
  frequency: ReportFrequency;
  /** At least one section is always selected — an empty report is not a report. */
  sections: ReportSection[];
}

/** Proof that the user controls the mailbox they are subscribing. */
export interface EmailReportVerification {
  email: string;
  /** Server-issued token echoed back with the signed subscription request. */
  token: string | null;
  verifiedAt: string;
  expiresAt: string;
}

/** A subscription the backend has acknowledged and a wallet has authorised. */
export interface EmailReportSubscription extends EmailReportSettings {
  /** Backend subscription id; null when the deployment stores by email only. */
  id: string | null;
  /** Wallet that authorised the subscription. */
  address: string;
  updatedAt: string;
}

/** The exact bytes a wallet signs for one subscription action. */
export interface ReportSignaturePayload {
  action: ReportAction;
  address: string;
  email: string;
  frequency: ReportFrequency;
  sections: ReportSection[];
  issuedAt: string;
  /** Replay guard: a fresh random value per signed request. */
  nonce: string;
}

export interface SignedReportRequest {
  payload: ReportSignaturePayload;
  /** The canonical message the signature covers. */
  message: string;
  /** base64 message signature, recoverable to `payload.address`. */
  signature: string;
}

export interface SubmitReportRequest {
  settings: EmailReportSettings;
  /** OTP token when the address was verified in this session; null otherwise. */
  verificationToken: string | null;
  signed: SignedReportRequest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_FREQUENCIES: readonly ReportFrequency[] = ["weekly", "monthly"];

export const REPORT_SECTIONS: readonly ReportSection[] = [
  "tokenBalances",
  "earnedYield",
  "remittanceSummary",
];

export const FREQUENCY_LABELS: Record<
  ReportFrequency,
  { title: string; cadence: string; description: string }
> = {
  weekly: {
    title: "Weekly Summary",
    cadence: "every Monday",
    description: "A short recap of the previous seven days, sent every Monday 08:00 UTC.",
  },
  monthly: {
    title: "Monthly Statement",
    cadence: "on the 1st",
    description: "A full statement for the calendar month, sent on the 1st at 08:00 UTC.",
  },
};

export const SECTION_LABELS: Record<
  ReportSection,
  { title: string; description: string }
> = {
  tokenBalances: {
    title: "Token Balances",
    description: "Closing balances and 24h change for every asset you hold.",
  },
  earnedYield: {
    title: "Earned Yield",
    description: "Yield accrued across vaults, liquidity pools, and staking positions.",
  },
  remittanceSummary: {
    title: "Remittance Summary",
    description: "Corridor totals, fees paid, and completed payouts.",
  },
};

export const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  "tokenBalances",
  "earnedYield",
];

export const DEFAULT_EMAIL_REPORT_SETTINGS: EmailReportSettings = {
  email: "",
  frequency: "weekly",
  sections: [...DEFAULT_REPORT_SECTIONS],
};

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_EMAIL_LENGTH = 254;

const SUBSCRIPTION_STORAGE_KEY = "sf.emailReports.subscription.v1";
const WALLET_STORAGE_KEY = "stellarflow.wallet.publicKey";

/** Deliberately conservative: no display names, no bare domains, no spaces. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — the whole preference model, testable without a DOM or network
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return email.length >= 3 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

export function isReportFrequency(value: unknown): value is ReportFrequency {
  return typeof value === "string" && (REPORT_FREQUENCIES as readonly string[]).includes(value);
}

/** Keep the selection in canonical order and always non-empty. */
export function normalizeSections(input: unknown): ReportSection[] {
  const list = Array.isArray(input) ? input : [];
  const selected = REPORT_SECTIONS.filter((section) => list.includes(section));
  return selected.length > 0 ? selected : [...DEFAULT_REPORT_SECTIONS];
}

export function normalizeEmailReportSettings(
  input?: Partial<EmailReportSettings> | null,
): EmailReportSettings {
  return {
    email: normalizeEmail(input?.email ?? ""),
    frequency: isReportFrequency(input?.frequency)
      ? input.frequency
      : DEFAULT_EMAIL_REPORT_SETTINGS.frequency,
    sections: normalizeSections(input?.sections),
  };
}

/**
 * Add or remove one section. Removing the last remaining section is a no-op:
 * a report with no contents is not a report, and silently sending an empty
 * email every week is worse than refusing the change.
 */
export function toggleSection(
  sections: ReportSection[],
  section: ReportSection,
): ReportSection[] {
  const current = REPORT_SECTIONS.filter((candidate) => sections.includes(candidate));
  if (current.includes(section)) {
    return current.length <= 1 ? current : current.filter((c) => c !== section);
  }
  return REPORT_SECTIONS.filter((c) => current.includes(c) || c === section);
}

/** Strip everything that is not a digit and clip to the code length. */
export function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}
/**
 * A code is valid only when the raw value carries exactly `OTP_CODE_LENGTH`
 * digits. Separators are tolerated — people paste "123 456" from an email — but
 * unlike `normalizeOtpCode` this never truncates, so a seven-digit typo is
 * rejected rather than silently accepted as the first six digits.
 */
export function isValidOtpCode(value: string | null | undefined): boolean {
  return String(value ?? "").replace(/\D/g, "").length === OTP_CODE_LENGTH;
}

/** An absent, malformed, or past expiry counts as expired (fail closed). */
export function isOtpExpired(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return true;
  const at = Date.parse(expiresAt);
  return !Number.isFinite(at) || at <= nowMs;
}

export interface SubscriptionReadiness {
  ready: boolean;
  problems: string[];
}

/**
 * Everything that must hold before a subscription may be signed and saved.
 * Returns every problem, not just the first, so the UI can be specific.
 */
export function assessSubscriptionReadiness(
  settings: EmailReportSettings,
  verifiedEmail: string | null,
  address: string | null,
): SubscriptionReadiness {
  const problems: string[] = [];
  const email = normalizeEmail(settings.email);

  if (email === "") {
    problems.push("Enter the email address the report should be sent to.");
  } else if (!isValidEmail(email)) {
    problems.push("Enter a valid email address, for example trader@example.com.");
  }

  if (verifiedEmail === null) {
    problems.push("Verify the email address with the one-time code before saving.");
  } else if (normalizeEmail(verifiedEmail) !== email) {
    problems.push("The verified address no longer matches — verify the new address.");
  }

  if (normalizeSections(settings.sections).length === 0) {
    problems.push("Select at least one report section.");
  }

  if (!address) {
    problems.push("Connect a wallet to sign the subscription.");
  }

  return { ready: problems.length === 0, problems };
}

/**
 * Canonical message a wallet signs for one action. Every field is a raw value
 * so the backend can rebuild byte-for-byte — the signature is only meaningful
 * if both sides produce the same bytes.
 */
export function buildReportSignatureMessage(payload: ReportSignaturePayload): string {
  const sections = normalizeSections(payload.sections);
  return [
    "StellarFlow Portfolio Email Reports",
    `Action: ${payload.action}`,
    `Wallet: ${payload.address}`,
    `Email: ${normalizeEmail(payload.email)}`,
    `Frequency: ${payload.frequency}`,
    `Contents: ${sections.join(",")}`,
    `Issued At: ${payload.issuedAt}`,
    `Nonce: ${payload.nonce}`,
  ].join("\n");
}

export function createReportNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createReportSignaturePayload(
  action: ReportAction,
  settings: EmailReportSettings,
  address: string,
  nowMs: number = Date.now(),
  nonce: string = createReportNonce(),
): ReportSignaturePayload {
  const normalized = normalizeEmailReportSettings(settings);
  return {
    action,
    address,
    email: normalized.email,
    frequency: normalized.frequency,
    sections: normalized.sections,
    issuedAt: new Date(nowMs).toISOString(),
    nonce,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Local persistence — the last known subscription, so the panel can show and
// manage an existing report without a round trip on every render.
// ─────────────────────────────────────────────────────────────────────────────

export function loadEmailReportSubscription(): EmailReportSubscription | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EmailReportSubscription> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const settings = normalizeEmailReportSettings(parsed);
    if (!isValidEmail(settings.email)) return null;
    return {
      ...settings,
      id: typeof parsed.id === "string" ? parsed.id : null,
      address: typeof parsed.address === "string" ? parsed.address : "",
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveEmailReportSubscription(subscription: EmailReportSubscription): void {
  if (typeof window === "undefined") return;
  try {
    const settings = normalizeEmailReportSettings(subscription);
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({
        ...settings,
        id: subscription.id ?? null,
        address: subscription.address,
        updatedAt: subscription.updatedAt,
      }),
    );
  } catch {
    // Private browsing / sandboxed frames: the subscription still lives on the
    // backend, so a storage failure is not worth failing the user's action over.
  }
}

export function clearEmailReportSubscription(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
  } catch {
    // noop
  }
}

/** Wallet address to sign with: explicit prop first, then the persisted key. */
export function resolveStoredWalletAddress(explicit?: string | null): string | null {
  if (explicit) return explicit;
  if (typeof window === "undefined") return null;
  try {
    // Same lookup order as WalletProvider: localStorage, then sessionStorage.
    return (
      window.localStorage.getItem(WALLET_STORAGE_KEY) ||
      window.sessionStorage.getItem(WALLET_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend + wallet boundaries
// ─────────────────────────────────────────────────────────────────────────────

function getApiBase(): string {
  // Same-origin Next API route by default; NEXT_PUBLIC_API_URL points the
  // panel at a separately deployed backend (matches src/lib/api/delegates.ts).
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  return `${configured}/api/email-reports`;
}

async function sendJson<T>(
  path: string,
  body: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Email report request failed (${res.status}): ${text || res.statusText}`,
    );
  }
  return (await res.json().catch(() => ({}))) as T;
}

/** Ask the backend to email a one-time code to `email`. */
export async function requestEmailOtp(
  email: string,
  nowMs: number = Date.now(),
): Promise<{ expiresAt: string }> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error("Enter a valid email address before requesting a code.");
  }
  const data = await sendJson<{ expiresAt?: string }>("/otp", { email: normalized });
  const expiresAt =
    typeof data.expiresAt === "string" && Number.isFinite(Date.parse(data.expiresAt))
      ? data.expiresAt
      : new Date(nowMs + OTP_TTL_MS).toISOString();
  return { expiresAt };
}

/** Exchange a one-time code for a verification token. */
export async function verifyEmailOtp(
  email: string,
  code: string,
  nowMs: number = Date.now(),
): Promise<EmailReportVerification> {
  const normalized = normalizeEmail(email);
  if (!isValidOtpCode(code)) {
    throw new Error(`Enter the ${OTP_CODE_LENGTH}-digit code from the email.`);
  }
  const otp = normalizeOtpCode(code);
  const data = await sendJson<{ token?: string; expiresAt?: string }>("/otp/verify", {
    email: normalized,
    code: otp,
  });
  return {
    email: normalized,
    token: typeof data.token === "string" ? data.token : null,
    verifiedAt: new Date(nowMs).toISOString(),
    expiresAt:
      typeof data.expiresAt === "string" && Number.isFinite(Date.parse(data.expiresAt))
        ? data.expiresAt
        : new Date(nowMs + OTP_TTL_MS).toISOString(),
  };
}

/**
 * Sign one report action with the connected wallet.
 *
 * Freighter returns a Buffer on older builds and a base64 string on current
 * ones; both are normalized to base64 so the backend has one shape to verify.
 */
export async function signEmailReportSettings(
  payload: ReportSignaturePayload,
  options?: { networkPassphrase?: string },
): Promise<SignedReportRequest> {
  const { isConnected, getAddress, signMessage } = await import(
    "@stellar/freighter-api"
  );

  const connection = await isConnected();
  if (connection.error || !connection.isConnected) {
    throw new Error("Connect a Freighter wallet to authorise email reports.");
  }

  const current = await getAddress();
  if (current.error || !current.address) {
    throw new Error("Could not read the wallet address — reconnect and try again.");
  }
  if (current.address !== payload.address) {
    throw new Error("The wallet address changed — reconnect before saving.");
  }

  const message = buildReportSignatureMessage(payload);
  const { signedMessage, error } = await signMessage(message, {
    address: current.address,
    networkPassphrase: options?.networkPassphrase,
  });
  if (error || !signedMessage) {
    throw new Error(error?.message ?? "Signing was cancelled.");
  }

  return {
    payload,
    message,
    signature:
      typeof signedMessage === "string"
        ? signedMessage
        : signedMessage.toString("base64"),
  };
}

/** Create or replace the subscription. Requires a fresh wallet signature. */
export async function submitEmailReportSubscription(
  request: SubmitReportRequest,
  nowMs: number = Date.now(),
): Promise<EmailReportSubscription> {
  const settings = normalizeEmailReportSettings(request.settings);
  const { signed } = request;
  if (normalizeEmail(signed.payload.email) !== settings.email) {
    throw new Error("The signed payload does not match the settings being saved.");
  }

  const data = await sendJson<{ id?: string; updatedAt?: string }>("/subscriptions", {
    action: signed.payload.action,
    email: settings.email,
    frequency: settings.frequency,
    sections: settings.sections,
    verificationToken: request.verificationToken,
    issuedAt: signed.payload.issuedAt,
    nonce: signed.payload.nonce,
    address: signed.payload.address,
    signature: signed.signature,
  });

  return {
    ...settings,
    id: typeof data.id === "string" ? data.id : null,
    address: signed.payload.address,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date(nowMs).toISOString(),
  };
}

/** Cancel the subscription. Also wallet-signed, so nobody else can opt you out. */
export async function cancelEmailReportSubscription(
  request: Omit<SubmitReportRequest, "verificationToken">,
): Promise<void> {
  const { signed } = request;
  await sendJson(
    "/subscriptions",
    {
      action: "cancel",
      email: normalizeEmail(signed.payload.email),
      address: signed.payload.address,
      issuedAt: signed.payload.issuedAt,
      nonce: signed.payload.nonce,
      signature: signed.signature,
    },
    "DELETE",
  );
}
