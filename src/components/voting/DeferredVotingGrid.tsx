'use client';

import dynamic from 'next/dynamic';
import { DeferredHydrationBoundary } from '@/components/deferred-hydration/DeferredHydrationBoundary';
import { VotingGridSkeleton } from '@/components/skeletons/VotingGridSkeleton';
import type { ProposalVote } from '@/types/voting';

// Dynamic import with NO SSR - this is critical for deferred hydration
// The component is only loaded on the client after the boundary allows it
const ProposalVotingGrid = dynamic(
  () => import('./ProposalVotingGrid').then((mod) => mod.ProposalVotingGrid),
  {
    ssr: false,
    loading: () => <VotingGridSkeleton />,
  }
);

interface DeferredVotingGridProps {
  data: ProposalVote[];
  proposalId: string;
  /** Delay hydration by N ms after mount (default: 100ms) */
  hydrationDelay?: number;
}

/**
 * Entry point for deferred hydration of heavy voting grids.
 * Wraps the heavy ProposalVotingGrid inside a deferred hydration boundary
 * that waits for layout mount to settle before loading the interactive grid.
 */
export function DeferredVotingGrid({
  data,
  proposalId,
  hydrationDelay = 100,
}: DeferredVotingGridProps) {
  return (
    <DeferredHydrationBoundary
      fallback={<VotingGridSkeleton />}
      delay={hydrationDelay}
      waitForIdle={true}
    >
      <ProposalVotingGrid data={data} proposalId={proposalId} />
    </DeferredHydrationBoundary>
  );
}