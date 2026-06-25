import React from "react";
import { Shimmer } from "./Shimmer";

export const DashboardTrafficChartSkeleton = React.memo(
  function DashboardTrafficChartSkeleton() {
    return (
      <div className="rounded-[32px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <Shimmer className="h-3 w-28 rounded-md" />
            <Shimmer className="mt-2 h-6 w-44 rounded-md" />
          </div>
          <Shimmer className="h-7 w-20 rounded-full" />
        </div>

        <div className="aspect-[16/9] min-h-[280px] rounded-[24px] border border-white/10 bg-[#0F172A] p-4">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-2">
              <Shimmer className="h-3 w-36 rounded-md" />
              <Shimmer className="h-3 w-24 rounded-md" />
            </div>

            <div className="grid flex-1 grid-cols-6 items-end gap-3 rounded-[20px] border border-white/8 bg-white/4 p-4">
              <Shimmer className="h-12 rounded-t-md" />
              <Shimmer className="h-20 rounded-t-md" />
              <Shimmer className="h-28 rounded-t-md" />
              <Shimmer className="h-24 rounded-t-md" />
              <Shimmer className="h-32 rounded-t-md" />
              <Shimmer className="h-36 rounded-t-md" />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
