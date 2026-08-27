/*
 * instrumentation-client.ts
 *
 * Client-side Sentry initialisation — Error tracking + performance monitoring
 * for everything that runs in the browser (React render errors, unhandled
 * promise rejections, WebSocket/RPC failures, route transitions).
 *
 * This file is picked up automatically by Next.js (App Router) and executed
 * once before hydration. It intentionally has no dependency on `swc/config/env`
 * — the DSN is optional so local development without a Sentry project still
 * works: when `NEXT_PUBLIC_SENTRY_DSN` is unset, the SDK is initialised in a
 * disabled state and all calls become no-ops.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV.

  // Performance monitoring — trace navigation, fetch/XHR (WS upgrade requests,
  // Horizon/Soroban RPC calls) and React component renders.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Session Replay — captures a lightweight DOM recording around errors so
  // issues are reproducible without shipping real user data.
  replaysSessionSampleRate: 0.02,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Drop noisy, non-actionable browser errors (extension conflicts, aborted
  // fetches from unmounted components, etc.) before they count against quota.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    "AbortError",
  ],
});

// Instruments App Router navigations as Sentry performance spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// =======================================================================================
// Bug Report Log Exporter
// ======================================================================================
// Collects recent RPC responses, console warnings, and wallet extension state
// into a downloadable JSON file for debugging. Sensitive data is scrubbed
// before the file is generated.
// ======================================================================================

const MAX_RPC_RESPONSES = 20;
const MAX_CONSOLE_LOGS = 50;

interface RpcResponseEntry {
  url: string;
  status: number;
  timestamp: string;
  body?: unknown;
}

interface ConsoleLogEntry {
  level: 'warn' | 'error';
  timestamp: string;
  message: string;
}

const rpcResponses: RpcResponseEntry[] = [];
const consoleLogs: ConsoleLogEntry[] = [];

const SENSITIVE_KEY_REGEX =
/(secret|private\\s*key|seed|mnemonic|password|passphrase|auth|token|email|phone|ssn|credit\\s*card|address)/i;

// Utility to safely stringify with circular references
function safeStringify(value: unknown, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(value, function (key, val) {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    if (typeof val === 'bigint') {
      return val.toString();
    }
    return val;
  }, space);
}

// Recursive sanitizer: redacts values for keys matching sensitive patterns
function sanitizeValue(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const fullKey = key ? `${key}.${k}` : k;
      if (SENSITIVE_KEY_REGEX.test(fullKey)) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = sanitizeValue(v, fullKey);
      }
    }
    return sanitized;
  }
  return value;
}

function addRpcResponse(entry: RpcResponseEntry): void {
  rpcResponses.push(entry);
  if (rpcResponses.length > MAX_RPC_RESPONSES) {
    rpcResponses.shift();
  }
}

function addConsoleLog(level: ConsoleLogEntry['level'], args: unknown[]): void {
  // Convert arguments to a string, truncate if needed
  const message = args.map((arg) => {
    try {
      return typeof arg === 'string' ? arg : safeStringify(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');

  consoleLogs.push({
    level,
    timestamp: new Date().toISOString(),
    message: message.length > 2000 ? message.slice(0, 2000) : message,
  });

  if (consoleLogs.length > MAX_CONSOLE_LOGS) {
    consoleLogs.shift();
  }
}

function isRpcUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('/rpc') || lower.includes('/horizon') || lower.includes('/soroban');
}

function setupRpcResponseCapture(): void {
  if (typeof window === 'undefined') return;

  // Wrap fetch to capture RPC responses
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    // Only capture if the request URL looks like an RPC endpoint
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
      if (isRpcUrl(url)) {
        // Clone the response so we can read the body without consuming it
        const clone = response.clone();
        const body = await clone.json().catch(() => undefined);
        addRpcResponse({
          url,
          status: response.status,
          timestamp: new Date().toISOString(),
          body,
        });
      }
    } catch {
      // Ignore capture errors
    }
    return response;
  };

  // Wrap XMLHttpRequest to capture RPC responses as well
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  const xrrMap = new WeakMap<XMLHttpRequest, { url: string }>();

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    xhrMap.set(this, { url: String(url) });
    return originalOpen.apply(this, [method, url, ...args] as any);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      try {
        const info = xhrMap.get(this);
        if (info && isRpcUrl(info.url)) {
          const body = JSON.parse(this.responseText);
          addRpcResponse({
            url: info.url,
            status: this.status,
            timestamp: new Date().toISOString(),
            body,
          });
        }
      } catch {
        // Ignore
      }
    });
    return originalSend.apply(this, args as any);
  };
}

function setupConsoleCapture(): void {
  if (typeof console === 'undefined') return;

  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    addConsoleLog('warn', args);
    originalWarn.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    addConsoleLog('error', args);
    originalError.apply(console, args);
  };
}

interface WalletState {
  name: string;
  installed: boolean;
  state?: Record<string, unknown>;
}

function getWalletStates(): WalletState[] {
  if (typeof window === 'undefined') return [];

  const knownWallets = [
    { name: 'freighter', key: 'freighter' },
    { name: 'albedo', key: 'albedo' },
    { name: 'rabet', key: 'rabet' },
    { name: 'xbull', key: 'xbull' },
    { name: 'lobstr', key: 'lobstr' },
    // Add other wallet extension identifiers as needed
  ];

  const states: WalletState[] = [];

  for (const wallet of knownWallets) {
    const api = (window as any)[wallet.key];
    if (api) {
      // Extract safe state properties (avoid invoking functions or reading secrets)
      const safeState: Record<string, unknown> = {};
      try {
        // Attempt to read known public properties
        if (api.publicKey) safeState.publicKey = api.publicKey;
        if (api.network) safeState.network = api.network;
        if (api.isConnected !== undefined) safeState.isConnected = api.isConnected;
        if (api.isUnlocked !== undefined) safeState.isUnlocked = api.isUnlocked;
        // ... add more safe properties as needed
      } catch {
        // Ignore
      }
      states.push({
        name: wallet.name,
        installed: true,
        state: safeState,
      });
    } else {
      states.push({
        name: wallet.name,
        installed: false,
      });
    }
  }

  return states;
}

export function downloadBugReportLog(): void {
  const report = {
    generatedAt: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    rpcResponses,
    consoleLogs,
    walletStates: getWalletStates(),
  };

  const sanitized = sanitizeValue(report);

  const json = JSON.stringify(sanitized, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];
  link.download = `bug-report-log-${date}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Initialize the capture mechanisms (only on client)
if (typeof window !== 'undefined') {
  setupRpcResponseCapture();
  setupConsoleCapture();
}
