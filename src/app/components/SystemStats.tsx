import React from "react";
import Breadcrumb from "./Breadcrumb";
import GlobalHealthIndicator from "./GlobalHealthIndicator";

interface StatsCardProps {
  label: string;
  value: string | number;
  showDot?: boolean;
}

const StatsCard = ({ label, value, showDot = false }: StatsCardProps) => {
  return (
    <div className="flex flex-col items-center md:items-start gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-[#39FF14] font-bold text-sm md:text-base tracking-widest">
          {label}
        </h3>
        {showDot && (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-4 h-4 rounded-full bg-[#39FF14] animate-ping opacity-30" />
            <div className="w-3 h-3 rounded-full bg-[#39FF14] shadow-[0_0_8px_3px_rgba(57,255,20,0.8)]" />
          </div>
        )}
      </div>
      <p className="text-[#39FF14] text-7xl md:text-9xl font-black leading-none">
        {value}
      </p>
    </div>
  );
};

const SystemStats = () => {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6">
      {/* Section label */}
      <h2 className="text-white text-xl font-bold mb-4 tracking-tight">
        Oracle Status
      </h2>

      {/* Main card */}
      <div className="bg-[#0A0F1E] border border-[#1B2A3B] border-t-2 border-t-[#39FF14] rounded-lg overflow-hidden shadow-2xl">

        {/* Global Health row */}
        <div className="px-6 py-4">
          <GlobalHealthIndicator status="ACTIVE" />
        </div>

        {/* Green separator */}
        <div className="h-px bg-gradient-to-r from-[#39FF14]/60 via-[#39FF14]/20 to-transparent mx-6" />

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 px-6 py-8">
          <StatsCard label="Global Health:" value="0" showDot={true} />
          <StatsCard label="Active Contracts" value="4" />
          <StatsCard label="Whitelisted Relayers:" value="3" />
        </div>

        {/* Bottom separator */}
        <div className="h-px bg-[#1B2A3B] mx-6 mb-6" />
      </div>
    </section>
  );
};

export default SystemStats;
