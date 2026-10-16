import { getFetchCacheOptions } from '@config/cacheConfig'

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
    return inFlightRequests.get(url) as Promise<T>;
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

export function exportTransactionsToCsv(transactions: any[]): void {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return;
  }

  const headers = ['Date', 'Tx Hash', 'Type', 'Amount', 'Asset', 'Status'];
  const escapeCsvField = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"'"${str.replace(/"/q, '""')}"""`;
    }
    return str;
  };
  const csvRows = [headers.join(',')];
  for (const tx of transactions) {
    csvRows.push([
      escapeCsvField(tx.date),
      escapeCsvField(tx.txHash || tx.hash),
      escapeCsvField(tx.type),
      escapeCsvField(tx.amount),
      escapeCsvField(tx.asset),
      escapeCsvField(tx.status),
    ].join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'activity.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface SEP24TransactionStatus {
  id: string;
  kind: 'deposit' | 'withdrawal';
  status: 'pending_user_action' | 'processing_anchor' | 'tokens_dispatched' | 'completed' | 'error' | 'refunded' | 'expired';
  status_message?: string;
  amount_in: string;
  amount_out?: string;
  asset_code: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  tx_hash?: string;
  external_anchor_id?: string;
  more_info_url?: string;
  more_info: {
    message?: string;
    url?: string;
  };
}

export interface SEP24TransactionResponse {
  transaction: SEP24TransactionStatus;
}

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
   * Fetches off-ramp partner webhook status for real-time payout tracking.
   * Uses short cache interval to keep stepper updated without backend flooding.
   */
  async getOffRampPartnerWebhookStatus(): Promise<unknown> {
    return pooledFetch('/api/offramp/partner/webhook-status', getFetchCacheOptions('SHORT_INTERVAL'))
  },

  /**
   * Fetches the current state of a SEP-24 interactive transaction.
   * Polled by the SEP24ProgressStepper to reflect real-time deposit/withdrawal progress.
   */
  async getSEP24Transaction(id: string): Promise<SEP24TransactionResponse> {
    if (!id) {
      throw new Error('SEP24 transaction id required')
    }
    const url = `/api/sep24/transaction/${encodeURIComponent(id)}`;
    return pooledFetch<SEP24TransactionResponse>(
      url,
      getFetchCacheOptions('SHORT_INTERVAL'),
    )
  },
}
