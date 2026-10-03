/**
 * Types for the cross-border remittance send flow (SEP-38 quote selection).
 *
 * The shapes mirror the Stellar SEP-38 (quote) spec so the response can be
 * swapped for a real anchor deployment without touching the wizard UI, while
 * carrying the extra fields the off-ramp corridor selection needs.
 */

/** On-ledger assets StellarFlow can send from. */
export const SEND_ASSETS = ["USDC", "XLM", "EURT"] as const;
export type SendAsset = (typeof SEND_ASSETS)[number];

/** A single SEP-38 quote returned by the quote server. */
export interface Sep38Quote {
  /** Stable quote id — also used as the DOM value for the selection radio. */
  id: string;
  /** Destination currency the quote converts into. */
  sell_asset: string;
  /** Source asset debited from the sender. */
  buy_asset: string;
  /** Units of `sell_asset` delivered to the recipient. */
  sell_amount: string;
  /** Units of `buy_asset` debited from the sender. */
  buy_amount: string;
  /** Flat fee charged in `buy_asset`, already included in `buy_amount`. */
  fee: string;
  /** Mid-market rate: 1 unit of `buy_asset` buys this many `sell_asset`. */
  price: string;
  /** Provider-specific fee as a percentage of the notional amount. */
  fee_pct: string;
  /** ISO 8601 expiry; quotes are not honoured past this instant. */
  expires_at: string;
  /** Anchor that settles the off-ramp leg. */
  anchor_name: string;
  /** Local rail used for the payout (M-PESA, NIP, SEPA, …). */
  settlement_method: string;
  /** Expected seconds until the recipient is credited. */
  eta_seconds: number;
  /** Corridor the quote settles over. */
  corridor_id: string;
}

/** An anchor payout corridor available to the send wizard. */
export interface PayoutCorridor {
  id: string;
  sourceAsset: SendAsset;
  destinationAsset: string;
  destinationCountry: string;
  anchorName: string;
  settlementMethod: string;
  etaSeconds: number;
  /** Indicative mid rate, used as the base for generated quotes. */
  baseRate: number;
  region: string;
}

export interface PayoutCorridorList {
  corridors: PayoutCorridor[];
}

export interface QuoteList {
  quotes: Sep38Quote[];
}

/** A sent transfer, as displayed on the receipt. */
export interface RemittanceReceipt {
  referenceId: string;
  sendAmount: string;
  sendAsset: string;
  receiveAmount: string;
  receiveAsset: string;
  rate: string;
  fee: string;
  anchorName: string;
  settlementMethod: string;
  recipientName: string;
  recipientCountry: string;
  createdAt: string;
}
