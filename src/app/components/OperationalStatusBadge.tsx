import React from "react";

interface OperationalStatusBadgeProps {
  label?: string;
  uptime?: number;
}

function clampUptime(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

const OperationalStatusBadge = React.memo(function OperationalStatusBadge({
  label = "Operational",
  uptime = 99.9,
}: OperationalStatusBadgeProps) {
  const formattedUptime = `${clampUptime(uptime).toFixed(1)}%`;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#39FF14]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39FF14] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#39FF14]" />
      </span>
      {label} ({formattedUptime})
    </span>
  );
});

export default OperationalStatusBadge;
