import type { Metadata } from "next";
import SEP31SettlementReceiptPage from "./SEP31SettlementReceiptPage";

export const metadata: Metadata = {
  title: "SEP-31 Settlement Receipt | StellarFlow Network",
  description:
    "Final settlement confirmation for a cross-border merchant payment executed over a SEP-31 remittance corridor.",
};

interface SettlementRouteProps {
  params: Promise<{ txId: string }>;
}

/**
 * Direct transaction-reference link for the SEP-31 settlement receipt:
 *
 *   /remittance/<txReference>/settlement
 *
 * `<txReference>` accepts a payout id, an on-chain transaction hash, or an
 * anchor reference — the receipt component resolves whichever matches.
 */
export default async function SEP31SettlementReceiptRoute({
  params,
}: SettlementRouteProps) {
  const { txId } = await params;
  return <SEP31SettlementReceiptPage txRef={txId} />;
}
