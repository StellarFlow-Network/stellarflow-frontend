import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/push/unsubscribe
 * Removes a Web Push subscription from the StellarFlow backend.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.endpoint) {
      return NextResponse.json(
        { error: "endpoint is required" },
        { status: 400 },
      );
    }

    const backend = process.env.NEXT_PUBLIC_API_URL;
    if (backend) {
      const res = await fetch(`${backend.replace(/\/$/, "")}/push/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json(
          { error: "Backend unsubscribe failed", details: text },
          { status: res.status },
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, stored: "local" });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
