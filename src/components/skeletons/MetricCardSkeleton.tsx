import React from 'react';
import { Shimmer } from './Shimmer';

interface MetricCardSkeletonProps {
  count?: number;
}

export function MetricCardSkeleton({ count = 4 }: MetricCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[16/10]">
          <div className="relative h-full bg-[#0A121E] border border-[#1B2A3B] rounded-xl p-6 shadow-lg">
            <div className="flex flex-col gap-2">
              <Shimmer className="h-4 w-32 rounded-md" />

              <div className="flex items-baseline gap-2">
                <Shimmer className="h-10 w-24 rounded-md" />
                <Shimmer className="h-4 w-12 rounded-md" />
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <Shimmer className="h-4 w-16 rounded-full" />
                <Shimmer className="h-3 w-16 rounded-md" />
              </div>
            </div>

            <div className="absolute top-0 right-0 w-8 h-[2px] bg-gradient-to-l from-[#39FF14] to-transparent" />
            <div className="absolute bottom-0 left-0 w-8 h-[2px] bg-gradient-to-r from-[#39FF14] to-transparent" />
          </div>
        </div>
      ))}
    </>
  );
}
