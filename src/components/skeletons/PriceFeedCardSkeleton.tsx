import React from "react";
import { Shimmer } from "./Shimmer";

export const PriceFeedCardSkeleton = React.memo(function PriceFeedCardSkeleton() {
  return (
    <div
      style={{ contain: "paint layout" }}
      className="relative h-full w-full max-w-full overflow-hidden rounded-2xl border border-[#1B2A3B] bg-[#0A121E] p-6 shadow-lg shadow-black/20"
      aria-busy="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(57,255,20,0.04),transparent_60%)]" />

      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Shimmer className="h-2.5 w-20 rounded-full" />
          <Shimmer className="h-5 w-24 rounded-md" />
        </div>
        <Shimmer className="h-6 w-20 rounded-full" />
      </div>

      <div className="relative mb-5 space-y-3">
        <Shimmer className="h-10 w-3/4" />
        <Shimmer className="h-5 w-1/3" />
      </div>

      <div className="relative grid grid-cols-1 gap-3 border-t border-[#1B2A3B] pt-4 sm:grid-cols-3">
        <Shimmer className="h-10 rounded-xl" />
        <Shimmer className="h-10 rounded-xl" />
        <Shimmer className="h-10 rounded-xl" />
      </div>

      <div className="relative mt-4">
        <Shimmer className="h-8 w-full rounded-lg" />
      </div>

      <div className="relative mt-4 flex items-center justify-between">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-3 w-20" />
      </div>
    </div>
  );
});
