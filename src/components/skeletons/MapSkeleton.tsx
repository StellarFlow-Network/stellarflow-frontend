import React from 'react';
import { Shimmer } from './Shimmer';

export function MapSkeleton() {
  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.12),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(96,165,250,0.12),transparent_40%)]" />
      <div className="relative h-full min-h-[280px] rounded-[24px] border border-white/10 overflow-hidden">
        <Shimmer className="h-[280px] w-full rounded-none" />
        <div className="absolute top-4 left-4 rounded-lg bg-black/50 p-2 backdrop-blur-sm">
          <Shimmer className="h-3 w-24 rounded-md" />
          <Shimmer className="mt-1 h-3 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}
