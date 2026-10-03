"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from "lucide-react";
import {
  BENEFICIARY_COUNTRIES,
  COUNTRY_BANKING_RULES,
  validateBeneficiary,
  type BeneficiaryFieldError,
  type PayoutAsset,
} from "@/lib/beneficiaries";
import { SEND_ASSETS, type PayoutCorridor, type Sep38Quote } from "@/types/remittanceSend";

/**
 * Cross-border remittance send wizard (#1078).
 *
 * Four steps: pick a payout corridor and amount, choose a SEP-38 quote from
 * the providers covering that corridor, enter the beneficiary's bank details,
 * then review and submit. Submission mints a mock transaction reference and
 * hands off to the delivery tracking page.
 *
 * Every input carries a `data-testid` so the Cypress suite can drive the flow
 * without coupling to copy or class names.
 */

const MIN_SEND = 1;
const MAX_SEND = 100_000;

const STEPS = [
  { id: "amount", label: "Amount" },
  { id: "quote", label: "Rate" },
  { id: "recipient", label: "Recipient" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const FIELD_ERRORS: Record<BeneficiaryFieldError, string> = {
  country_required: "Select the recipient’s country.",
  name_required: "Enter the recipient’s full name.",
  iban_required: "An IBAN is required for this corridor.",
  iban_invalid: "That IBAN is not valid. Check the number and try again.",
  account_required: "Enter the recipient’s account number.",
  account_invalid: "That account number is not valid for this country.",
  routing_required: "Enter the bank code for this transfer.",
  routing_invalid: "The bank code must be 3–9 digits.",
  swift_required: "A SWIFT / BIC is required for this corridor.",
  swift_invalid: "That SWIFT / BIC is not valid.",
  asset_required: "Select the payout asset.",
};

interface RecipientForm {
  country: string;
  accountHolderName: string;
  iban: string;
  accountNumber: string;
  routingCode: string;
  swiftBic: string;
  asset: PayoutAsset | "";
}

const EMPTY_RECIPIENT: RecipientForm = {
  country: "",
  accountHolderName: "",
  iban: "",
  accountNumber: "",
  routingCode: "",
  swiftBic: "",
  asset: "",
};

export default function RemittanceSendWizard() {
  const [step, setStep] = useState<StepId>("amount");
  const [corridors, setCorridors] = useState<PayoutCorridor[]>([]);
  const [corridorId, setCorridorId] = useState("");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Sep38Quote[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const [recipient, setRecipient] = useState<RecipientForm>(EMPTY_RECIPIENT);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const corridor = useMemo(
    () => corridors.find((item) => item.id === corridorId) ?? null,
    [corridors, corridorId],
  );
  const quote = useMemo(
    () => quotes.find((item) => item.id === quoteId) ?? null,
    [quotes, quoteId],
  );
  const stepIndex = STEPS.findIndex((item) => item.id === step);
  const countryRule = recipient.country
    ? COUNTRY_BANKING_RULES[recipient.country]
    : undefined;
  const usesIban = countryRule?.scheme === "iban";

  useEffect(() => {
    let active = true;
    fetch("/api/remittance/corridors", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { corridors?: PayoutCorridor[] }) => {
        if (active) setCorridors(data.corridors ?? []);
      })
      .catch(() => {
        if (active) setCorridors([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetFromAmount = () => {
    setStep("amount");
    setQuotes([]);
    setQuoteId("");
    setQuotesError(null);
    setRecipientError(null);
  };

  const validateAmount = useCallback((): number | null => {
    const trimmed = amount.trim();
    if (!trimmed) {
      setAmountError("Enter an amount to send.");
      return null;
    }
    if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
      setAmountError("Enter a valid amount using up to 7 decimal places.");
      return null;
    }
    const value = Number(trimmed);
    if (value < MIN_SEND) {
      setAmountError(`The minimum transfer is ${MIN_SEND} ${corridor?.sourceAsset ?? ""}.`.trim());
      return null;
    }
    if (value > MAX_SEND) {
      setAmountError(`The maximum transfer is ${MAX_SEND.toLocaleString()} ${corridor?.sourceAsset ?? ""}.`.trim());
      return null;
    }
    setAmountError(null);
    return value;
  }, [amount, corridor]);

  const fetchQuotes = useCallback(async () => {
    if (!corridor) {
      setAmountError("Select a payout corridor first.");
      return;
    }
    const value = validateAmount();
    if (value === null) return;

    setQuotesLoading(true);
    setQuotesError(null);
    try {
      const params = new URLSearchParams({
        buy_asset: corridor.sourceAsset,
        sell_asset: corridor.destinationAsset,
        amount: String(value),
      });
      const response = await fetch(`/api/remittance/quote?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setQuotes([]);
        setQuoteId("");
        setQuotesError("No providers are quoting this corridor right now.");
        return;
      }
      const data: { quotes?: Sep38Quote[] } = await response.json();
      const nextQuotes = data.quotes ?? [];
      setQuotes(nextQuotes);
      setQuoteId(nextQuotes[0]?.id ?? "");
      if (nextQuotes.length === 0) {
        setQuotesError("No providers are quoting this corridor right now.");
        return;
      }
      setStep("quote");
    } catch {
      setQuotes([]);
      setQuoteId("");
      setQuotesError("Could not reach the quote server. Try again.");
    } finally {
      setQuotesLoading(false);
    }
  }, [corridor, validateAmount]);

  const validateRecipient = useCallback((): boolean => {
    const error = validateBeneficiary({
      country: recipient.country,
      accountHolderName: recipient.accountHolderName,
      iban: recipient.iban,
      accountNumber: recipient.accountNumber,
      routingCode: recipient.routingCode,
      swiftBic: recipient.swiftBic,
      asset: recipient.asset === "" ? undefined : recipient.asset,
    });
    setRecipientError(error ? FIELD_ERRORS[error] : null);
    return error === null;
  }, [recipient]);

  const submitTransfer = useCallback(async () => {
    if (!quote || !corridor) return;
    if (!validateRecipient()) {
      setStep("recipient");
      return;
    }

    setSubmitting(true);
    try {
      // A real submission posts to the anchor adapter; the reference comes back
      // from the backend. Until that is wired up, mint one locally so the
      // tracking handoff is exercisable end to end.
      await new Promise((resolve) => setTimeout(resolve, 300));
      setReferenceId(`REF-STF-${Math.floor(10000 + Math.random() * 89999)}`);
    } finally {
      setSubmitting(false);
    }
  }, [quote, corridor, validateRecipient]);

  if (referenceId && quote && corridor) {
    return (
      <section
        data-testid="send-receipt"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6"
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <Check size={18} />
          <h2 className="text-lg font-semibold">Transfer submitted</h2>
        </div>
        <p className="mt-2 text-sm text-neutral-300">
          Your transfer is on its way. Track delivery with the reference below.
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              Reference ID
            </dt>
            <dd
              data-testid="receipt-reference-id"
              className="mt-1 font-mono text-base font-semibold text-emerald-200"
            >
              {referenceId}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              Recipient receives
            </dt>
            <dd
              data-testid="receipt-receive-amount"
              className="mt-1 font-mono text-base font-semibold text-white"
            >
              {quote.sell_amount} {quote.sell_asset}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              You send
            </dt>
            <dd
              data-testid="receipt-send-amount"
              className="mt-1 font-mono text-base font-semibold text-white"
            >
              {quote.buy_amount} {quote.buy_asset}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">
              Off-ramp anchor
            </dt>
            <dd
              data-testid="receipt-anchor"
              className="mt-1 font-mono text-base font-semibold text-white"
            >
              {quote.anchor_name}
            </dd>
          </div>
        </dl>
        <a
          href={`/remittance/track/${referenceId}`}
          data-testid="receipt-track-link"
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300"
        >
          Track delivery
          <ArrowRight size={16} />
        </a>
      </section>
    );
  }

  return (
    <section
      data-testid="remittance-send-wizard"
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-neutral-100"
    >
      <nav aria-label="Send progress" className="mb-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((item, index) => {
            const isCurrent = item.id === step;
            const isDone = index < stepIndex;
            return (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  data-testid={`send-step-${item.id}`}
                  data-state={isCurrent ? "current" : isDone ? "done" : "upcoming"}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isCurrent
                      ? "bg-emerald-400 text-neutral-950"
                      : isDone
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/5 text-neutral-500"
                  }`}
                >
                  {item.label}
                </span>
                {index < STEPS.length - 1 && <span className="text-neutral-700">→</span>}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "amount" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Where are you sending from?</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Pick the corridor and the on-ledger asset you want to send.
            </p>
          </div>

          <div>
            <label
              htmlFor="send-corridor"
              className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
            >
              Payout corridor
            </label>
            <select
              id="send-corridor"
              data-testid="send-corridor"
              value={corridorId}
              onChange={(event) => {
                setCorridorId(event.target.value);
                setAmountError(null);
              }}
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
            >
              <option value="">Select a corridor…</option>
              {corridors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sourceAsset} → {item.destinationAsset} ({item.destinationCountry})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="send-asset"
              className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
            >
              Send asset
            </label>
            <select
              id="send-asset"
              data-testid="send-asset"
              value={corridor?.sourceAsset ?? ""}
              onChange={(event) => {
                const next = corridors.find(
                  (item) => item.sourceAsset === event.target.value,
                );
                if (next) setCorridorId(next.id);
              }}
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
            >
              <option value="">Select an asset…</option>
              {SEND_ASSETS.map((asset) => {
                const isCovered = corridors.some(
                  (item) => item.sourceAsset === asset,
                );
                return (
                  <option key={asset} value={asset} disabled={!isCovered}>
                    {asset}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="send-amount"
              className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
            >
              Amount to send
            </label>
            <input
              id="send-amount"
              data-testid="send-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setAmountError(null);
              }}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Minimum {MIN_SEND}, maximum {MAX_SEND.toLocaleString()}.
            </p>
          </div>

          {amountError && (
            <p
              data-testid="send-amount-error"
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {amountError}
            </p>
          )}

          <button
            type="button"
            data-testid="send-get-quotes"
            onClick={fetchQuotes}
            disabled={quotesLoading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
          >
            {quotesLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Get quotes
          </button>
        </div>
      )}

      {step === "quote" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Choose a rate</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Providers quoting {corridor?.sourceAsset} → {corridor?.destinationAsset}.
            </p>
          </div>

          <fieldset>
            <legend className="sr-only">Available quotes</legend>
            <div className="space-y-3">
              {quotes.map((item) => {
                const isSelected = item.id === quoteId;
                return (
                  <label
                    key={item.id}
                    data-testid={`quote-option-${item.id}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-400/10"
                        : "border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quote"
                      data-testid={`quote-radio-${item.id}`}
                      value={item.id}
                      checked={isSelected}
                      onChange={() => setQuoteId(item.id)}
                      className="mt-1 accent-emerald-400"
                    />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono text-base font-semibold text-white">
                          {item.sell_amount} {item.sell_asset}
                        </span>
                        <span className="text-xs text-neutral-400">
                          1 {item.buy_asset} = {item.price} {item.sell_asset}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-neutral-400">
                        {item.anchor_name} · {item.settlement_method} · fee{" "}
                        {item.fee} {item.buy_asset} ({item.fee_pct}%) · arrives in{" "}
                        {Math.round(item.eta_seconds / 60)} min
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {quotesError && (
            <p
              data-testid="send-quotes-error"
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {quotesError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="send-back-to-amount"
              onClick={resetFromAmount}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neutral-700 px-4 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              data-testid="send-continue-to-recipient"
              onClick={() => setStep("recipient")}
              disabled={!quoteId}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "recipient" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Recipient details</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Validated against {corridor?.destinationCountry ?? "the destination"}{" "}
              banking rules before the transfer is submitted.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="recipient-country"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                Recipient country
              </label>
              <select
                id="recipient-country"
                data-testid="recipient-country"
                value={recipient.country}
                onChange={(event) =>
                  setRecipient((prev) => ({
                    ...prev,
                    country: event.target.value,
                    asset: "",
                  }))
                }
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              >
                <option value="">Select a country…</option>
                {BENEFICIARY_COUNTRIES.map((item) => (
                  <option key={item.country} value={item.country}>
                    {item.countryName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="recipient-name"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                Account holder name
              </label>
              <input
                id="recipient-name"
                data-testid="recipient-name"
                type="text"
                value={recipient.accountHolderName}
                onChange={(event) =>
                  setRecipient((prev) => ({
                    ...prev,
                    accountHolderName: event.target.value,
                  }))
                }
                placeholder="Name as it appears on the account"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {usesIban && (
            <div>
              <label
                htmlFor="recipient-iban"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                IBAN
              </label>
              <input
                id="recipient-iban"
                data-testid="recipient-iban"
                type="text"
                value={recipient.iban}
                onChange={(event) =>
                  setRecipient((prev) => ({ ...prev, iban: event.target.value }))
                }
                placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {!usesIban && countryRule && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="recipient-account"
                  className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
                >
                  Account number
                </label>
                <input
                  id="recipient-account"
                  data-testid="recipient-account"
                  type="text"
                  inputMode="numeric"
                  value={recipient.accountNumber}
                  onChange={(event) =>
                    setRecipient((prev) => ({
                      ...prev,
                      accountNumber: event.target.value,
                    }))
                  }
                  placeholder={`${countryRule.accountMinLength}–${countryRule.accountMaxLength} digits`}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                />
              </div>

              {countryRule.routingLabel && (
                <div>
                  <label
                    htmlFor="recipient-routing"
                    className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
                  >
                    {countryRule.routingLabel}
                  </label>
                  <input
                    id="recipient-routing"
                    data-testid="recipient-routing"
                    type="text"
                    inputMode="numeric"
                    value={recipient.routingCode}
                    onChange={(event) =>
                      setRecipient((prev) => ({
                        ...prev,
                        routingCode: event.target.value,
                      }))
                    }
                    placeholder="e.g. 021000021"
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </div>
              )}
            </div>
          )}

          {countryRule?.requiresSwiftBic && (
            <div>
              <label
                htmlFor="recipient-swift"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                SWIFT / BIC
              </label>
              <input
                id="recipient-swift"
                data-testid="recipient-swift"
                type="text"
                value={recipient.swiftBic}
                onChange={(event) =>
                  setRecipient((prev) => ({
                    ...prev,
                    swiftBic: event.target.value,
                  }))
                }
                placeholder="e.g. CHASGB2L"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {countryRule && (
            <div>
              <label
                htmlFor="recipient-asset"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                Payout asset
              </label>
              <select
                id="recipient-asset"
                data-testid="recipient-asset"
                value={recipient.asset}
                onChange={(event) =>
                  setRecipient((prev) => ({
                    ...prev,
                    asset: event.target.value as PayoutAsset,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
              >
                <option value="">Select an asset…</option>
                {countryRule.assets.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </div>
          )}

          {recipientError && (
            <p
              data-testid="recipient-error"
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {recipientError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="send-back-to-quote"
              onClick={() => setStep("quote")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neutral-700 px-4 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              data-testid="send-continue-to-review"
              onClick={() => {
                if (validateRecipient()) setStep("review");
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300"
            >
              Review <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "review" && quote && corridor && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Review and send</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Check the details before the transfer is submitted to the anchor.
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2" data-testid="send-review-summary">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Corridor</dt>
              <dd data-testid="review-corridor" className="mt-1 font-mono text-white">
                {corridor.sourceAsset} → {corridor.destinationAsset} (
                {corridor.destinationCountry})
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">You send</dt>
              <dd data-testid="review-send-amount" className="mt-1 font-mono text-white">
                {quote.buy_amount} {quote.buy_asset}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">
                Recipient receives
              </dt>
              <dd data-testid="review-receive-amount" className="mt-1 font-mono text-white">
                {quote.sell_amount} {quote.sell_asset}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Fee</dt>
              <dd data-testid="review-fee" className="mt-1 font-mono text-white">
                {quote.fee} {quote.buy_asset} ({quote.fee_pct}%)
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Recipient</dt>
              <dd data-testid="review-recipient" className="mt-1 text-white">
                {recipient.accountHolderName} ({recipient.country})
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Settles via</dt>
              <dd data-testid="review-anchor" className="mt-1 text-white">
                {quote.anchor_name} · {quote.settlement_method}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="send-back-to-recipient"
              onClick={() => setStep("recipient")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neutral-700 px-4 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              data-testid="send-submit"
              onClick={submitTransfer}
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Confirm and send
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
