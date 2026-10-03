/**
 * Unit tests for the portfolio performance email report service (#979).
 *
 * Run: node --experimental-strip-types --test src/services/emailReports.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

// ── Browser / network mocks ─────────────────────────────────────────────────
// The service is SSR-safe (`typeof window === "undefined"`), so `window` is
// installed only for the tests that exercise persistence.

class StorageMock {
  map: Record<string, string> = {};
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.map, key) ? this.map[key] : null;
  }
  setItem(key: string, value: string) {
    this.map[key] = String(value);
  }
  removeItem(key: string) {
    delete this.map[key];
  }
}

const local = new StorageMock();
const session = new StorageMock();

Object.defineProperty(globalThis, "window", {
  value: { localStorage: local, sessionStorage: session },
  writable: true,
  configurable: true,
});

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

const calls: RecordedCall[] = [];
let respond: (call: RecordedCall) => { status?: number; payload?: unknown; text?: string } =
  () => ({ payload: {} });

globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const call: RecordedCall = {
    url: String(url),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : null,
  };
  calls.push(call);
  const result = respond(call);
  const status = result.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => result.payload ?? {},
    text: async () => result.text ?? JSON.stringify(result.payload ?? {}),
  } as Response;
}) as typeof fetch;

const {
  DEFAULT_EMAIL_REPORT_SETTINGS,
  FREQUENCY_LABELS,
  MAX_EMAIL_LENGTH,
  OTP_CODE_LENGTH,
  OTP_TTL_MS,
  REPORT_FREQUENCIES,
  REPORT_SECTIONS,
  SECTION_LABELS,
  assessSubscriptionReadiness,
  buildReportSignatureMessage,
  cancelEmailReportSubscription,
  clearEmailReportSubscription,
  createReportNonce,
  createReportSignaturePayload,
  isOtpExpired,
  isValidEmail,
  isValidOtpCode,
  loadEmailReportSubscription,
  normalizeEmail,
  normalizeEmailReportSettings,
  normalizeOtpCode,
  normalizeSections,
  requestEmailOtp,
  resolveStoredWalletAddress,
  saveEmailReportSubscription,
  submitEmailReportSubscription,
  toggleSection,
  verifyEmailOtp,
} = await import("./emailReports.ts");

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function reset() {
  calls.length = 0;
  respond = () => ({ payload: {} });
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    email: "trader@example.com",
    frequency: "weekly" as const,
    sections: ["tokenBalances" as const],
    id: "sub_1",
    address: ADDRESS,
    updatedAt: "2026-09-24T17:00:00.000Z",
    ...overrides,
  };
}

function signed(action: "subscribe" | "update" | "cancel" = "subscribe") {
  const settings = {
    email: "trader@example.com",
    frequency: "weekly" as const,
    sections: ["tokenBalances" as const],
  };
  const payload = createReportSignaturePayload(action, settings, ADDRESS, 0, "NONCE");
  return { payload, message: buildReportSignatureMessage(payload), signature: "c2ln" };
}

// ── Address validation ──────────────────────────────────────────────────────

test("isValidEmail accepts realistic addresses and rejects malformed ones", () => {
  for (const ok of ["trader@example.com", "a.b+tag@sub.example.co", "  USER@Example.COM  "]) {
    assert.equal(isValidEmail(ok), true, `expected ${ok} to be valid`);
  }
  for (const bad of [
    "",
    "   ",
    "trader",
    "trader@",
    "@example.com",
    "trader@example",
    "two words@example.com",
    "trader@exa mple.com",
    `${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`,
  ]) {
    assert.equal(isValidEmail(bad), false, `expected ${JSON.stringify(bad)} to be invalid`);
  }
});

test("normalizeEmail trims and lower-cases", () => {
  assert.equal(normalizeEmail("  Trader@Example.COM "), "trader@example.com");
  assert.equal(normalizeEmail(null as unknown as string), "");
});

// ── Section selection ───────────────────────────────────────────────────────

test("normalizeSections keeps known sections in canonical order and drops the rest", () => {
  assert.deepEqual(normalizeSections(["remittanceSummary", "nonsense", "tokenBalances"]), [
    "tokenBalances",
    "remittanceSummary",
  ]);
  assert.deepEqual(normalizeSections(["earnedYield", "earnedYield"]), ["earnedYield"]);
});

test("normalizeSections falls back to the defaults when selection is empty", () => {
  assert.deepEqual(normalizeSections([]), ["tokenBalances", "earnedYield"]);
  assert.deepEqual(normalizeSections(null), ["tokenBalances", "earnedYield"]);
});

test("toggleSection adds and removes, but never empties the report", () => {
  assert.deepEqual(toggleSection(["earnedYield"], "tokenBalances"), [
    "tokenBalances",
    "earnedYield",
  ]);
  assert.deepEqual(toggleSection(["tokenBalances", "earnedYield"], "earnedYield"), [
    "tokenBalances",
  ]);
  // Removing the last remaining section is a no-op: an empty report is not a report.
  assert.deepEqual(toggleSection(["earnedYield"], "earnedYield"), ["earnedYield"]);
});

test("every section and frequency is labelled for the UI", () => {
  assert.deepEqual([...REPORT_FREQUENCIES], ["weekly", "monthly"]);
  assert.deepEqual([...REPORT_SECTIONS], [
    "tokenBalances",
    "earnedYield",
    "remittanceSummary",
  ]);
  for (const frequency of REPORT_FREQUENCIES) {
    assert.ok(FREQUENCY_LABELS[frequency].title.length > 0);
    assert.ok(FREQUENCY_LABELS[frequency].cadence.length > 0);
  }
  for (const section of REPORT_SECTIONS) {
    assert.ok(SECTION_LABELS[section].title.length > 0);
    assert.ok(SECTION_LABELS[section].description.length > 0);
  }
});

// ── Settings normalization ──────────────────────────────────────────────────

test("normalizeEmailReportSettings cleans every field", () => {
  assert.deepEqual(
    normalizeEmailReportSettings({
      email: " Trader@Example.COM ",
      frequency: "monthly",
      sections: ["earnedYield"],
    }),
    { email: "trader@example.com", frequency: "monthly", sections: ["earnedYield"] },
  );
});

test("normalizeEmailReportSettings defaults empty and invalid input", () => {
  assert.deepEqual(normalizeEmailReportSettings(null), DEFAULT_EMAIL_REPORT_SETTINGS);
  assert.deepEqual(normalizeEmailReportSettings({ frequency: "hourly" as never }).frequency, "weekly");
  assert.equal(normalizeEmailReportSettings({ email: undefined }).email, "");
});

// ── One-time codes ──────────────────────────────────────────────────────────

test("normalizeOtpCode strips non-digits and clips to the code length", () => {
  assert.equal(normalizeOtpCode(" 12-34 56 78 "), "123456");
  assert.equal(normalizeOtpCode("abc"), "");
  assert.equal(OTP_CODE_LENGTH, 6);
});

test("isValidOtpCode requires exactly six digits and does not truncate", () => {
  assert.equal(isValidOtpCode("123456"), true);
  assert.equal(isValidOtpCode(" 123456 "), true);
  assert.equal(isValidOtpCode("12345"), false);
  assert.equal(isValidOtpCode("1234567"), false);
  assert.equal(isValidOtpCode("12345a"), false);
  assert.equal(isValidOtpCode(""), false);
});

test("isOtpExpired fails closed on missing, malformed, and past expiries", () => {
  assert.equal(isOtpExpired(null), true);
  assert.equal(isOtpExpired(undefined), true);
  assert.equal(isOtpExpired("not-a-date"), true);
  assert.equal(isOtpExpired(new Date(1_000).toISOString(), 1_000), true);
  assert.equal(isOtpExpired(new Date(1_001).toISOString(), 1_000), false);
});

// ── Readiness gate ──────────────────────────────────────────────────────────

test("a verified address plus a connected wallet is ready to save", () => {
  const readiness = assessSubscriptionReadiness(
    { email: "trader@example.com", frequency: "weekly", sections: ["tokenBalances"] },
    "trader@example.com",
    ADDRESS,
  );
  assert.deepEqual(readiness, { ready: true, problems: [] });
});

test("readiness reports every unmet requirement", () => {
  const readiness = assessSubscriptionReadiness(
    { email: "", frequency: "weekly", sections: [] },
    null,
    null,
  );
  assert.equal(readiness.ready, false);
  assert.equal(readiness.problems.length, 3);
  assert.match(readiness.problems.join(" "), /email address/);
  assert.match(readiness.problems.join(" "), /one-time code/);
  assert.match(readiness.problems.join(" "), /Connect a wallet/);
});

test("saving is blocked when the verified address no longer matches", () => {
  const readiness = assessSubscriptionReadiness(
    { email: "victim@example.com", frequency: "weekly", sections: ["tokenBalances"] },
    "attacker@example.com",
    ADDRESS,
  );
  assert.equal(readiness.ready, false);
  assert.match(readiness.problems[0], /no longer matches/);
});

// ── Canonical signed message ────────────────────────────────────────────────

test("the signed message is the exact canonical bytes the backend verifies", () => {
  const payload = createReportSignaturePayload(
    "subscribe",
    { email: "trader@example.com", frequency: "weekly", sections: ["tokenBalances"] },
    ADDRESS,
    Date.parse("2026-09-24T17:00:00.000Z"),
    "NONCE",
  );
  assert.equal(
    buildReportSignatureMessage(payload),
    [
      "StellarFlow Portfolio Email Reports",
      "Action: subscribe",
      `Wallet: ${ADDRESS}`,
      "Email: trader@example.com",
      "Frequency: weekly",
      "Contents: tokenBalances",
      "Issued At: 2026-09-24T17:00:00.000Z",
      "Nonce: NONCE",
    ].join("\n"),
  );
});

test("the signed message normalizes the address case and section order", () => {
  const message = buildReportSignatureMessage(
    createReportSignaturePayload(
      "update",
      {
        email: " Trader@Example.COM ",
        frequency: "monthly",
        sections: ["remittanceSummary", "tokenBalances"],
      },
      ADDRESS,
      0,
      "NONCE",
    ),
  );
  const lines = message.split("\n");
  assert.equal(lines[1], "Action: update");
  assert.equal(lines[3], "Email: trader@example.com");
  assert.equal(lines[4], "Frequency: monthly");
  assert.equal(lines[5], "Contents: tokenBalances,remittanceSummary");
  assert.equal(lines[6], "Issued At: 1970-01-01T00:00:00.000Z");
});

test("each signed request carries a fresh nonce so it cannot be replayed", () => {
  const settings = {
    email: "trader@example.com",
    frequency: "weekly" as const,
    sections: ["tokenBalances" as const],
  };
  const first = createReportSignaturePayload("subscribe", settings, ADDRESS);
  const second = createReportSignaturePayload("subscribe", settings, ADDRESS);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(buildReportSignatureMessage(first), buildReportSignatureMessage(second));
  assert.ok(createReportNonce().length > 0);
});

// ── Persistence ─────────────────────────────────────────────────────────────

test("a saved subscription round-trips through storage", () => {
  clearEmailReportSubscription();
  assert.equal(loadEmailReportSubscription(), null);

  saveEmailReportSubscription(subscription());
  const loaded = loadEmailReportSubscription();
  assert.equal(loaded?.email, "trader@example.com");
  assert.equal(loaded?.id, "sub_1");
  assert.equal(loaded?.address, ADDRESS);
  assert.deepEqual(loaded?.sections, ["tokenBalances"]);

  clearEmailReportSubscription();
  assert.equal(loadEmailReportSubscription(), null);
});

test("a corrupt or address-less stored value is ignored instead of thrown", () => {
  local.setItem("sf.emailReports.subscription.v1", "{not json");
  assert.equal(loadEmailReportSubscription(), null);

  local.setItem("sf.emailReports.subscription.v1", JSON.stringify({ email: "not-an-email" }));
  assert.equal(loadEmailReportSubscription(), null);

  local.setItem("sf.emailReports.subscription.v1", JSON.stringify({ frequency: "weekly" }));
  assert.equal(loadEmailReportSubscription(), null);
});

test("the wallet address comes from the prop, then localStorage, then sessionStorage", () => {
  local.map = {};
  session.map = {};
  assert.equal(resolveStoredWalletAddress(), null);
  assert.equal(resolveStoredWalletAddress(ADDRESS), ADDRESS);

  session.setItem("stellarflow.wallet.publicKey", "GSESSION");
  assert.equal(resolveStoredWalletAddress(), "GSESSION");

  local.setItem("stellarflow.wallet.publicKey", "GLOCAL");
  assert.equal(resolveStoredWalletAddress(), "GLOCAL");
  assert.equal(resolveStoredWalletAddress("GPROP"), "GPROP");
});

// ── Backend: one-time code ──────────────────────────────────────────────────

test("requestEmailOtp posts the normalized address and honours the server expiry", async () => {
  reset();
  respond = () => ({ payload: { expiresAt: "2026-09-24T18:30:00.000Z" } });
  const result = await requestEmailOtp(" Trader@Example.com ");
  assert.deepEqual(result, { expiresAt: "2026-09-24T18:30:00.000Z" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/email-reports/otp");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { email: "trader@example.com" });
});

test("requestEmailOtp falls back to the local TTL when the backend omits an expiry", async () => {
  reset();
  respond = () => ({ payload: {} });
  const now = Date.parse("2026-09-24T17:00:00.000Z");
  const { expiresAt } = await requestEmailOtp("trader@example.com", now);
  assert.equal(expiresAt, new Date(now + OTP_TTL_MS).toISOString());
});

test("requestEmailOtp rejects a malformed address without calling the backend", async () => {
  reset();
  await assert.rejects(() => requestEmailOtp("nope"), /valid email address/);
  assert.equal(calls.length, 0);
});

test("verifyEmailOtp posts the code and returns the verification token", async () => {
  reset();
  respond = () => ({ payload: { token: "tok_123" } });
  const now = Date.parse("2026-09-24T17:00:00.000Z");
  const verification = await verifyEmailOtp(" Trader@Example.com ", " 12-34-56 ", now);
  assert.equal(verification.email, "trader@example.com");
  assert.equal(verification.token, "tok_123");
  assert.equal(verification.verifiedAt, new Date(now).toISOString());
  assert.equal(verification.expiresAt, new Date(now + OTP_TTL_MS).toISOString());
  assert.deepEqual(calls[0].body, { email: "trader@example.com", code: "123456" });
  assert.equal(calls[0].url, "/api/email-reports/otp/verify");
});

test("verifyEmailOtp refuses a code that is not exactly six digits", async () => {
  reset();
  await assert.rejects(() => verifyEmailOtp("trader@example.com", "12345"), /6-digit code/);
  await assert.rejects(() => verifyEmailOtp("trader@example.com", "1234567"), /6-digit code/);
  await assert.rejects(() => verifyEmailOtp("trader@example.com", "abcdef"), /6-digit code/);
  assert.equal(calls.length, 0);
});

test("a backend failure surfaces the status instead of silently succeeding", async () => {
  reset();
  respond = () => ({ status: 429, text: "slow down" });
  await assert.rejects(() => requestEmailOtp("trader@example.com"), /429/);
});

// ── Backend: subscribe / update / cancel ────────────────────────────────────

test("submitEmailReportSubscription sends the signed subscription and returns it", async () => {
  reset();
  respond = () => ({ payload: { id: "sub_42", updatedAt: "2026-09-24T18:00:00.000Z" } });
  const settings = {
    email: "trader@example.com",
    frequency: "monthly" as const,
    sections: ["tokenBalances", "earnedYield"] as const,
  };
  const signedRequest = signed("subscribe");
  const saved = await submitEmailReportSubscription({
    settings: { ...settings, sections: [...settings.sections] },
    verificationToken: "tok_123",
    signed: signedRequest,
  });
  assert.equal(saved.id, "sub_42");
  assert.equal(saved.address, ADDRESS);
  assert.equal(saved.frequency, "monthly");
  assert.equal(saved.updatedAt, "2026-09-24T18:00:00.000Z");

  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "/api/email-reports/subscriptions");
  const body = calls[0].body as Record<string, unknown>;
  assert.equal(body.action, "subscribe");
  assert.equal(body.email, "trader@example.com");
  assert.equal(body.verificationToken, "tok_123");
  assert.equal(body.signature, "c2ln");
  assert.equal(body.nonce, "NONCE");
  assert.equal(body.address, ADDRESS);
  assert.deepEqual(body.sections, ["tokenBalances", "earnedYield"]);
});

test("an update reuses the signed payload so a cancelled action cannot be replayed", async () => {
  reset();
  respond = () => ({ payload: {} });
  const payload = createReportSignaturePayload(
    "update",
    { email: "trader@example.com", frequency: "weekly", sections: ["tokenBalances"] },
    ADDRESS,
    0,
    "NONCE",
  );
  await submitEmailReportSubscription({
    settings: { email: "trader@example.com", frequency: "weekly", sections: ["tokenBalances"] },
    verificationToken: null,
    signed: { payload, message: buildReportSignatureMessage(payload), signature: "c2ln" },
  });
  assert.equal((calls[0].body as Record<string, unknown>).action, "update");
});

test("a signed payload for a different address is refused before the request is sent", async () => {
  reset();
  await assert.rejects(
    () =>
      submitEmailReportSubscription({
        settings: {
          email: "someone-else@example.com",
          frequency: "weekly",
          sections: ["tokenBalances"],
        },
        verificationToken: null,
        signed: signed("subscribe"),
      }),
    /does not match/,
  );
  assert.equal(calls.length, 0);
});

test("cancelEmailReportSubscription sends a signed DELETE", async () => {
  reset();
  respond = () => ({ payload: {} });
  await cancelEmailReportSubscription({ settings: subscription(), signed: signed("cancel") });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, "/api/email-reports/subscriptions");
  const body = calls[0].body as Record<string, unknown>;
  assert.equal(body.action, "cancel");
  assert.equal(body.email, "trader@example.com");
  assert.equal(body.signature, "c2ln");
});

test("persistence is a no-op on the server, where there is no window", () => {
  const realWindow = (globalThis as Record<string, unknown>).window;
  Reflect.deleteProperty(globalThis as object, "window");
  try {
    assert.equal(loadEmailReportSubscription(), null);
    assert.equal(resolveStoredWalletAddress(), null);
    assert.doesNotThrow(() => saveEmailReportSubscription(subscription()));
    assert.doesNotThrow(() => clearEmailReportSubscription());
  } finally {
    (globalThis as Record<string, unknown>).window = realWindow;
  }
});
