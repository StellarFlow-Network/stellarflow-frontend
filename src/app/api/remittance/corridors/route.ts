import { NextResponse } from "next/server";
import { PAYOUT_CORRIDORS } from "@/lib/remittanceSend";
import type { PayoutCorridorList } from "@/types/remittanceSend";

/**
 * Anchor payout corridor catalogue (#1078).
 *
 * Serves the corridors the send wizard can route over. The pricing rules live
 * in `@/lib/remittanceSend` so this handler stays a thin transport.
 */

export async function GET() {
  const body: PayoutCorridorList = { corridors: PAYOUT_CORRIDORS };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
