import type { ProposalVote } from '@/types/voting'
import { getFetchCacheOptions } from '@/config/cacheConfig'

/**
 * Fetches proposal votes with enforced cache re-validation (60 seconds).
 * Prevents backend flooding with redundant vote update requests.
 */
export async function fetchProposalVotes(proposalId: string): Promise<ProposalVote[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/proposals/${proposalId}/votes`,
    getFetchCacheOptions('MEDIUM_INTERVAL')
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch votes for proposal ${proposalId}`);
  }

  return res.json();
}