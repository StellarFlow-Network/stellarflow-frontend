import React from 'react';
import { Shimmer } from './Shimmer';

export const MapSkeleton = React.memo(function MapSkeleton() {
  return (
    <div className="relative flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
      <Shimmer className="absolute inset-0 w-full h-full rounded-[28px]" />
      
      {/* Optional subtle pulsing placeholder icon to give visual context */}
      <div className="relative z-10 flex h-18 w-18 items-center justify-center rounded-full border border-[#D9F99D]/25 bg-[#111B2F]/90 shadow-[0_0_50px_rgba(203,243,77,0.14)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#D9F99D]/30" />
      </div>
    </div>
  );
});
