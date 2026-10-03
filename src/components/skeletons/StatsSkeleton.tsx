import React from "react";
import { Shimmer } from "./Shimmer";

/**
 * StatsSkeleton — static fallback for the SystemStats + ModularStatsCard rows.
 * Renders immediately so the header/nav are never blocked.
 */
export const StatsSkeleton = React.memo(function StatsSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
      {/* SystemStats skeleton */}
      <div className="bg-[#0A0F1E] border border-[#1B2A3B] border-t-2 border-t-[#39FF14]/40 rounded-lg overflow-hidden shadow-2xl p-6 space-y-6">
        <Shimmer className="h-5 w-32 rounded-md" />
        <div className="h-px bg-[#1B2A3B]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Shimmer className="h-4 w-28 rounded-md" />
              <Shimmer className="h-20 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* ModularStatsCard grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[16/10] bg-[#0A121E] border border-[#1B2A3B] rounded-xl p-6 shadow-lg space-y-3"
          >
            <Shimmer className="h-3 w-28 rounded-md" />
            <Shimmer className="h-10 w-36 rounded-md" />
            <Shimmer className="h-4 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
});
