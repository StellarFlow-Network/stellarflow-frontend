import {
  SEND_ASSETS,
  type PayoutCorridor,
  type SendAsset,
} from "@/types/remittanceSend";
import type { Sep38Quote } from "@/types/remittanceSend";

/**
 * SEP-38 quoting rules for the cross-border send wizard (#1078).
 *
 * Holds the anchor payout corridor catalogue and the quote maths in one place
 * so both the `/api/remittance/*` route handlers and the wizard share the same
 * pricing rules. Kept free of Next imports so it stays unit testable.
 */

/**
 * Anchor payout corridor catalogue.
 *
 * Each entry pairs an on-ledger send asset with the fiat currency an anchor
 * settles into, plus the indicative rate quotes are built from. The E2E suite
 * mocks this endpoint, so treat the catalogue as the contract the wizard
 * depends on rather than a live liquidity feed.
 */
export const PAYOUT_CORRIDORS: PayoutCorridor[] = [
  {
    id: "usdc-kes",
    sourceAsset: "USDC",
    destinationAsset: "KES",
    destinationCountry: "Kenya",
    anchorName: "Kotani Pay Off-Ramp",
    settlementMethod: "M-PESA",
    etaSeconds: 420,
    baseRate: 129.8,
    region: "Africa",
  },
  {
    id: "usdc-ngn",
    sourceAsset: "USDC",
    destinationAsset: "NGN",
    destinationCountry: "Nigeria",
    anchorName: "AnchorXNG",
    settlementMethod: "NIP Transfer",
    etaSeconds: 540,
    baseRate: 1487.5,
    region: "Africa",
  },
  {
    id: "xlm-ngn",
    sourceAsset: "XLM",
    destinationAsset: "NGN",
    destinationCountry: "Nigeria",
    anchorName: "AnchorXNG",
    settlementMethod: "NIP Transfer",
    etaSeconds: 600,
    baseRate: 520.4,
    region: "Africa",
  },
  {
    id: "xlm-kes",
    sourceAsset: "XLM",
    destinationAsset: "KES",
    destinationCountry: "Kenya",
    anchorName: "Kotani Pay Off-Ramp",
    settlementMethod: "M-PESA",
    etaSeconds: 480,
    baseRate: 45.3,
    region: "Africa",
  },
  {
    id: "eurt-eur",
    sourceAsset: "EURT",
    destinationAsset: "EUR",
    destinationCountry: "Germany",
    anchorName: "Stellar Europe Rail",
    settlementMethod: "SEPA Instant",
    etaSeconds: 300,
    baseRate: 0.98,
    region: "Europe",
  },
];

/** Quote window, in seconds. Matches the rate lock advertised on the landing page. */
export const QUOTE_TTL_SECONDS = 60;

export function isSendAsset(value: string): value is SendAsset {
  return (SEND_ASSETS as readonly string[]).includes(value);
}

export function findCorridor(
  sourceAsset: string,
  destinationAsset: string,
): PayoutCorridor | undefined {
  return PAYOUT_CORRIDORS.find(
    (corridor) =>
      corridor.sourceAsset === sourceAsset &&
      corridor.destinationAsset === destinationAsset,
  );
}

/** Send assets that have at least one live corridor, in catalogue order. */
export function coveredSendAssets(): SendAsset[] {
  return SEND_ASSETS.filter((asset) =>
    PAYOUT_CORRIDORS.some((corridor) => corridor.sourceAsset === asset),
  );
}

/**
 * Build the SEP-38 quote set for one corridor/amount pair.
 *
 * Two providers are quoted per corridor so the wizard always has a choice to
 * present, with the cheaper provider listed first.
 */
export function buildQuotes(
  corridor: PayoutCorridor,
  amount: number,
  now: number = Date.now(),
): Sep38Quote[] {
  const providers = [
    { suffix: "direct", feePct: 0.0025, rateFactor: 1 },
    { suffix: "standard", feePct: 0.006, rateFactor: 0.996 },
  ];

  return providers.map((provider) => {
    const fee = Number((amount * provider.feePct).toFixed(6));
    const sendAmount = Number((amount + fee).toFixed(6));
    const rate = corridor.baseRate * provider.rateFactor;
    const receiveAmount = Number((amount * rate).toFixed(2));

    return {
      id: `${corridor.id}-${provider.suffix}`,
      sell_asset: corridor.destinationAsset,
      buy_asset: corridor.sourceAsset,
      sell_amount: receiveAmount.toFixed(2),
      buy_amount: sendAmount.toFixed(6),
      fee: fee.toFixed(6),
      price: rate.toFixed(4),
      fee_pct: (provider.feePct * 100).toFixed(2),
      expires_at: new Date(now + QUOTE_TTL_SECONDS * 1000).toISOString(),
      anchor_name: corridor.anchorName,
      settlement_method: corridor.settlementMethod,
      eta_seconds: corridor.etaSeconds,
      corridor_id: corridor.id,
    };
  });
}
