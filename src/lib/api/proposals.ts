import type { ProposalVote } from "@/types/voting";

function staggeredRevalidate(proposalId: string): number {
  let hash = 0;
  for (let i = 0; i < proposalId.length; i++) {
    hash = (hash * 31 + proposalId.charCodeAt(i)) | 0;
  }
  return 60 + (Math.abs(hash) % 60);
}

export async function fetchProposalVotes(proposalId: string): Promise<ProposalVote[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/proposals/${proposalId}/votes`,
    {
      next: {
        revalidate: staggeredRevalidate(proposalId),
        tags: [`proposal-${proposalId}`],
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch votes for proposal ${proposalId}`);
  }

  return res.json();
}
