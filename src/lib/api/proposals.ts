import type { ProposalVote } from "@/types/voting";

function staggeredRevalidate(proposalId: string): number {
  let hash = 0;
  for (let i = 0; i < proposalId.length; i++) {
    hash = (hash * 31 + proposalId.charCodeAt(i)) | 0;
  }
  return 60 + (Math.abs(hash) % 60);
}

export async function fetchProposalVotes(proposalId: string): Promise<ProposalVote[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Demo mode: no backend configured (same signal the app uses elsewhere).
  // Keeps static export from issuing a build-time fetch to a missing origin.
  if (!apiUrl) {
    return [];
  }

  try {
    const res = await fetch(
      `${apiUrl}/proposals/${proposalId}/votes`,
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

    return await res.json();
  } catch (error) {
    // Degrade to an empty vote set instead of failing the whole build when
    // the API is unreachable (offline CI, static export prerender).
    console.warn(`[proposals] votes unavailable for ${proposalId}:`, error);
    return [];
  }
}
