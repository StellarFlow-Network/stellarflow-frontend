import React from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  showDot?: boolean;
}

const StatsCard = ({ label, value, showDot = false }: StatsCardProps) => {
  return (
    <div className="flex flex-col items-center md:items-start gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-[#CBF34D] font-bold text-sm md:text-base uppercase tracking-widest opacity-90">
          {label}
        </h3>
        {showDot && (
          <div className="relative flex items-center justify-center">
            {/* Animated Glow Effect */}
            <div className="absolute w-4 h-4 rounded-full bg-[#CBF34D] animate-ping opacity-40" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#CBF34D] shadow-[0_0_12px_#CBF34D]" />
          </div>
        )}
      </div>
      <p className="text-[#CBF34D] text-7xl md:text-9xl font-black leading-none drop-shadow-[0_0_15px_rgba(203,243,77,0.2)]">
        {value}
      </p>
    </div>
  );
};

const SystemStats = () => {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6">
      {/* Container Label */}
      <h2 className="text-white text-xl font-bold mb-6 tracking-tight flex items-center gap-2">
        ORACLE STATUS
      </h2>

      {/* Main Stats Card */}
      <div className="bg-[#0B121C]/80 backdrop-blur-md border-t-4 border-[#CBF34D] rounded-xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#CBF34D]/5 to-transparent pointer-events-none" />

        {/* Global Health Badge */}
        <div className="mb-10 inline-flex items-center gap-2 px-3 py-1 rounded-md border border-[#CBF34D]/30 bg-[#CBF34D]/10">
          <span className="text-[#CBF34D] font-bold text-xs tracking-widest uppercase">
            GLOBAL HEALTH: <span className="ml-1 text-white opacity-90">[ ACTIVE ]</span>
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-4 relative z-10">
          <StatsCard label="GLOBAL HEALTH:" value="0" showDot={true} />
          <StatsCard label="Active Contracts" value="4" />
          <StatsCard label="Whitelisted Relayers:" value="3" />
        </div>

        {/* Bottom Decorative Line */}
        <div className="mt-16 h-0.5 bg-zinc-800/50 w-full relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#CBF34D]/20 to-transparent" />
        </div>
      </div>
    </section>
  );
};

export default SystemStats;
