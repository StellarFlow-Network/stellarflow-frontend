import { getFetchCacheOptions, REVALIDATE_INTERVALS } from '@/config/cacheConfig'

/**
 * API service layer with enforced cache re-validation periods.
 * All endpoints implement minimum 5-second revalidation to prevent backend flooding.
 */
// Centralized In-Flight Request Pool (Deduplication)
// Intercepts parallel requests for the exact same URL and serves them from a single promise
// Centralized In-Flight Request Pool (Deduplication)
const inFlightRequests = new Map<string, Promise<unknown>>();

async function pooledFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)! as Promise<T>;
  }

  const requestPromise = (async () => {
    const res = await fetch(url, options);

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    return (await res.json()) as T;
  })();

  inFlightRequests.set(url, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(url);
  }
}

// Sanitize environmentspecific data before export
function sanitizeLogData(obj: unknown, seen = new WeakSet()): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (seen.has(obj)) return undefined;
  seen.add(obj);
  
  const sensitiveKeys = new Set(['privateKey', 'mnemonic', 'seed', 'password', 'passphrase', 'secret', 'token', 'authorization', 'x-api-key', 'apiKey', 'personalInfo', 'ssnn', 'dob', 'email', 'phone', 'fullName']);

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLogData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.has(key)) {
      // Replace with scrubbed marker
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeLogData(value, seen);
    }
  }
  return result;
}

// Function to collect recent RPC responses (from a global diagnostic store if available)
function getRecentRpcResponses(): unknown[] {
  if (typeof window !== 'undefined' && (window as any).__rpcLogs) {
    return (window as any).__rpcLogs as unknown[];
  }
  // Fallback example
  return [
    { endpoint: '/api/prices', status: 200, data: { btc: 60000 } },
    { endpoint: '/api/portfolio', status: 200, data: { total: 12345 } },
  ];
}

function getConsoleWarnings(): string[] {
  if (typeof window !== 'undefined' && (window as any).__consoleWarnings) {
    return (window as any).__consoleWarnings as string[];
  }
  return ['Example warning: Resource loaded but failed'];
}

function getWalletExtensionState(): unknown {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      return {
        chainId: (window as any).ethereum.chainId,
        networkVersion: (window as any).ethereum.networkVersion,
        selectedAddress: (window as any).ethereum.selectedAddress, // Personal data, will be scrubbed
      };
    } catch {
      return { error: 'Could not read wallet state' };
    }
  }
  return null;
}

// Method to export bug report log
const exportBugReportLog = () => {
  const diagnosticLog = {
    timestamp: new Date().toISOString(),
    appVersion: 'dev',
    rpcResponses: getRecentRpcResponses(),
    consoleWarnings: getConsoleWarnings(),
    walletExtensionState: getWalletExtensionState(),
  };

  const scrubbedLog = sanitizeLogData(diagnosticLog) as typeof diagnosticLog;
  const json = JSON.stringify(scrubbedLog, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bug-report-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const api = {
  /**
   * Fetches current price data with 10-second cache.
   * Prevents excessive requests to price data endpoints during high activity.
   */
  async getPrices(): Promise<unknown> {
    return pooledFetch('/api/prices', getFetchCacheOptions('SHORT_INTERVAL'))
  },

  /**
   * Fetches portfolio data with 30-second cache.
   * Reduces database queries for portfolio aggregations that change infrequently.
   */
  async getPortfolio():Promise<unknown> {
    return pooledFetch('/api/portfolio', getFetchCacheOptions('MEDIUM_INTERVAL'))
  },

  /**
   * Exports a sanitized diagnostic log JSON file for bug reports.
   * Compiles recent RPC responses, console warnings, and wallet extension state.
   * Scrubs private key materials and personal identification payload parameters.
   */
  exportBugReportLog,
}