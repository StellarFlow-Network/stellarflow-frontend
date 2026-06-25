'use client';

import { Suspense, ReactNode } from 'react';
import { useDeferredHydration } from '@/hooks/useDeferredHydration';

interface DeferredHydrationBoundaryProps {
  children: ReactNode;
  /** Skeleton/placeholder to show while deferred */
  fallback: ReactNode;
  /** Delay in ms before hydration (default: 0) */
  delay?: number;
  /** Wait for idle callback */
  waitForIdle?: boolean;
  /** CSS class for the wrapper */
  className?: string;
}

/**
 * Boundary component that defers hydration of its children until after
 * initial layout mount tasks have settled. Wraps heavy interactive tables/grids.
 */
export function DeferredHydrationBoundary({
  children,
  fallback,
  delay = 0,
  waitForIdle = true,
  className,
}: DeferredHydrationBoundaryProps) {
  const shouldHydrate = useDeferredHydration({ delay, waitForIdle });

  return (
    <div className={className}>
      {shouldHydrate ? (
        <Suspense fallback={fallback}>{children}</Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}