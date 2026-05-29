import React from 'react';
import { Shimmer } from './Shimmer';

interface MetricCardSkeletonProps {
  count?: number;
}

export const MetricCardSkeleton = React.memo(function MetricCardSkeleton({ count = 4 }: MetricCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#0A121E] border border-[#1B2A3B] rounded-xl p-6 shadow-lg">
          <div className="flex flex-col gap-2">
            {/* Label block */}
            <Shimmer className="h-4 w-32 rounded-md" />

            {/* Value Area block */}
            <div className="flex items-baseline gap-2 mt-2">
              <Shimmer className="h-10 w-24 rounded-md" />
              <Shimmer className="h-4 w-12 rounded-md" />
            </div>

            {/* Trend Indicator block */}
            <div className="flex items-center gap-1.5 mt-2">
              <Shimmer className="h-4 w-16 rounded-full" />
              <Shimmer className="h-3 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
});
