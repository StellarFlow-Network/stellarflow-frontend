'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  X,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  User,
  Banknote,
  BookmarkPlus,
} from 'lucide-react';
import {
  BENEFICIARY_COUNTRIES,
  COUNTRY_BANKING_RULES,
  addBeneficiary,
  forwardBeneficiaryToAnchor,
  loadSavedBeneficiaries,
  validateBeneficiary,
  type BeneficiaryBankDetails,
  type CountryBankingRule,
  type BeneficiaryFieldError,
  type PayoutAsset,
} from '@/lib/beneficiaries';

export interface BeneficiaryFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional pre-selected target country code (ISO 3166-1 alpha-2). */
  defaultCountry?: string;
  /** Called after the beneficiary is accepted by the anchor adapter. */
  onSubmitted?: (beneficiary: BeneficiaryBankDetails) => void;
  /** Called after the beneficiary is saved locally for reuse. */
  onSaved?: (beneficiaries: BeneficiaryBankDetails[]) => void;
}

interface FormState {
  country: string;
  accountHolderName: string;
  iban: string;
  accountNumber: string;
  routingCode: string;
  swiftBic: string;
  asset: PayoutAsset | '';
  memo: string;
}

const EMPTY_FORM: FormState = {
  country: '',
  accountHolderName: '',
  iban: '',
  accountNumber: '',
  routingCode: '',
  swiftBic: '',
  asset: '',
  memo: '',
};

const FIELD_ERRORS: Record<BeneficiaryFieldError, string> = {
  country_required: 'Select the beneficiary’s country.',
  name_required: 'Enter the account holder name.',
  iban_required: 'This country requires an IBAN.',
  iban_invalid: 'Enter a valid IBAN for the selected country.',
  account_required: 'Enter the bank account number.',
  account_invalid: 'Account number must be digits within the country’s length range.',
  routing_required: 'Enter the bank routing / code.',
  routing_invalid: 'Routing code must be 3–9 digits.',
  swift_required: 'This country requires a SWIFT/BIC code.',
  swift_invalid: 'Enter a valid 8 or 11 character SWIFT/BIC.',
  asset_required: 'Choose the payout asset.',
};

export function BeneficiaryForm({
  isOpen,
  onClose,
  defaultCountry,
  onSubmitted,
  onSaved,
}: BeneficiaryFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<BeneficiaryFieldError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [submitted, setSubmitted] = useState<BeneficiaryBankDetails | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const rule: CountryBankingRule | undefined = useMemo(
    () => COUNTRY_BANKING_RULES[form.country.toUpperCase()],
    [form.country],
  );

  const showIbanField =
    rule?.scheme === 'iban' ||
    (rule?.scheme === 'iban_or_account' && !form.accountNumber.trim());

  const showAccountFields =
    rule?.scheme === 'account' ||
    (rule?.scheme === 'iban_or_account' && !form.iban.trim());

  const [prevOpen, setPrevOpen] = useState(isOpen);

  // Reset the form whenever the modal transitions to open. Done during render
  // (storing previous props) so no setState-in-effect is needed.
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setForm({
        ...EMPTY_FORM,
        country: defaultCountry || '',
      });
      setError(null);
      setSubmitted(null);
      setSubmitError(null);
      setIsSubmitting(false);
      setIsSaved(false);
      setSavedCount(loadSavedBeneficiaries().length);
    }
  }

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (saveToBook: boolean) => {
      const payload: Omit<BeneficiaryBankDetails, 'createdAt'> = {
        country: form.country.toUpperCase(),
        accountHolderName: form.accountHolderName.trim(),
        iban: form.iban.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        routingCode: form.routingCode.trim() || undefined,
        swiftBic: form.swiftBic.trim().toUpperCase() || undefined,
        asset: form.asset || undefined,
        memo: form.memo.trim() || undefined,
      };

      const validationError = validateBeneficiary(payload);
      if (validationError) {
        setError(validationError);
        return;
      }

      const beneficiary: BeneficiaryBankDetails = {
        ...payload,
        createdAt: Date.now(),
      };

      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const result = await forwardBeneficiaryToAnchor(beneficiary);
        if (!result.ok) {
          setSubmitError(result.error || 'Anchor adapter rejected the beneficiary.');
          setIsSubmitting(false);
          return;
        }

        if (saveToBook) {
          addBeneficiary(beneficiary);
          setSavedCount(loadSavedBeneficiaries().length);
          setIsSaved(true);
          onSaved?.(loadSavedBeneficiaries());
        }

        setSubmitted(beneficiary);
        onSubmitted?.(beneficiary);
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, onSaved, onSubmitted],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <Landmark size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Beneficiary Bank Details
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Collected for SEP-24 / SEP-31 off-ramp anchors
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {submitted ? (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-500">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Beneficiary Registered
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                {submitted.accountHolderName} ({submitted.country}) is ready for
                off-ramp payouts
                {submitted.asset ? ` in ${submitted.asset}` : ''}.
              </p>
              {isSaved && (
                <p className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <BookmarkPlus size={14} /> Saved to your encrypted beneficiary book
                  {savedCount > 1 ? ` (${savedCount} total)` : ''}
                </p>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>
                  Details are validated against the target country’s banking rules,
                  forwarded directly to the anchor adapter, and — when you choose to
                  save — stored encrypted in your browser. Never shared or logged.
                </span>
              </div>

              {/* Country + payout asset */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    Target Country
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) => setField('country', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select country…</option>
                    {BENEFICIARY_COUNTRIES.map((c) => (
                      <option key={c.country} value={c.country}>
                        {c.countryName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    Payout Asset
                  </label>
                  <select
                    value={form.asset}
                    onChange={(e) => setField('asset', e.target.value as PayoutAsset)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select asset…</option>
                    {(rule?.assets ?? []).map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Account holder */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Account Holder Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Name as it appears on the account"
                    value={form.accountHolderName}
                    onChange={(e) => setField('accountHolderName', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Dynamic fields driven by country rules */}
              {rule && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <Banknote size={14} />
                    {rule.scheme === 'iban' && 'IBAN scheme required'}
                    {rule.scheme === 'account' && 'Local account scheme required'}
                    {rule.scheme === 'iban_or_account' && 'IBAN or local account'}
                  </p>

                  {showIbanField && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        IBAN
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                        value={form.iban}
                        onChange={(e) => setField('iban', e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                      />
                      {form.iban.trim().length > 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {showIbanField && rule.scheme !== 'iban_or_account'
                            ? `${rule.ibanLength} characters expected for ${rule.countryName}.`
                            : 'Leave empty to use a local account instead.'}
                        </p>
                      )}
                    </div>
                  )}

                  {showAccountFields && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={`${rule.accountMinLength}–${rule.accountMaxLength} digits`}
                          value={form.accountNumber}
                          onChange={(e) => setField('accountNumber', e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                        />
                      </div>
                      {rule.routingLabel && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            {rule.routingLabel}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g. 021000021"
                            value={form.routingCode}
                            onChange={(e) => setField('routingCode', e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {rule.requiresSwiftBic && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        SWIFT / BIC
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CHASGB2L"
                        value={form.swiftBic}
                        onChange={(e) => setField('swiftBic', e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono uppercase"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      Memo <span className="font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Salary — February"
                      value={form.memo}
                      onChange={(e) => setField('memo', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3 border border-red-200 dark:border-red-500/30">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{FIELD_ERRORS[error]}</span>
                </div>
              )}

              {submitError && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3 border border-red-200 dark:border-red-500/30">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    The anchor adapter could not be reached ({submitError}). Check
                    your connection and try again.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {!submitted && (
          <div className="p-6 pt-0 flex flex-col gap-3 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Submitting to anchor…
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> Submit & Save Beneficiary
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              disabled={isSubmitting}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
            >
              Submit without saving
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BeneficiaryForm;
