"use client";

export default function Map() {
  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.12),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(96,165,250,0.12),transparent_40%)]" />
      <div className="relative flex h-full min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-[#0F172A] p-6 text-center">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/85">
            Live Network Map
          </p>
          <p className="text-sm leading-6 text-slate-300">
            Map tiles and GeoJSON overlays are loaded on the client after hydration.
          </p>
        </div>
      </div>
    </div>
  );
}
