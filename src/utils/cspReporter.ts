/**
 * cspReporter.ts — Automated Content Security Policy (CSP) Violation Report Collector
 *
 * Catches client-side CSP violation events via the `securitypolicyviolation` DOM event,
 * extracts crucial forensic metadata (blocked URI, violated directive, document URI,
 * line numbers, sample), filters out browser-extension noise and false positives,
 * and submits formatted incident payloads silently to `/api/v1/security/csp-report`.
 */

export interface CspViolationMetadata {
  /** The URI of the resource that was blocked from loading */
  blockedURI: string;
  /** The CSP directive that was violated (e.g., script-src, connect-src) */
  violatedDirective: string;
  /** The effective directive after fallback rules (e.g., script-src-elem -> script-src) */
  effectiveDirective?: string;
  /** The URI of the document in which the violation occurred */
  documentURI: string;
  /** URL of the referring page */
  referrer?: string;
  /** A slice of the code that caused the violation (if available) */
  sample?: string;
  /** How the policy was treated: 'enforce' (blocked) or 'report' (report-only) */
  disposition: "enforce" | "report";
  /** HTTP status code of the resource (or 0 for scripts/images) */
  statusCode: number;
  /** Source file line number where violation originated */
  lineNumber?: number;
  /** Source file column number where violation originated */
  columnNumber?: number;
  /** The URL or path of the script file where violation was triggered */
  sourceFile?: string;
  /** Full policy string that was violated */
  originalPolicy?: string;
  /** Timestamp when the event fired */
  timestamp: string;
  /** Client browser user agent */
  userAgent: string;
  /** Whether the violation was identified as browser extension noise */
  isExtensionNoise?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension Detection & Noise Filtering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known URI protocols and patterns used by browser extensions.
 */
const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "extension://",
  "ms-browser-extension://",
  "webkit-masked-url://",
] as const;

/**
 * Common browser extension filenames and script signatures that inject
 * code into arbitrary webpages (wallets, password managers, adblockers, devtools).
 */
const EXTENSION_SIGNATURES = [
  "contentscript",
  "content-script",
  "inpage.js",
  "inject.js",
  "injected.js",
  "metamask",
  "phantom",
  "coinbase",
  "solana-provider",
  "lastpass",
  "1password",
  "bitwarden",
  "grammarly",
  "adblock",
  "react_devtools",
  "redux_devtools",
  "stellar-freighter",
  "xbull",
] as const;

/**
 * Checks whether a CSP violation is a false positive triggered by a browser extension
 * rather than an authentic security issue in application code.
 *
 * @param violation The violation event or payload to inspect
 * @returns true if the violation originated from a browser extension
 */
export function isBrowserExtensionViolation(
  violation: Partial<CspViolationMetadata>
): boolean {
  const blockedURI = (violation.blockedURI || "").toLowerCase();
  const sourceFile = (violation.sourceFile || "").toLowerCase();
  const documentURI = (violation.documentURI || "").toLowerCase();
  const sample = (violation.sample || "").toLowerCase();

  // 1. Check known extension URI schemes
  for (const scheme of EXTENSION_SCHEMES) {
    if (
      blockedURI.startsWith(scheme) ||
      sourceFile.startsWith(scheme) ||
      documentURI.startsWith(scheme)
    ) {
      return true;
    }
  }

  // 2. Check known extension content script paths & keywords
  for (const sig of EXTENSION_SIGNATURES) {
    if (
      sourceFile.includes(sig) ||
      blockedURI.includes(sig) ||
      sample.includes(sig)
    ) {
      return true;
    }
  }

  // 3. Check inline script samples that are exclusively injected by web3 extensions
  if (
    sample.includes("window.ethereum") ||
    sample.includes("window.solana") ||
    sample.includes("window.freighter") ||
    sample.includes("evmprovider")
  ) {
    return true;
  }

  // 4. Blobs or data URIs initiated by extensions or devtools
  if (
    (blockedURI.startsWith("blob:") || blockedURI.startsWith("data:")) &&
    sourceFile.includes("extension")
  ) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication & Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory cache of recently logged violation hashes to prevent flooding the API
 * if a component or third-party script triggers violations repeatedly in a loop.
 */
const recentViolations = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 15_000; // 15 seconds

function generateViolationKey(v: Partial<CspViolationMetadata>): string {
  return `${v.violatedDirective || ""}|${v.blockedURI || ""}|${v.documentURI || ""}|${v.sourceFile || ""}`;
}

function isDuplicateViolation(key: string): boolean {
  const now = Date.now();
  const lastLogged = recentViolations.get(key);
  if (lastLogged && now - lastLogged < DEDUPLICATION_WINDOW_MS) {
    return true;
  }
  recentViolations.set(key, now);

  // Periodic pruning of old cache entries
  if (recentViolations.size > 200) {
    for (const [k, time] of recentViolations.entries()) {
      if (now - time > DEDUPLICATION_WINDOW_MS) {
        recentViolations.delete(k);
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload Formatter & Transmission
// ─────────────────────────────────────────────────────────────────────────────

export const CSP_REPORT_ENDPOINT = "/api/v1/security/csp-report";

/**
 * Formats a SecurityPolicyViolationEvent or raw object into a clean CspViolationMetadata payload.
 */
export function formatCspPayload(
  event: SecurityPolicyViolationEvent | Partial<CspViolationMetadata>
): CspViolationMetadata {
  const isEvent = typeof (event as SecurityPolicyViolationEvent).blockedURI !== "undefined";

  const blockedURI = event.blockedURI || "unknown";
  const violatedDirective = event.violatedDirective || "unknown";
  const documentURI =
    event.documentURI ||
    (typeof window !== "undefined" ? window.location.href : "unknown");

  return {
    blockedURI,
    violatedDirective,
    effectiveDirective: (event as SecurityPolicyViolationEvent).effectiveDirective || violatedDirective,
    documentURI,
    referrer:
      event.referrer ||
      (typeof document !== "undefined" ? document.referrer : undefined),
    sample: event.sample || undefined,
    disposition: (event.disposition as "enforce" | "report") || "enforce",
    statusCode: event.statusCode || 0,
    lineNumber: event.lineNumber || undefined,
    columnNumber: event.columnNumber || undefined,
    sourceFile: event.sourceFile || undefined,
    originalPolicy: event.originalPolicy || undefined,
    timestamp: event.timestamp || new Date().toISOString(),
    userAgent:
      event.userAgent ||
      (typeof navigator !== "undefined" ? navigator.userAgent : "SSR"),
    isExtensionNoise: isBrowserExtensionViolation(event),
  };
}

/**
 * Submits a formatted CSP violation payload to the logging route silently.
 * Uses `navigator.sendBeacon` when supported for non-blocking submission,
 * falling back to `fetch` with `keepalive: true`.
 *
 * Runs completely silently without user disruption.
 */
export async function sendCspReport(
  payload: CspViolationMetadata
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Filter out false positive violations caused by browser extensions
  if (payload.isExtensionNoise) {
    if (process.env.NODE_ENV === "development") {
      console.debug(
        "[CSP Reporter] Dropped browser extension false positive:",
        payload.blockedURI || payload.sourceFile
      );
    }
    return false;
  }

  // Deduplicate rapid repeat events
  const dedupeKey = generateViolationKey(payload);
  if (isDuplicateViolation(dedupeKey)) {
    return false;
  }

  try {
    const serialized = JSON.stringify(payload);

    // 1. Try navigator.sendBeacon (most performant, non-blocking)
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([serialized], { type: "application/json" });
      const queued = navigator.sendBeacon(CSP_REPORT_ENDPOINT, blob);
      if (queued) return true;
    }

    // 2. Fallback to fetch with keepalive
    await fetch(CSP_REPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: serialized,
      keepalive: true,
    }).catch(() => {
      // Silently swallow fetch rejections to ensure zero disruption to the user
    });

    return true;
  } catch {
    // Fail silently
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Listener Manager
// ─────────────────────────────────────────────────────────────────────────────

let isListenerRegistered = false;
let globalViolationHandler: ((event: Event) => void) | null = null;

/**
 * Handles DOM securitypolicyviolation events.
 */
function onSecurityPolicyViolation(event: Event): void {
  const violationEvent = event as SecurityPolicyViolationEvent;
  const payload = formatCspPayload(violationEvent);
  void sendCspReport(payload);
}

/**
 * Initializes the client-side CSP violation report collector.
 * Automatically hooks into `window.addEventListener('securitypolicyviolation')`.
 * Safe to call multiple times (idempotent).
 */
export function initCspReporter(): void {
  if (typeof window === "undefined") return;
  if (isListenerRegistered) return;

  globalViolationHandler = onSecurityPolicyViolation;
  window.addEventListener("securitypolicyviolation", globalViolationHandler, {
    passive: true,
  });
  isListenerRegistered = true;

  if (process.env.NODE_ENV === "development") {
    console.debug("[CSP Reporter] Automated CSP violation listener active.");
  }
}

/**
 * Removes the global violation listener (for tests or clean unmount).
 */
export function destroyCspReporter(): void {
  if (typeof window === "undefined") return;
  if (!isListenerRegistered || !globalViolationHandler) return;

  window.removeEventListener("securitypolicyviolation", globalViolationHandler);
  isListenerRegistered = false;
  globalViolationHandler = null;
  recentViolations.clear();
}

/**
 * Manually logs a CSP violation for testing or programmatic reporting.
 */
export function reportManualCspViolation(
  data: Partial<CspViolationMetadata>
): Promise<boolean> {
  const payload = formatCspPayload(data);
  return sendCspReport(payload);
}

export default {
  initCspReporter,
  destroyCspReporter,
  formatCspPayload,
  isBrowserExtensionViolation,
  sendCspReport,
  reportManualCspViolation,
};
