import { NextResponse } from "next/server";
import { cspViolationStore } from "@/lib/security/cspViolationStore";
import { isBrowserExtensionViolation, type CspViolationMetadata } from "@/utils/cspReporter";

/**
 * Normalizes browser-native CSP report formats or custom JSON payloads.
 * Browser native CSP reports often send:
 * { "csp-report": { "blocked-uri": "...", "violated-directive": "...", "document-uri": "..." } }
 */
function parseCspPayload(body: any): Partial<CspViolationMetadata> {
  if (!body) return {};

  // Standard browser CSP report wrapper
  if (body["csp-report"]) {
    const raw = body["csp-report"];
    return {
      blockedURI: raw["blocked-uri"] || raw.blockedURI || "unknown",
      violatedDirective: raw["violated-directive"] || raw.violatedDirective || "unknown",
      effectiveDirective: raw["effective-directive"] || raw.effectiveDirective,
      originalPolicy: raw["original-policy"] || raw.originalPolicy,
      documentURI: raw["document-uri"] || raw.documentURI || "unknown",
      referrer: raw["referrer"] || raw.referrer,
      sample: raw["script-sample"] || raw.sample,
      disposition: (raw["disposition"] as "enforce" | "report") || "enforce",
      statusCode: raw["status-code"] ? Number(raw["status-code"]) : 0,
      sourceFile: raw["source-file"] || raw.sourceFile,
      lineNumber: raw["line-number"] ? Number(raw["line-number"]) : undefined,
      columnNumber: raw["column-number"] ? Number(raw["column-number"]) : undefined,
      timestamp: new Date().toISOString(),
      userAgent: "BrowserNative",
    };
  }

  // Custom formatted payload from cspReporter.ts
  return {
    blockedURI: body.blockedURI || "unknown",
    violatedDirective: body.violatedDirective || "unknown",
    effectiveDirective: body.effectiveDirective,
    documentURI: body.documentURI || "unknown",
    referrer: body.referrer,
    sample: body.sample,
    disposition: (body.disposition as "enforce" | "report") || "enforce",
    statusCode: Number(body.statusCode) || 0,
    lineNumber: body.lineNumber,
    columnNumber: body.columnNumber,
    sourceFile: body.sourceFile,
    originalPolicy: body.originalPolicy,
    timestamp: body.timestamp || new Date().toISOString(),
    userAgent: body.userAgent || "Unknown",
    isExtensionNoise: body.isExtensionNoise,
  };
}

/**
 * POST /api/v1/security/csp-report
 * Ingests client-side and browser-native CSP violation reports.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    let rawBody: any = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json") || contentType.includes("application/csp-report")) {
      rawBody = await request.json();
    } else {
      const text = await request.text();
      try {
        rawBody = JSON.parse(text);
      } catch {
        rawBody = { rawText: text };
      }
    }

    const violation = parseCspPayload(rawBody);

    // If request has browser user agent, attach it
    if (!violation.userAgent || violation.userAgent === "BrowserNative") {
      violation.userAgent = request.headers.get("user-agent") || "Unknown";
    }

    // Secondary server-side filter for browser extension noise
    const isExtension = isBrowserExtensionViolation(violation);
    violation.isExtensionNoise = isExtension;

    // Record incident into the analytics aggregation store
    const incident = cspViolationStore.recordViolation(violation);

    // Server-side structured security log
    if (!isExtension) {
      console.warn(
        `[CSP Violation Alert] [${incident.severity}] Directive: ${incident.violatedDirective} | Blocked: ${incident.blockedURI} | Doc: ${incident.documentURI}`
      );
    } else {
      console.info(
        `[CSP Extension Filter] Filtered browser extension false positive: ${incident.blockedURI}`
      );
    }

    return NextResponse.json(
      {
        success: true,
        incidentId: incident.id,
        filteredAsExtensionNoise: isExtension,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CSP Ingestion Error] Failed to parse CSP report:", error);
    return NextResponse.json(
      { success: false, error: "Invalid CSP report payload" },
      { status: 400 }
    );
  }
}

/**
 * GET /api/v1/security/csp-report
 * Exposes aggregated CSP metrics for developer analytics dashboard.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const metrics = cspViolationStore.getAggregatedMetrics();
    return NextResponse.json(
      {
        success: true,
        metrics,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[CSP Metrics Error] Failed to retrieve metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve CSP metrics" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/security/csp-report
 * Allows clearing metrics or resets during diagnostic sessions.
 */
export async function DELETE(): Promise<NextResponse> {
  cspViolationStore.clear();
  return NextResponse.json({ success: true, message: "CSP store cleared" });
}
