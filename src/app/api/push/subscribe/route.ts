import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/push/subscribe
 * Proxies Web Push subscription + preferences to the StellarFlow backend.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.subscription?.endpoint || !body?.subscription?.keys) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 },
      );
    }

    const backend = process.env.NEXT_PUBLIC_API_URL;
    if (backend) {
      const res = await fetch(`${backend.replace(/\/$/, "")}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: "Backend subscribe failed", details: data },
          { status: res.status },
        );
      }
      return NextResponse.json({ ok: true, ...(typeof data === "object" && data ? data : {}) });
    }

    // Dev / offline fallback — accept and acknowledge locally
    return NextResponse.json({
      ok: true,
      stored: "local",
      message: "Subscription accepted (no NEXT_PUBLIC_API_URL configured)",
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
