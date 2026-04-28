import React from 'react';
import { Shimmer } from './Shimmer';

export const RateSparklineSkeleton = () => {
  return (
    <div className="aspect-[16/10] rounded-3xl border border-[#1B2A3B] bg-[#08111E] p-5 shadow-lg shadow-black/20">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Shimmer className="h-3 w-14 rounded-md" />
            <Shimmer className="h-8 w-32 rounded-md" />
          </div>
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>

        <div className="space-y-3">
          <Shimmer className="h-[1px] w-full" />
          <Shimmer className="h-8 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
};
