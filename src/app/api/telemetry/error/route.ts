import { NextResponse } from "next/server";

/**
 * API route to ingest client-side UI error logs.
 * Typically forwards to external telemetry services (e.g. Sentry/Datadog).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json();
    console.warn("[Telemetry API] UI Crash Report ingested:", payload);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Telemetry API] Failed to ingest UI error telemetry:", error);
    return NextResponse.json(
      { success: false, error: "Invalid payload" },
      { status: 400 }
    );
  }
}
