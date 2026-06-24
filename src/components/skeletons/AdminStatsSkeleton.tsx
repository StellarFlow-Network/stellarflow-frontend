import React from "react";
import { Shimmer } from "./Shimmer";

/**
 * AdminStatsSkeleton — static fallback for admin-only telemetry/stats rows.
 * Shown immediately while intensive admin data resolves.
 */
export const AdminStatsSkeleton = React.memo(function AdminStatsSkeleton() {
  return (
    <div className="w-full space-y-6">
      {/* Header row */}
      <div className="flex items-center gap-4">
        <Shimmer className="h-5 w-40 rounded-md" />
        <Shimmer className="h-5 w-24 rounded-full" />
      </div>

      {/* Admin metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#0A121E] border border-[#1B2A3B] rounded-xl p-6 shadow-lg space-y-3"
          >
            <Shimmer className="h-3 w-24 rounded-md" />
            <Shimmer className="h-8 w-32 rounded-md" />
            <div className="flex items-center gap-2">
              <Shimmer className="h-4 w-14 rounded-full" />
              <Shimmer className="h-3 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
