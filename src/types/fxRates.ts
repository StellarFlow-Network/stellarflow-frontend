/**
 * Types for the live global FX rate ticker & MTO comparison table (#718).
 */

/** Fiat currencies quoted against USD for the remittance corridors. */
export type FxCurrencyCode = "EUR" | "NGN" | "BRL" | "KES";

export interface FxRateQuote {
  currency: FxCurrencyCode;
  /** Units of `currency` received per 1 USD. */
  rate: number;
  /** Change vs the previous poll, in rate units (positive = currency strengthened vs USD is negative, kept simple as raw delta). */
  changeAbs: number;
  /** Percentage change vs the previous poll. */
  changePct: number;
  updatedAt: string;
}

export interface FxRatesResponse {
  base: "USD";
  quotes: FxRateQuote[];
  /** Server timestamp this snapshot was generated. */
  generatedAt: string;
  /** Seconds the quoted rates are guaranteed for before the next poll. */
  rateLockSeconds: number;
}

/** A traditional Money Transfer Operator used for the fee/rate comparison matrix. */
export interface MtoComparisonRow {
  provider: string;
  /** Flat + percentage fee summarized as a human string, e.g. "$4.99 + 1.2%". */
  feeSummary: string;
  /** Effective fee as a percentage of the transfer amount, for sorting/highlighting. */
  effectiveFeePct: number;
  /** Typical settlement time, e.g. "Minutes", "1-3 business days". */
  settlementTime: string;
  isStellarFlow?: boolean;
}
