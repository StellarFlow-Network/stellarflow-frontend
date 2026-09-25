import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DeferredVotingGrid } from '@/components/voting/DeferredVotingGrid';
import { VotingGridSkeleton } from '@/components/skeletons/VotingGridSkeleton';
import { fetchProposalVotes } from '@/lib/api/proposals';

export const revalidate = 60;

// `output: export` requires at least one generated route for a dynamic path,
// and arbitrary proposal ids cannot be enumerated for a static host. Ship the
// demo instance; votes resolve client-side/demo as `NEXT_PUBLIC_API_URL` allows.
export async function generateStaticParams() {
  return [{ id: 'demo' }];
}

interface ProposalHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalHistoryPage({ params }: ProposalHistoryPageProps) {
  const { id } = await params;
  
  // Server-side data fetch - no JS bundle cost
  const votes = await fetchProposalVotes(id);

  if (!votes) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Proposal Voting History
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Proposal ID: <span className="font-mono">{id}</span>
        </p>
      </div>

      {/* 
        The DeferredVotingGrid is wrapped in Suspense on the server.
        The actual heavy grid hydration is deferred to the client
        until after layout mount tasks settle.
      */}
      <Suspense fallback={<VotingGridSkeleton />}>
        <DeferredVotingGrid 
          data={votes} 
          proposalId={id}
          hydrationDelay={150} // 150ms delay for FID optimization
        />
      </Suspense>
    </main>
  );
}