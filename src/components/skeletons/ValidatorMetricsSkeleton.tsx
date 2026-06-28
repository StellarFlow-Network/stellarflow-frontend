import React from 'react';
import { Shimmer } from './Shimmer';
import { VALIDATOR_METRIC_CARD_MIN_HEIGHT_PX } from '@/types/validators';

interface ValidatorMetricsSkeletonProps {
  count?: number;
}

/**
 * Reserves the exact footprint of the four overview metric cards on the
 * validator audit page so late-arriving network totals cannot shift layout.
 */
export const ValidatorMetricsSkeleton = React.memo(function ValidatorMetricsSkeleton({
  count = 4,
}: ValidatorMetricsSkeletonProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      aria-busy="true"
      aria-label="Loading validator overview metrics"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            contain: 'layout paint',
            minHeight: VALIDATOR_METRIC_CARD_MIN_HEIGHT_PX,
          }}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4"
        >
          <Shimmer className="h-3 w-[11.5rem] max-w-full rounded-md mb-1" />
          <Shimmer className="h-8 w-28 max-w-full rounded-md" />
        </div>
      ))}
    </div>
  );
});
