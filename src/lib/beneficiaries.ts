/**
 * Beneficiary banking-domain library (#535).
 *
 * Pure validation + persistence + anchor-adapter forwarding for the
 * off-ramp beneficiary form. Kept free of React so the rules can be unit
 * tested in isolation and reused server-side if needed.
 *
 * The off-ramp anchor gateways (SEP-24 / SEP-31) require beneficiary bank
 * details whose shape depends on the *target* country — some countries use
 * IBAN, others use local account + routing/bank codes. This module encodes
 * those rules and validates input before anything is persisted or sent.
 */

import { getItem, removeItem, setItem } from "@/utils/storage";

/** Storage key for encrypted saved beneficiaries (see `@/utils/storage`). */
export const BENEFICIARIES_STORAGE_KEY = "stellarflow.beneficiaries.v1";

/**
 * The on-ledger asset / payout currency this beneficiary is meant for.
 * Mirrors SEP-31 `asset_code` semantics.
 */
export type PayoutAsset = "USDC" | "XLM" | "EURT" | "NGNT";

/** Supported banking schemes, driven by the target country's rules. */
export type BankingScheme = "iban" | "account" | "iban_or_account";

/** Validated beneficiary bank details forwarded to the anchor adapter. */
export interface BeneficiaryBankDetails {
  /** ISO 3166-1 alpha-2 target country code, uppercase. */
  country: string;
  /** Recipient account holder name (as it appears on the account). */
  accountHolderName: string;
  /** IBAN, present only when the country uses the IBAN scheme. */
  iban?: string;
  /** Local account number (US, NGN, KES, …), present otherwise. */
  accountNumber?: string;
  /** Country-specific code: US ABA routing, NGN bank code, KES bank code. */
  routingCode?: string;
  /** ISO 9362 SWIFT/BIC when the scheme requires it for cross-border. */
  swiftBic?: string;
  /** Payout asset the beneficiary receives. */
  asset?: PayoutAsset;
  /** Free-form memo surfaced to the anchor (optional). */
  memo?: string;
  /** Epoch ms when the beneficiary was created. */
  createdAt: number;
}

/** Banking rules for one target country. */
export interface CountryBankingRule {
  country: string;
  countryName: string;
  scheme: BankingScheme;
  /** Required length of the IBAN for `iban` schemes. */
  ibanLength?: number;
  /** Minimum length of the local account number for `account` schemes. */
  accountMinLength: number;
  /** Maximum length of the local account number. */
  accountMaxLength: number;
  /** Label for the routing/code field (e.g. "Routing Number"). */
  routingLabel?: string;
  /** Whether a SWIFT/BIC is mandatory. */
  requiresSwiftBic?: boolean;
  /** Supported payout assets for this country. */
  assets: PayoutAsset[];
}

/**
 * Banking rules for the corridors StellarFlow actively supports.
 * Extend this map to add new off-ramp destinations.
 */
export const COUNTRY_BANKING_RULES: Record<string, CountryBankingRule> = {
  US: {
    country: "US",
    countryName: "United States",
    scheme: "account",
    accountMinLength: 8,
    accountMaxLength: 17,
    routingLabel: "ABA Routing Number",
    assets: ["USDC", "XLM"],
  },
  GB: {
    country: "GB",
    countryName: "United Kingdom",
    scheme: "iban",
    ibanLength: 22,
    requiresSwiftBic: true,
    assets: ["USDC", "EURT", "XLM"],
  },
  NG: {
    country: "NG",
    countryName: "Nigeria",
    scheme: "account",
    accountMinLength: 10,
    accountMaxLength: 10,
    routingLabel: "Bank Code",
    assets: ["USDC", "NGNT", "XLM"],
  },
  KE: {
    country: "KE",
    countryName: "Kenya",
    scheme: "account",
    accountMinLength: 6,
    accountMaxLength: 12,
    routingLabel: "Bank Code",
    assets: ["USDC", "XLM"],
  },
  GH: {
    country: "GH",
    countryName: "Ghana",
    scheme: "account",
    accountMinLength: 6,
    accountMaxLength: 18,
    routingLabel: "Bank Code",
    assets: ["USDC", "XLM"],
  },
  DE: {
    country: "DE",
    countryName: "Germany",
    scheme: "iban",
    ibanLength: 22,
    requiresSwiftBic: true,
    assets: ["USDC", "EURT", "XLM"],
  },
};

/** Ordered list of selectable target countries. */
export const BENEFICIARY_COUNTRIES: CountryBankingRule[] = Object.values(
  COUNTRY_BANKING_RULES,
).sort((a, b) => a.countryName.localeCompare(b.countryName));

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an IBAN's checksum using the standard MOD-97 algorithm after
 * removing spaces and uppercasing. Returns `true` for structurally valid
 * IBANs of the expected length.
 */
export function isValidIban(iban: string, expectedLength?: number): boolean {
  const normalized = iban.replace(/\s+/g, "").toUpperCase();
  if (expectedLength !== undefined && normalized.length !== expectedLength) {
    return false;
  }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalized)) {
    return false;
  }

  // Rearrange: first four characters moved to the end, then letters expand to
  // their 10..35 two-digit values (A=10 … Z=35) for the MOD-97 computation.
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char)
      ? char
      : String(char.charCodeAt(0) - "A".charCodeAt(0) + 10);
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * Validate a local account number: digits only, within the country's
 * configured length bounds.
 */
export function isValidAccountNumber(
  accountNumber: string,
  rule: CountryBankingRule,
): boolean {
  if (!/^\d+$/.test(accountNumber)) {
    return false;
  }
  return (
    accountNumber.length >= rule.accountMinLength &&
    accountNumber.length <= rule.accountMaxLength
  );
}

/**
 * Validate a routing/code field (ABA, bank code) as digits only.
 * Lengths are country-specific but we require at least 3 digits.
 */
export function isValidRoutingCode(routingCode: string): boolean {
  return /^\d{3,9}$/.test(routingCode);
}

/** ISO 9362 SWIFT/BIC — 8 or 11 uppercase letters + optional digits. */
export function isValidSwiftBic(swiftBic: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swiftBic.toUpperCase());
}

export type BeneficiaryFieldError =
  | "country_required"
  | "name_required"
  | "iban_required"
  | "iban_invalid"
  | "account_required"
  | "account_invalid"
  | "routing_required"
  | "routing_invalid"
  | "swift_required"
  | "swift_invalid"
  | "asset_required";

/**
 * Validate a full beneficiary payload against the target country's banking
 * rule. Returns `null` when valid, otherwise the first failing field.
 */
export function validateBeneficiary(
  beneficiary: Omit<BeneficiaryBankDetails, "createdAt">,
): BeneficiaryFieldError | null {
  if (!beneficiary.country) return "country_required";
  if (!beneficiary.accountHolderName?.trim()) return "name_required";

  const rule = COUNTRY_BANKING_RULES[beneficiary.country.toUpperCase()];
  if (!rule) return "country_required";

  if (rule.scheme === "iban" || rule.scheme === "iban_or_account") {
    const usesIban = Boolean(beneficiary.iban && beneficiary.iban.trim());
    if (usesIban) {
      if (!isValidIban(beneficiary.iban as string, rule.ibanLength)) {
        return "iban_invalid";
      }
    } else if (rule.scheme === "iban") {
      return "iban_required";
    }
  }

  const needsAccount = rule.scheme === "account" || !beneficiary.iban?.trim();
  if (needsAccount) {
    if (!beneficiary.accountNumber) return "account_required";
    if (!isValidAccountNumber(beneficiary.accountNumber, rule)) {
      return "account_invalid";
    }
    if (rule.routingLabel && !beneficiary.routingCode) {
      return "routing_required";
    }
    if (beneficiary.routingCode && !isValidRoutingCode(beneficiary.routingCode)) {
      return "routing_invalid";
    }
  }

  if (rule.requiresSwiftBic) {
    if (!beneficiary.swiftBic) return "swift_required";
    if (!isValidSwiftBic(beneficiary.swiftBic)) return "swift_invalid";
  }

  if (!beneficiary.asset) return "asset_required";
  return null;
}

// ---------------------------------------------------------------------------
// Persistence (encrypted browser local storage)
// ---------------------------------------------------------------------------

/** Load saved beneficiaries from encrypted local storage. */
export function loadSavedBeneficiaries(): BeneficiaryBankDetails[] {
  return (
    getItem<BeneficiaryBankDetails[]>(
      BENEFICIARIES_STORAGE_KEY,
      (value): value is BeneficiaryBankDetails[] => Array.isArray(value),
      [],
    ) ?? []
  );
}

/** Persist the full list of beneficiaries to encrypted local storage. */
export function saveBeneficiaries(
  beneficiaries: BeneficiaryBankDetails[],
): void {
  setItem(BENEFICIARIES_STORAGE_KEY, beneficiaries);
}

/** Add a beneficiary (dedup by country+account+iban) and persist. */
export function addBeneficiary(
  beneficiary: BeneficiaryBankDetails,
): BeneficiaryBankDetails[] {
  const current = loadSavedBeneficiaries();
  const key = beneficiary.iban || beneficiary.accountNumber || "";
  const exists = current.some(
    (b) =>
      (b.iban || b.accountNumber || "") === key &&
      b.country === beneficiary.country,
  );
  if (!exists) {
    current.push(beneficiary);
  }
  saveBeneficiaries(current);
  return current;
}

/** Remove a beneficiary by index and persist the updated list. */
export function removeBeneficiary(index: number): BeneficiaryBankDetails[] {
  const current = loadSavedBeneficiaries();
  const next = current.filter((_, i) => i !== index);
  saveBeneficiaries(next);
  return next;
}

/** Wipe all saved beneficiaries. */
export function clearBeneficiaries(): void {
  removeItem(BENEFICIARIES_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Anchor-adapter forwarding
// ---------------------------------------------------------------------------

/**
 * Forward the beneficiary payload to the backend anchor adapter.
 *
 * The payload is never logged and never placed in the URL — it is POSTed
 * as JSON to `${NEXT_PUBLIC_API_URL}/anchor/beneficiaries`. In development
 * (no backend configured) this resolves to a mock adapter so the form is
 * fully exercisable without a live service.
 */
export async function forwardBeneficiaryToAnchor(
  beneficiary: BeneficiaryBankDetails,
): Promise<{ ok: boolean; reference?: string; error?: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    // Development / mock anchor adapter — simulate a successful submission.
    const reference = `dev-${Date.now().toString(36)}`;
    return { ok: true, reference };
  }

  try {
    const response = await fetch(`${apiUrl}/anchor/beneficiaries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secure, short-lived context: never a long-lived secret.
        "X-StellarFlow-Client": "offramp-beneficiary-form",
      },
      body: JSON.stringify(beneficiary),
    });

    if (!response.ok) {
      return { ok: false, error: `anchor_adapter_${response.status}` };
    }

    const data = (await response.json()) as { reference?: string };
    return { ok: true, reference: data.reference };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "anchor_adapter_unreachable",
    };
  }
}
