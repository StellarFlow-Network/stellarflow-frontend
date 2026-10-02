"use client";

/**
 * SEP31MerchantCheckout — Issue #941
 *
 * Merchant-facing checkout for SEP-31 cross-border remittance payments. The
 * shopper reviews the merchant, the line items and the total due in their local
 * fiat currency, sees the equivalent Stellar token amount at the anchor's
 * active rate, pays, and watches settlement status update automatically until
 * the anchor confirms the transfer on chain.
 *
 * SEP-31 differs from SEP-24 in that the *merchant* drives the flow: the wallet
 * (customer) pays the anchor's temporary account, and the anchor settles out of
 * band once it sees the payment. So the checkout's job here is to keep the
 * quoted amount and the rate stable for the duration of the session and to
 * surface the anchor's settlement state clearly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  OctagonAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useErrorTimeout } from "@/app/hooks/useErrorTimeout";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import { usePageVisibility } from "@/app/hooks/usePageVisibility";
import { useRAFInterval } from "@/app/hooks/useRAFInterval";
import { useOptionalToast } from "@/components/ui/ToastQueue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Settlement lifecycle as reported by the anchor for this checkout session. */
export type SEP31SettlementStatus =
  | "awaiting_payment"
  | "pending"
  | "settled"
  | "failed";

export interface SEP31Settlement {
  status: SEP31SettlementStatus;
  /** Stellar transaction hash of the customer's payment, once submitted. */
  transactionHash?: string;
  /** Anchor-supplied deep link to the full SEP-31 transaction record. */
  moreInfoUrl?: string;
  /** ISO 8601 timestamp of the last status update. */
  updatedAt?: string;
  /** Populated when `status` is `failed`. */
  failureReason?: string;
}

/** A single line on the merchant invoice, always priced in fiat. */
export interface SEP31LineItem {
  id: string;
  description: string;
  /** Price for one unit, in the invoice's fiat currency. */
  unitAmount: number;
  quantity: number;
}

export interface SEP31Merchant {
  id: string;
  name: string;
  /** Short description of what the merchant is paying out. */
  description?: string;
  /** True when the merchant's domain is verified by the anchor. */
  verified?: boolean;
  /** Stellar account that receives the payment (SEP-31 `account` field). */
  paymentAccount?: string;
}

export interface SEP31MerchantCheckoutProps {
  merchant: SEP31Merchant;
  lineItems: SEP31LineItem[];
  /** ISO 4217 code for the fiat the invoice is denominated in. */
  fiatCurrency: string;
  /** Asset the customer pays with, e.g. `XLM` or `USDC`. */
  assetCode: string;
  /** Active anchor rate: how much one token is worth in `fiatCurrency`. */
  rate: number;
  /** Anchor fee already folded into the total, in fiat. Defaults to 0. */
  anchorFee?: number;
  /**
   * How long the quoted rate stays valid once the checkout session opens.
   * Defaults to the SEP-31 merchant checkout window of 15 minutes.
   */
  rateLockSeconds?: number;
  /**
   * Externally-driven settlement state. When supplied the component treats it
   * as the source of truth and does no polling of its own.
   */
  settlement?: SEP31Settlement;
  /**
   * Anchor status endpoint polled while a payment is in flight. Ignored when
   * `settlement` is supplied.
   */
  statusEndpoint?: string;
  /** Poll cadence in ms while a payment is in flight. Defaults to 5s. */
  pollIntervalMs?: number;
  /** Opens the wallet payment flow. Resolve with the submitted tx hash. */
  onPay?: (details: {
    amount: string;
    assetCode: string;
    amountFiat: number;
    fiatCurrency: string;
    rate: number;
  }) => Promise<string | void> | string | void;
  /** Optional hook to deliver the receipt email from the app's own backend. */
  onRequestReceipt?: (details: {
    email: string;
    merchantName: string;
    amountFiat: number;
    fiatCurrency: string;
    amount: string;
    assetCode: string;
    transactionHash?: string;
  }) => Promise<void> | void;
  onSettled?: (settlement: SEP31Settlement) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

export const SEP31_RATE_LOCK_SECONDS = 15 * 60;

/** SEP-31 amounts are quoted to 7 decimal places, the Stellar default. */
const TOKEN_DECIMALS = 7;

const TERMINAL_STATUSES: readonly SEP31SettlementStatus[] = ["settled", "failed"];

export function sumLineItems(items: readonly SEP31LineItem[]): number {
  return items.reduce((total, item) => total + item.unitAmount * item.quantity, 0);
}

/**
 * Convert a fiat total into the token amount the customer must send.
 *
 * Rounded *up* to 7 decimals: an anchor that receives slightly less than the
 * quoted amount will short the merchant's payout, so we always over-quote by
 * at most one stroop rather than risk underpaying.
 */
export function convertFiatToToken(amountFiat: number, rate: number): string {
  if (!Number.isFinite(amountFiat) || !Number.isFinite(rate) || rate <= 0 || amountFiat <= 0) {
    return "0";
  }
  const factor = 10 ** TOKEN_DECIMALS;
  const stroops = Math.ceil((amountFiat / rate) * factor);
  const whole = Math.floor(stroops / factor);
  const fraction = String(stroops % factor).padStart(TOKEN_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

function formatFiat(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown/malformed currency code — fall back to a plain decimal.
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function isValidReceiptEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && value.trim().length <= 254;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SEP31MerchantCheckout({
  merchant,
  lineItems,
  fiatCurrency,
  assetCode,
  rate,
  anchorFee = 0,
  rateLockSeconds = SEP31_RATE_LOCK_SECONDS,
  settlement,
  statusEndpoint,
  pollIntervalMs = 5000,
  onPay,
  onRequestReceipt,
  onSettled,
  className = "",
}: SEP31MerchantCheckoutProps) {
  const toast = useOptionalToast();
  const { error, setError, clearError } = useErrorTimeout({ timeoutMs: 8000 });
  const isOnline = useOnlineStatus();
  const isVisible = usePageVisibility();

  // The rate is locked for the length of the checkout session: a fresher rate
  // arriving from the feed is displayed but never re-quotes the amount until
  // the current lock has run out.
  const [lockedRate, setLockedRate] = useState(rate);
  const [lockEndsAt, setLockEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [internalSettlement, setInternalSettlement] = useState<SEP31Settlement>({
    status: "awaiting_payment",
  });
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptState, setReceiptState] = useState<"idle" | "sending" | "sent">("idle");
  // Keyed by session so a new transaction re-announces settlement, while
  // re-renders for an already-settled payment stay quiet.
  const settledNotified = useRef<string | null>(null);

  // Start the clock on the client only — the server has no notion of "now", and
  // rendering a countdown during SSR would produce a hydration mismatch.
  useEffect(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setLockEndsAt(startedAt + rateLockSeconds * 1000);
  }, [rateLockSeconds]);

  const secondsRemaining = useMemo(() => {
    if (lockEndsAt === null || now === null) return rateLockSeconds;
    return Math.max(0, Math.ceil((lockEndsAt - now) / 1000));
  }, [lockEndsAt, now, rateLockSeconds]);

  const isRateLocked = secondsRemaining > 0;

  // Adopt the feed rate only once the lock lapses, then start a fresh lock.
  useEffect(() => {
    if (!isRateLocked || lockEndsAt === null || now === null) return;
    if (now < lockEndsAt) return;
    if (!Number.isFinite(rate) || rate <= 0) return;
    setLockedRate(rate);
    setLockEndsAt(now + rateLockSeconds * 1000);
  }, [isRateLocked, lockEndsAt, now, rate, rateLockSeconds]);

  const activeRate = isRateLocked ? lockedRate : Number.isFinite(rate) && rate > 0 ? rate : lockedRate;

  const subtotalFiat = useMemo(() => sumLineItems(lineItems), [lineItems]);
  const totalFiat = useMemo(() => subtotalFiat + anchorFee, [subtotalFiat, anchorFee]);
  const tokenAmount = useMemo(
    () => convertFiatToToken(totalFiat, activeRate),
    [totalFiat, activeRate],
  );

  const currentSettlement = settlement ?? internalSettlement;
  const { status } = currentSettlement;
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const activeHash = currentSettlement.transactionHash ?? transactionHash;

  const sessionKey = `${merchant.id}:${fiatCurrency}:${assetCode}`;

  const pollSettlement = useCallback(async () => {
    if (!statusEndpoint) return;
    try {
      const response = await fetch(statusEndpoint, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Status request failed (${response.status})`);
      const payload = (await response.json()) as { status?: unknown; transaction_hash?: unknown };
      const next = normalizeSettlement(payload);
      setInternalSettlement(next);
      clearError();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update settlement status.");
    }
  }, [statusEndpoint, setError, clearError]);

  // Poll only while a payment is genuinely in flight and the tab is usable.
  useRAFInterval(
    () => void pollSettlement(),
    pollIntervalMs,
    !settlement && Boolean(statusEndpoint) && !isTerminal && status === "pending" && isOnline && isVisible,
  );

  // Announce settlement exactly once per session, whichever path delivered it.
  useEffect(() => {
    if (!isTerminal) return;
    const key = `${sessionKey}:${activeHash ?? "none"}`;
    if (settledNotified.current === key) return;
    settledNotified.current = key;
    onSettled?.(currentSettlement);
    if (status === "settled") {
      toast?.addToast({
        title: "Payment settled",
        description: `${formatFiat(totalFiat, fiatCurrency)} was delivered to ${merchant.name}.`,
        status: "confirmed",
        txHash: activeHash,
      });
    } else {
      toast?.addToast({
        title: "Settlement failed",
        description: currentSettlement.failureReason ?? "The anchor could not settle this payment.",
        status: "failed",
        txHash: activeHash,
      });
    }
  }, [
    isTerminal,
    status,
    sessionKey,
    activeHash,
    currentSettlement,
    onSettled,
    toast,
    totalFiat,
    fiatCurrency,
    merchant.name,
  ]);

  const handlePay = async () => {
    clearError();
    if (totalFiat <= 0) {
      setError("This invoice has no payable total.");
      return;
    }
    if (Number.isFinite(rate) && rate > 0 && Math.abs(rate - activeRate) > 1e-12 && !isRateLocked) {
      setError("The anchor rate just changed. Review the new total before paying.");
      return;
    }
    setIsPaying(true);
    setInternalSettlement({ status: "pending" });
    try {
      const hash = await onPay?.({
        amount: tokenAmount,
        assetCode,
        amountFiat: totalFiat,
        fiatCurrency,
        rate: activeRate,
      });
      const submitted = typeof hash === "string" && hash ? hash : undefined;
      if (submitted) setTransactionHash(submitted);
      setInternalSettlement((current) => ({ ...current, status: "pending", transactionHash: submitted }));
    } catch (cause) {
      setInternalSettlement({ status: "awaiting_payment" });
      setError(cause instanceof Error ? cause.message : "The payment could not be submitted.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleReceipt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    const email = receiptEmail.trim();
    if (!isValidReceiptEmail(email)) {
      setError("Enter a valid email address for the receipt.");
      return;
    }
    setReceiptState("sending");
    try {
      await onRequestReceipt?.({
        email,
        merchantName: merchant.name,
        amountFiat: totalFiat,
        fiatCurrency,
        amount: tokenAmount,
        assetCode,
        transactionHash: activeHash,
      });
      setReceiptState("sent");
    } catch (cause) {
      setReceiptState("idle");
      setError(cause instanceof Error ? cause.message : "We could not send that receipt.");
    }
  };

  const payDisabled = isPaying || totalFiat <= 0 || !isRateLocked || status !== "awaiting_payment";

  return (
    <section
      aria-label="SEP-31 merchant checkout"
      data-testid="sep31-merchant-checkout"
      className={`mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 ${className}`}
    >
      {/* Merchant header */}
      <header className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-neutral-300">
          <Store size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
            <span className="truncate">{merchant.name}</span>
            {merchant.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                <BadgeCheck size={12} aria-hidden="true" /> Verified merchant
              </span>
            ) : null}
          </h2>
          {merchant.description ? (
            <p className="mt-1 text-sm text-neutral-400">{merchant.description}</p>
          ) : null}
          {merchant.paymentAccount ? (
            <p className="mt-1 font-mono text-xs text-neutral-500">
              Payable to {merchant.paymentAccount}
            </p>
          ) : null}
        </div>
      </header>

      {/* Invoice line items */}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <caption className="sr-only">Invoice line items in {fiatCurrency.toUpperCase()}</caption>
          <thead className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Description</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-neutral-200">
                  {item.description}
                  {item.quantity > 1 ? (
                    <span className="ml-2 text-xs text-neutral-500">
                      {formatFiat(item.unitAmount, fiatCurrency)} each
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-400">{item.quantity}</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-200">
                  {formatFiat(item.unitAmount * item.quantity, fiatCurrency)}
                </td>
              </tr>
            ))}
            {anchorFee > 0 ? (
              <tr>
                <td className="px-4 py-3 text-neutral-400">Anchor fee</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-500">—</td>
                <td className="px-4 py-3 text-right font-mono text-neutral-200">
                  {formatFiat(anchorFee, fiatCurrency)}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot className="border-t border-neutral-800 bg-neutral-900/60">
            <tr>
              <th scope="row" colSpan={2} className="px-4 py-3 text-left font-medium text-neutral-300">
                Total due
              </th>
              <td className="px-4 py-3 text-right font-mono text-base font-semibold text-white" data-testid="sep31-total-fiat">
                {formatFiat(totalFiat, fiatCurrency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Conversion + rate lock */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-neutral-400">You pay</p>
          <p className="font-mono text-lg font-semibold text-lime-300" data-testid="sep31-token-amount">
            {tokenAmount} {assetCode}
          </p>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          1 {assetCode} = {activeRate > 0 ? Number(activeRate.toFixed(6)) : "—"} {fiatCurrency.toUpperCase()}
          {Number.isFinite(rate) && rate > 0 && Math.abs(rate - activeRate) > 1e-12 ? (
            <span className="ml-1 text-neutral-600">
              (now {Number(rate.toFixed(6))})
            </span>
          ) : null}
        </p>

        <div
          role="timer"
          aria-live="polite"
          data-testid="sep31-rate-lock"
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs ${
            isRateLocked
              ? secondsRemaining <= 60
                ? "bg-amber-400/10 text-amber-300"
                : "bg-emerald-400/10 text-emerald-300"
              : "bg-neutral-800 text-neutral-400"
          }`}
        >
          <Clock3 size={12} aria-hidden="true" />
          {isRateLocked
            ? `Rate locked for ${formatCountdown(secondsRemaining)}`
            : "Rate unlocked — requoting"}
        </div>
        {!isRateLocked ? (
          <p className="mt-2 text-xs text-amber-300/90">
            Your previous lock expired. The amount above is a new quote — pay before the rate moves again.
          </p>
        ) : null}
      </div>

      {/* Payment action / settlement status */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handlePay}
          disabled={payDisabled}
          data-testid="sep31-pay"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {isPaying ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck size={16} aria-hidden="true" />
          )}
          {isPaying
            ? "Submitting payment…"
            : `Pay ${tokenAmount} ${assetCode}`}
        </button>

        <SettlementStatusIndicator settlement={currentSettlement} assetCode={assetCode} />
      </div>

      {/* Error surface */}
      <AnimatePresence>
        {error ? (
          <motion.p
            key="sep31-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            data-testid="sep31-error"
            className="flex items-start gap-2 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* Receipt prompt */}
      {status === "settled" ? (
        <ReceiptPrompt
          email={receiptEmail}
          onEmailChange={setReceiptEmail}
          state={receiptState}
          onSubmit={handleReceipt}
          merchantName={merchant.name}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settlement status indicator
// ---------------------------------------------------------------------------

function SettlementStatusIndicator({
  settlement,
  assetCode,
}: {
  settlement: SEP31Settlement;
  assetCode: string;
}) {
  const { status } = settlement;

  const config = {
    awaiting_payment: {
      label: "Awaiting payment",
      description: `Send ${assetCode} to the merchant to start settlement.`,
      icon: Clock3,
      tone: "text-neutral-400",
      spinner: false,
    },
    pending: {
      label: "Confirming on chain",
      description: "The anchor is watching the network for your payment.",
      icon: Loader2,
      tone: "text-blue-300",
      spinner: true,
    },
    settled: {
      label: "Settled",
      description: "The anchor confirmed receipt and released the payout.",
      icon: CheckCircle2,
      tone: "text-emerald-300",
      spinner: false,
    },
    failed: {
      label: "Settlement failed",
      description: settlement.failureReason ?? "The anchor could not settle this payment.",
      icon: OctagonAlert,
      tone: "text-rose-300",
      spinner: false,
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      aria-live="polite"
      data-testid="sep31-settlement-status"
      data-status={status}
      className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${config.tone} ${config.spinner ? "animate-spin" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${config.tone}`}>{config.label}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-400">{config.description}</p>
        {settlement.transactionHash ? (
          <p className="mt-1.5 break-all font-mono text-xs text-neutral-500">
            {settlement.transactionHash}
          </p>
        ) : null}
        {settlement.moreInfoUrl ? (
          <a
            href={settlement.moreInfoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-xs text-blue-300 hover:underline"
          >
            View anchor record
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipt prompt
// ---------------------------------------------------------------------------

function ReceiptPrompt({
  email,
  onEmailChange,
  state,
  onSubmit,
  merchantName,
}: {
  email: string;
  onEmailChange: (value: string) => void;
  state: "idle" | "sending" | "sent";
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  merchantName: string;
}) {
  if (state === "sent") {
    return (
      <div
        data-testid="sep31-receipt-sent"
        className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200"
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        Receipt sent to {email}. Keep it for your records.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="sep31-receipt-prompt"
      className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 sm:flex-row sm:items-center"
    >
      <label htmlFor="sep31-receipt-email" className="flex-1 text-sm text-neutral-300">
        Email this receipt for your {merchantName} payment
      </label>
      <div className="flex gap-2">
        <input
          id="sep31-receipt-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="min-h-10 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-neutral-600 sm:w-56"
        />
        <button
          type="submit"
          disabled={state === "sending" || !isValidReceiptEmail(email)}
          data-testid="sep31-receipt-submit"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-neutral-100 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {state === "sending" ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Mail size={14} aria-hidden="true" />
          )}
          Send
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Settlement payload normalisation
// ---------------------------------------------------------------------------

/**
 * Coerce an anchor status payload into our settlement shape, falling back to
 * `pending` so an unrecognised payload keeps the user in a truthful "checking"
 * state rather than a false success.
 */
export function normalizeSettlement(payload: unknown): SEP31Settlement {
  const record = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  const raw = typeof record.status === "string" ? record.status.toLowerCase() : "";
  const hash = record.transaction_hash ?? record.transactionHash;
  const failure = record.failure_reason ?? record.failureReason;
  const moreInfo = record.more_info_url ?? record.moreInfoUrl;
  const updatedAt = record.updated_at ?? record.updatedAt;

  const status: SEP31SettlementStatus =
    raw === "settled" || raw === "completed" || raw === "success"
      ? "settled"
      : raw === "failed" || raw === "error" || raw === "expired"
        ? "failed"
        : raw === "awaiting_payment" || raw === "pending_customer"
          ? "awaiting_payment"
          : "pending";

  return {
    status,
    transactionHash: typeof hash === "string" && hash ? hash : undefined,
    moreInfoUrl: typeof moreInfo === "string" && moreInfo ? moreInfo : undefined,
    failureReason: typeof failure === "string" && failure ? failure : undefined,
    updatedAt: typeof updatedAt === "string" && updatedAt ? updatedAt : undefined,
  };
}

export default SEP31MerchantCheckout;
