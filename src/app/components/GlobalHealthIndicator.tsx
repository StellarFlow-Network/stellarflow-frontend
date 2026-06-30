import React from "react";

type HealthStatus = "ACTIVE" | "INACTIVE" | "WARNING";

interface GlobalHealthIndicatorProps {
  status?: HealthStatus;
}

const statusConfig: Record<HealthStatus, { label: string; textColor: string; dotColor: string; dotGlow: string }> = {
  ACTIVE: {
    label: "ACTIVE",
    textColor: "text-[#39FF14]",
    dotColor: "bg-[#39FF14]",
    dotGlow: "shadow-[0_0_8px_3px_rgba(57,255,20,0.8)]",
  },
  INACTIVE: {
    label: "INACTIVE",
    textColor: "text-zinc-400",
    dotColor: "bg-zinc-400",
    dotGlow: "shadow-[0_0_6px_2px_rgba(161,161,170,0.4)]",
  },
  WARNING: {
    label: "WARNING",
    textColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
    dotGlow: "shadow-[0_0_8px_3px_rgba(250,204,21,0.7)]",
  },
};

const GlobalHealthIndicator = ({ status = "ACTIVE" }: GlobalHealthIndicatorProps) => {
  const config = statusConfig[status];
  const isActive = status === "ACTIVE";

  return (
    <div className="flex items-center gap-2" >
      {/* Label */}
      <span className={`text-sm font-bold font-mono tracking-widest ${config.textColor}`}>
        Global Health:
      </span>

      {/* Status */}
      <span className={`text-sm font-bold font-mono tracking-widest ${config.textColor}`}>
        [ {config.label.charAt(0) + config.label.slice(1).toLowerCase()} ]
      </span>

      {/* Glowing orb */}
      <div className="relative flex items-center justify-center w-4 h-4 ml-1">

      </div>
    </div>
  );
};

export default React.memo(GlobalHealthIndicator);
