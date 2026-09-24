"use client";

/**
 * EmailReportSettings — automated portfolio performance report exporter (#979).
 *
 * A settings panel that opts a wallet into a periodic portfolio performance
 * email. Three things have to be true before anything is saved:
 *
 *   1. the email address is well formed and has been proven with a one-time
 *      code (`requestEmailOtp` → `verifyEmailOtp`),
 *   2. at least one report section is selected, and
 *   3. the subscription is signed by the connected wallet
 *      (`signEmailReportSettings`), so the backend can verify that the request
 *      came from the owner of the report.
 *
 * The panel is read/write over the whole subscription lifecycle: it loads the
 * last known subscription on mount, saves as `subscribe` or `update` depending
 * on whether one exists, and can cancel at any time (the cancel is signed too,
 * so nobody else can opt an address out).
 *
 * Wallet access is prop-first: pass `walletAddress` when the panel sits inside a
 * provider, otherwise the persisted wallet key is used and the signer is read
 * from the wallet at signing time.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  FileText,
  LoaderCircle,
  Mail,
  MailCheck,
  Send,
  ShieldCheck,
} from "lucide-react";

import {
  DEFAULT_EMAIL_REPORT_SETTINGS,
  FREQUENCY_LABELS,
  OTP_CODE_LENGTH,
  OTP_TTL_MS,
  REPORT_FREQUENCIES,
  REPORT_SECTIONS,
  SECTION_LABELS,
  assessSubscriptionReadiness,
  cancelEmailReportSubscription,
  clearEmailReportSubscription,
  createReportSignaturePayload,
  isOtpExpired,
  isValidEmail,
  isValidOtpCode,
  loadEmailReportSubscription,
  normalizeEmail,
  normalizeEmailReportSettings,
  normalizeOtpCode,
  requestEmailOtp,
  resolveStoredWalletAddress,
  saveEmailReportSubscription,
  signEmailReportSettings,
  submitEmailReportSubscription,
  toggleSection,
  verifyEmailOtp,
  type EmailReportSettings as EmailReportSettingsModel,
  type EmailReportSubscription,
  type EmailReportVerification,
  type ReportFrequency,
  type ReportSection,
} from "@/services/emailReports";

/** Minutes shown in the "code" hint, derived so the copy cannot drift from the TTL. */
const OTP_TTL_MINUTES = Math.round(OTP_TTL_MS / 60_000);

export interface EmailReportSettingsProps {
  /** Wallet that will sign the subscription. Falls back to the persisted key. */
  walletAddress?: string | null;
  /** Called after the backend acknowledges a subscribe/update. */
  onSaved?: (subscription: EmailReportSubscription) => void;
  /** Called after a signed cancel succeeds. */
  onCancelled?: () => void;
}

type BusyState = "sending" | "verifying" | "saving" | "cancelling" | null;

export function EmailReportSettings({
  walletAddress,
  onSaved,
  onCancelled,
}: EmailReportSettingsProps) {
  const [settings, setSettings] = useState<EmailReportSettingsModel>(
    DEFAULT_EMAIL_REPORT_SETTINGS,
  );
  const [subscription, setSubscription] = useState<EmailReportSubscription | null>(null);
  const [verification, setVerification] = useState<EmailReportVerification | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Load any existing subscription once, on the client ────────────────────
  useEffect(() => {
    const existing = loadEmailReportSubscription();
    if (!existing) return;
    setSubscription(existing);
    setSettings(normalizeEmailReportSettings(existing));
  }, []);

  /**
   * An existing subscription already proved control of its mailbox, so saving
   * again does not force a second code unless the address is being changed.
   */
  const verifiedEmail = useMemo(
    () => verification?.email ?? subscription?.email ?? null,
    [verification, subscription],
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setError(null);
      setSettings((current) => ({ ...current, email: value }));
      // Changing the address invalidates any code already proven for the old
      // one — otherwise a code sent to attacker@example.com could authorise a
      // subscription to victim@example.com.
      if (verification && normalizeEmail(value) !== verification.email) {
        setVerification(null);
        setOtpCode("");
        setOtpExpiresAt(null);
        setNotice("Verify the new address to continue.");
      }
    },
    [verification],
  );

  const handleFrequencyChange = useCallback((frequency: ReportFrequency) => {
    setError(null);
    setSettings((current) => ({ ...current, frequency }));
  }, []);

  const handleSectionToggle = useCallback((section: ReportSection) => {
    setError(null);
    setSettings((current) => ({ ...current, sections: toggleSection(current.sections, section) }));
  }, []);

  const handleSendOtp = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!isValidEmail(settings.email)) {
      setError("Enter a valid email address before requesting a code.");
      return;
    }
    setBusy("sending");
    try {
      const { expiresAt } = await requestEmailOtp(settings.email);
      setOtpExpiresAt(expiresAt);
      setOtpCode("");
      setNotice(`Verification code sent to ${normalizeEmail(settings.email)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(null);
    }
  }, [settings.email]);

  const handleVerifyOtp = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (isOtpExpired(otpExpiresAt)) {
      setError("That code has expired — request a new one.");
      return;
    }
    if (!isValidOtpCode(otpCode)) {
      setError(`Enter the ${OTP_CODE_LENGTH}-digit code from the email.`);
      return;
    }
    setBusy("verifying");
    try {
      const verified = await verifyEmailOtp(settings.email, otpCode);
      setVerification(verified);
      setOtpCode("");
      setNotice(`${verified.email} verified.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
    } finally {
      setBusy(null);
    }
  }, [otpCode, otpExpiresAt, settings.email]);

  const handleSave = useCallback(async () => {
    setError(null);
    setNotice(null);

    if (verification && isOtpExpired(verification.expiresAt)) {
      setVerification(null);
      setError("That verification code has expired — request a new one.");
      return;
    }

    const address = resolveStoredWalletAddress(walletAddress);
    const readiness = assessSubscriptionReadiness(settings, verifiedEmail, address);
    if (!readiness.ready) {
      setError(readiness.problems[0]);
      return;
    }

    setBusy("saving");
    try {
      const action = subscription ? "update" : "subscribe";
      const payload = createReportSignaturePayload(action, settings, address as string);
      const signed = await signEmailReportSettings(payload);
      const saved = await submitEmailReportSubscription({
        settings,
        verificationToken: verification?.token ?? null,
        signed,
      });
      saveEmailReportSubscription(saved);
      setSubscription(saved);
      setSettings(normalizeEmailReportSettings(saved));
      setNotice(
        action === "update"
          ? `Report settings updated — next ${FREQUENCY_LABELS[saved.frequency].title.toLowerCase()} ${FREQUENCY_LABELS[saved.frequency].cadence}.`
          : `Subscribed — your first ${FREQUENCY_LABELS[saved.frequency].title.toLowerCase()} arrives ${FREQUENCY_LABELS[saved.frequency].cadence}.`,
      );
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the subscription.");
    } finally {
      setBusy(null);
    }
  }, [onSaved, settings, subscription, verification, verifiedEmail, walletAddress]);

  const handleCancel = useCallback(async () => {
    setError(null);
    setNotice(null);
    const address = resolveStoredWalletAddress(walletAddress);
    if (!address) {
      setError("Connect a wallet to cancel the subscription.");
      return;
    }
    setBusy("cancelling");
    try {
      const payload = createReportSignaturePayload("cancel", settings, address);
      const signed = await signEmailReportSettings(payload);
      await cancelEmailReportSubscription({ settings, signed });
      clearEmailReportSubscription();
      setSubscription(null);
      setVerification(null);
      setOtpExpiresAt(null);
      setNotice("Email reports cancelled. You can subscribe again at any time.");
      onCancelled?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the subscription.");
    } finally {
      setBusy(null);
    }
  }, [onCancelled, settings, walletAddress]);

  const codeExpired = otpExpiresAt !== null && isOtpExpired(otpExpiresAt);
  const disabled = busy !== null;

  return (
    <section
      role="region"
      aria-label="Portfolio email report settings"
      data-testid="email-report-settings"
      className="rounded-xl border border-gray-800 bg-[#161b22] p-6 space-y-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
            <Mail className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              Email Performance Reports
              {subscription && (
                <span
                  data-testid="email-report-active-badge"
                  className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
                >
                  Active
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Get a portfolio performance summary delivered to your inbox. The
              subscription is signed by your wallet — the backend never stores a
              password and cannot read your keys.
            </p>
          </div>
        </div>
      </div>

      {/* ── Email + OTP ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <label
          htmlFor="email-report-address"
          className="block text-xs font-semibold uppercase tracking-wider text-gray-400"
        >
          Report email address
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              id="email-report-address"
              data-testid="email-report-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="trader@example.com"
              value={settings.email}
              disabled={disabled}
              onChange={(event) => handleEmailChange(event.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-[#0d1117] py-2.5 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            data-testid="email-report-send-otp"
            onClick={() => void handleSendOtp()}
            disabled={disabled || !isValidEmail(settings.email)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "sending" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {otpExpiresAt ? "Resend code" : "Send code"}
          </button>
        </div>

        {/* Verification step — only meaningful once a code has been requested */}
        {otpExpiresAt && !verification && (
          <div className="space-y-3 rounded-lg border border-gray-800/80 bg-[#0d1117]/60 p-4">
            <label
              htmlFor="email-report-otp"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              One-time code
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="email-report-otp"
                data-testid="email-report-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_CODE_LENGTH}
                placeholder={"0".repeat(OTP_CODE_LENGTH)}
                value={otpCode}
                disabled={disabled}
                onChange={(event) => setOtpCode(normalizeOtpCode(event.target.value))}
                className="w-full rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2.5 font-mono text-sm tracking-[0.4em] text-gray-100 placeholder:text-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-60 sm:w-40"
              />
              <button
                type="button"
                data-testid="email-report-verify"
                onClick={() => void handleVerifyOtp()}
                disabled={disabled || otpCode.length !== OTP_CODE_LENGTH}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "verifying" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Verify
              </button>
            </div>
            <p
              data-testid="email-report-otp-expiry"
              className={`text-xs ${codeExpired ? "text-amber-300" : "text-gray-500"}`}
            >
              {codeExpired
                ? "This code has expired — request a new one."
                : `Codes are ${OTP_CODE_LENGTH} digits and expire ${OTP_TTL_MINUTES} minutes after they are sent.`}
            </p>
          </div>
        )}

        {verifiedEmail && normalizeEmail(verifiedEmail) === normalizeEmail(settings.email) && (
          <p
            data-testid="email-report-verified"
            className="inline-flex items-center gap-2 text-sm text-emerald-300"
          >
            <CircleCheck className="h-4 w-4" />
            {normalizeEmail(settings.email)} is verified
          </p>
        )}
      </div>

      {/* ── Frequency ──────────────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <CalendarClock className="h-4 w-4" />
          Report frequency
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {REPORT_FREQUENCIES.map((frequency) => {
            const meta = FREQUENCY_LABELS[frequency];
            const selected = settings.frequency === frequency;
            return (
              <label
                key={frequency}
                className={`relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${
                  selected
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-gray-800 hover:border-gray-700 hover:bg-[#0d1117]/50"
                }`}
              >
                <input
                  type="radio"
                  name="email-report-frequency"
                  data-testid={`email-report-frequency-${frequency}`}
                  value={frequency}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => handleFrequencyChange(frequency)}
                  className="mt-0.5 h-4 w-4 border-gray-700 bg-[#0d1117] text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      selected ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {meta.title}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{meta.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* ── Contents ───────────────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <FileText className="h-4 w-4" />
          Report contents
        </legend>
        <div className="space-y-2">
          {REPORT_SECTIONS.map((section) => {
            const meta = SECTION_LABELS[section];
            const selected = settings.sections.includes(section);
            const isLastSelected = selected && settings.sections.length === 1;
            return (
              <label
                key={section}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800/80 px-3 py-2.5 transition-colors hover:border-gray-700"
              >
                <input
                  type="checkbox"
                  data-testid={`email-report-section-${section}`}
                  checked={selected}
                  disabled={disabled || isLastSelected}
                  onChange={() => handleSectionToggle(section)}
                  aria-describedby={`email-report-section-${section}-desc`}
                  className="mt-0.5 h-4 w-4 rounded border-gray-700 bg-[#0d1117] text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-100">{meta.title}</span>
                  <span
                    id={`email-report-section-${section}-desc`}
                    className="mt-0.5 block text-xs text-gray-500"
                  >
                    {meta.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          At least one section must stay selected — a report with no contents would
          be an empty email.
        </p>
      </fieldset>

      {/* ── Feedback ───────────────────────────────────────────────────────── */}
      {error && (
        <p
          role="alert"
          data-testid="email-report-error"
          className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </p>
      )}
      {notice && !error && (
        <p
          role="status"
          data-testid="email-report-notice"
          className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {notice}
        </p>
      )}

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Saving requires a wallet signature over your settings.
        </p>
        <div className="flex items-center gap-2">
          {subscription && (
            <button
              type="button"
              data-testid="email-report-cancel"
              onClick={() => void handleCancel()}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "cancelling" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Cancel subscription
            </button>
          )}
          <button
            type="button"
            data-testid="email-report-save"
            onClick={() => void handleSave()}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "saving" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <MailCheck className="h-4 w-4" />
            )}
            {subscription ? "Update subscription" : "Subscribe"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default EmailReportSettings;
