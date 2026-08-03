import type { Delegate, DelegateVoteRecord } from '@/types/delegation';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ─────────────────────────────────────────────────────────────────────────────
// In-Flight Request Deduplication (matches pattern in src/app/services/api.ts)
// ─────────────────────────────────────────────────────────────────────────────

const inFlightRequests = new Map<string, Promise<unknown>>();

async function pooledFetch<T>(url: string, options?: RequestInit): Promise<T> {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)! as Promise<T>;
  }

  const requestPromise = (async () => {
    const res = await fetch(url, options);

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Staggered revalidation (matches pattern in src/lib/api/proposals.ts)
// ─────────────────────────────────────────────────────────────────────────────

function staggeredRevalidate(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return 120 + (Math.abs(hash) % 120); // 2–4 minutes
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all registered community delegates.
 * Cached per staggered revalidation window to avoid backend flooding.
 */
export async function fetchDelegates(): Promise<Delegate[]> {
  const url = `${BASE_URL}/api/delegates`;

  return pooledFetch<Delegate[]>(url, {
    next: {
      revalidate: staggeredRevalidate('delegates'),
      tags: ['delegates'],
    },
  });
}

/**
 * Fetches a single delegate's voting history.
 */
export async function fetchDelegateVotingHistory(
  delegateId: string,
): Promise<DelegateVoteRecord[]> {
  const url = `${BASE_URL}/api/delegates/${delegateId}/votes`;

  return pooledFetch<DelegateVoteRecord[]>(url, {
    next: {
      revalidate: staggeredRevalidate(delegateId),
      tags: [`delegate-${delegateId}`, 'delegate-votes'],
    },
  });
}

/**
 * Fetches a single delegate by ID.
 */
export async function fetchDelegate(delegateId: string): Promise<Delegate> {
  const url = `${BASE_URL}/api/delegates/${delegateId}`;

  return pooledFetch<Delegate>(url, {
    next: {
      revalidate: staggeredRevalidate(delegateId),
      tags: [`delegate-${delegateId}`],
    },
  });
}
