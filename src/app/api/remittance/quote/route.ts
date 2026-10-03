import { NextResponse } from "next/server";
import { buildQuotes, findCorridor } from "@/lib/remittanceSend";
import type { QuoteList } from "@/types/remittanceSend";

/**
 * SEP-38 quote server stand-in (#1078).
 *
 * Accepts the SEP-38 query shape (`sell_asset`, `buy_asset`, `amount`) and
 * returns one quote per available provider on the matching corridor. Swap the
 * `buildQuotes` call for an anchor's real `/quote` endpoint when one is
 * connected — `QuoteList` is the only contract the wizard relies on.
 *
 * The E2E suite intercepts this route with `cy.intercept` to pin rates and fee
 * schedules, so quote maths here only needs to be deterministic, not
 * economically accurate.
 */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const buyAsset = params.get("buy_asset") ?? "";
  const sellAsset = params.get("sell_asset") ?? "";
  const rawAmount = params.get("amount") ?? "";

  if (!buyAsset || !sellAsset) {
    return NextResponse.json(
      { error: "buy_asset and sell_asset are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const corridor = findCorridor(buyAsset, sellAsset);
  if (!corridor) {
    return NextResponse.json(
      { error: `unsupported corridor ${buyAsset}->${sellAsset}` },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body: QuoteList = { quotes: buildQuotes(corridor, amount) };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
