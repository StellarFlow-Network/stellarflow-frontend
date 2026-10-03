/**
 * cspViolationStore.ts — Server-side aggregation and metrics engine for CSP violations.
 *
 * Ingests incoming violation payloads, tracks incident counts grouped by violated directive,
 * computes severity breakdowns, catalogs top offending blocked URIs, and maintains a rolling
 * buffer of recent incident payloads for the developer analytics dashboard.
 */

import { isBrowserExtensionViolation, type CspViolationMetadata } from "@/utils/cspReporter";

export type CspSeverity = "Critical" | "High" | "Medium" | "Low";

export interface CspIncidentRecord {
  id: string;
  blockedURI: string;
  violatedDirective: string;
  effectiveDirective?: string;
  documentURI: string;
  referrer?: string;
  sample?: string;
  disposition: "enforce" | "report";
  statusCode: number;
  lineNumber?: number;
  columnNumber?: number;
  sourceFile?: string;
  originalPolicy?: string;
  timestamp: string;
  userAgent: string;
  severity: CspSeverity;
  isExtensionNoise: boolean;
}

export interface CspDirectiveMetric {
  directive: string;
  count: number;
  percentage: number;
  severity: CspSeverity;
  lastBlockedURI?: string;
}

export interface CspAggregatedMetrics {
  totalViolations: number;
  enforcedViolations: number;
  reportOnlyViolations: number;
  extensionNoiseFiltered: number;
  criticalSeverityCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  directives: Record<string, number>;
  directiveMetrics: CspDirectiveMetric[];
  topBlockedURIs: Array<{ uri: string; count: number }>;
  uniqueBlockedOrigins: number;
  lastIncidentTimestamp: string | null;
  recentIncidents: CspIncidentRecord[];
}

/**
 * Determine severity based on violated directive.
 * - script-src, object-src, base-uri: Critical (direct arbitrary execution risks)
 * - connect-src: High (potential data exfiltration)
 * - frame-ancestors, frame-src, style-src: Medium (clickjacking, injection)
 * - img-src, font-src, media-src: Low (content leak or tracking)
 */
export function calculateCspSeverity(directive: string): CspSeverity {
  const d = directive.toLowerCase();
  if (d.includes("script") || d.includes("object") || d.includes("base-uri")) {
    return "Critical";
  }
  if (d.includes("connect")) {
    return "High";
  }
  if (d.includes("frame") || d.includes("style")) {
    return "Medium";
  }
  return "Low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Store (persists in memory across requests in Node server / dev runtime)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_INCIDENTS_BUFFER = 150;

class CspViolationStore {
  private incidents: CspIncidentRecord[] = [];
  private extensionNoiseCount = 0;

  constructor() {
    // Seed initial demo data for developer analytics dashboard so metrics
    // are visible immediately upon mount
    this.seedInitialMetrics();
  }

  private seedInitialMetrics() {
    const now = Date.now();
    const seeds: Array<Partial<CspIncidentRecord>> = [
      {
        blockedURI: "https://untrusted-analytics-cdn.xyz/tracker.js",
        violatedDirective: "script-src",
        documentURI: "https://stellarflow.io/swap",
        disposition: "enforce",
        sourceFile: "https://stellarflow.io/swap",
        timestamp: new Date(now - 120_000).toISOString(),
      },
      {
        blockedURI: "wss://malicious-telemetry-socket.io",
        violatedDirective: "connect-src",
        documentURI: "https://stellarflow.io/governance",
        disposition: "enforce",
        timestamp: new Date(now - 300_000).toISOString(),
      },
      {
        blockedURI: "https://sketchy-cdn.net/webfont.woff2",
        violatedDirective: "font-src",
        documentURI: "https://stellarflow.io/admin",
        disposition: "report",
        timestamp: new Date(now - 900_000).toISOString(),
      },
      {
        blockedURI: "https://ad-network-banner.com/tracker.png",
        violatedDirective: "img-src",
        documentURI: "https://stellarflow.io/diagnostics",
        disposition: "enforce",
        timestamp: new Date(now - 1_500_000).toISOString(),
      },
    ];

    for (const seed of seeds) {
      this.recordViolation({
        blockedURI: seed.blockedURI || "https://unknown.com",
        violatedDirective: seed.violatedDirective || "script-src",
        documentURI: seed.documentURI || "https://stellarflow.io/",
        disposition: seed.disposition || "enforce",
        statusCode: 0,
        timestamp: seed.timestamp || new Date().toISOString(),
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        isExtensionNoise: false,
      });
    }

    this.extensionNoiseCount = 42; // realistic count of filtered extensions
  }

  /**
   * Ingests a new violation and updates aggregated data.
   */
  public recordViolation(payload: Partial<CspViolationMetadata>): CspIncidentRecord {
    const isExtension = isBrowserExtensionViolation(payload);

    if (isExtension) {
      this.extensionNoiseCount++;
    }

    const directive = payload.violatedDirective || "unknown";
    const severity = calculateCspSeverity(directive);
    const incident: CspIncidentRecord = {
      id: `csp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      blockedURI: payload.blockedURI || "unknown",
      violatedDirective: directive,
      effectiveDirective: payload.effectiveDirective || directive,
      documentURI: payload.documentURI || "unknown",
      referrer: payload.referrer,
      sample: payload.sample,
      disposition: (payload.disposition as "enforce" | "report") || "enforce",
      statusCode: payload.statusCode || 0,
      lineNumber: payload.lineNumber,
      columnNumber: payload.columnNumber,
      sourceFile: payload.sourceFile,
      originalPolicy: payload.originalPolicy,
      timestamp: payload.timestamp || new Date().toISOString(),
      userAgent: payload.userAgent || "Unknown",
      severity,
      isExtensionNoise: isExtension,
    };

    // Prepend to incidents buffer
    this.incidents.unshift(incident);

    // Prune buffer to max limit
    if (this.incidents.length > MAX_INCIDENTS_BUFFER) {
      this.incidents = this.incidents.slice(0, MAX_INCIDENTS_BUFFER);
    }

    return incident;
  }

  /**
   * Generates aggregated metrics and statistics for the dashboard.
   */
  public getAggregatedMetrics(): CspAggregatedMetrics {
    // Only aggregate non-extension real violations for security analysis
    const realIncidents = this.incidents.filter((i) => !i.isExtensionNoise);
    const totalViolations = realIncidents.length;

    let enforcedViolations = 0;
    let reportOnlyViolations = 0;
    let criticalSeverityCount = 0;
    let highSeverityCount = 0;
    let mediumSeverityCount = 0;
    let lowSeverityCount = 0;

    const directivesMap: Record<string, number> = {};
    const blockedURIsMap: Record<string, number> = {};
    const blockedOriginsSet = new Set<string>();

    for (const incident of realIncidents) {
      // Disposition
      if (incident.disposition === "enforce") {
        enforcedViolations++;
      } else {
        reportOnlyViolations++;
      }

      // Severity
      switch (incident.severity) {
        case "Critical":
          criticalSeverityCount++;
          break;
        case "High":
          highSeverityCount++;
          break;
        case "Medium":
          mediumSeverityCount++;
          break;
        case "Low":
          lowSeverityCount++;
          break;
      }

      // Directive breakdown
      const d = incident.violatedDirective;
      directivesMap[d] = (directivesMap[d] || 0) + 1;

      // Blocked URI
      const uri = incident.blockedURI;
      blockedURIsMap[uri] = (blockedURIsMap[uri] || 0) + 1;

      try {
        if (uri.startsWith("http")) {
          const origin = new URL(uri).origin;
          blockedOriginsSet.add(origin);
        } else {
          blockedOriginsSet.add(uri.split(" ")[0]);
        }
      } catch {
        blockedOriginsSet.add(uri);
      }
    }

    // Directive metrics list with percentages
    const directiveMetrics: CspDirectiveMetric[] = Object.entries(directivesMap)
      .map(([directive, count]) => {
        const lastIncident = realIncidents.find((i) => i.violatedDirective === directive);
        return {
          directive,
          count,
          percentage: totalViolations > 0 ? (count / totalViolations) * 100 : 0,
          severity: calculateCspSeverity(directive),
          lastBlockedURI: lastIncident?.blockedURI,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Top blocked URIs
    const topBlockedURIs = Object.entries(blockedURIsMap)
      .map(([uri, count]) => ({ uri, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViolations,
      enforcedViolations,
      reportOnlyViolations,
      extensionNoiseFiltered: this.extensionNoiseCount,
      criticalSeverityCount,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      directives: directivesMap,
      directiveMetrics,
      topBlockedURIs,
      uniqueBlockedOrigins: blockedOriginsSet.size,
      lastIncidentTimestamp: realIncidents[0]?.timestamp || null,
      recentIncidents: realIncidents.slice(0, 50),
    };
  }

  /**
   * Resets stored metrics and incidents (useful for testing).
   */
  public clear(): void {
    this.incidents = [];
    this.extensionNoiseCount = 0;
  }
}

// Global singleton instance
declare global {
  // eslint-disable-next-line no-var
  var __cspViolationStore: CspViolationStore | undefined;
}

export const cspViolationStore =
  globalThis.__cspViolationStore ?? new CspViolationStore();

if (process.env.NODE_ENV !== "production") {
  globalThis.__cspViolationStore = cspViolationStore;
}
