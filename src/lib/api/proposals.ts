import type { ProposalVote } from '@/types/voting';

export async function fetchProposalVotes(proposalId: string): Promise<ProposalVote[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/proposals/${proposalId}/votes`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch votes for proposal ${proposalId}`);
  }

  return res.json();
}